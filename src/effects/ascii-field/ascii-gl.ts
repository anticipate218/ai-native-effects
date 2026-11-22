import { compileProgram } from '../scan-reveal/scan-gl';

/**
 * WebGL2 renderer for the ASCII field. Every pixel finds its character cell, evaluates a domain-warped
 * fbm flow field at the cell centre (plus a text/image mask, the pointer and click waves), picks a glyph
 * by brightness and samples it from an atlas drawn at exactly the cell size, so glyphs stay crisp.
 */
const FRAG = /* glsl */ `#version 300 es
precision highp float;
uniform vec2 uRes;        // drawing buffer size (px)
uniform vec2 uCell;       // cell size (buffer px)
uniform vec2 uGrid;       // columns, rows
uniform float uTime;
uniform float uGlyphs;
uniform sampler2D uAtlas; // one row of glyphs, each exactly uCell
uniform sampler2D uMask;  // cell-resolution mask (alpha)
uniform float uHasMask;
uniform float uReveal;
uniform float uContrast;
uniform float uScale;
uniform float uSeed;
uniform vec3 uPointer;    // x, y (buffer px, top-left origin), strength
uniform vec4 uWaves[4];   // x, y, start time, active
uniform vec3 uColorA;
uniform vec3 uColorB;
out vec4 outColor;

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21) + uSeed); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int k = 0; k < 4; k++) { v += a * noise(p); p = p * 2.03 + vec2(11.7, 3.1); a *= 0.5; }
  return v;
}

void main() {
  vec2 frag = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y); // top-left origin
  vec2 cell = floor(frag / uCell);
  if (cell.x >= uGrid.x || cell.y >= uGrid.y) { outColor = vec4(0.0); return; }
  vec2 inCell = frag - cell * uCell;
  vec2 centre = (cell + 0.5) * uCell;
  vec2 p = centre / uRes.y * uScale;
  float t = uTime;

  // Domain-warped flow field.
  vec2 q = vec2(fbm(p * 1.6 + vec2(0.0, t * 0.06)), fbm(p * 1.6 + vec2(5.2, 1.3) - t * 0.05));
  float v = fbm(p * 1.3 + 1.8 * q + vec2(t * 0.035, -t * 0.02));
  v = clamp((v - 0.27) * 1.8 * uContrast, 0.0, 1.0);

  // Text / image mask: characters gather into the shape, with a shimmer of the field.
  if (uHasMask > 0.5) {
    float m = texture(uMask, (cell + 0.5) / uGrid).a;
    float shaped = max(m * (0.72 + 0.28 * v), v * 0.4);
    v = mix(v, shaped, uReveal);
  }

  // Pointer: a soft bright lens.
  float r = 7.0 * uCell.x;
  float d = distance(centre, uPointer.xy);
  v += uPointer.z * 0.75 * exp(-d * d / (r * r));

  // Click waves.
  for (int i = 0; i < 4; i++) {
    vec4 w = uWaves[i];
    if (w.w < 0.5) continue;
    float age = t - w.z;
    float front = age * 46.0 * uCell.x;
    float dw = distance(centre, w.xy);
    float band = exp(-pow((dw - front) / (2.6 * uCell.x), 2.0));
    v += band * exp(-age * 1.1) * 0.9;
  }
  v = clamp(v, 0.0, 1.0);

  float idx = min(floor(v * uGlyphs), uGlyphs - 1.0);
  vec2 texel = vec2(idx * uCell.x + inCell.x, inCell.y);
  float a = texelFetch(uAtlas, ivec2(texel), 0).a;
  float g = clamp(cell.x / max(uGrid.x - 1.0, 1.0) * 0.75 + v * 0.35 - 0.1, 0.0, 1.0);
  vec3 col = mix(uColorA, uColorB, g) * (0.55 + 0.75 * v);
  float alpha = a * (0.25 + 0.75 * v);
  outColor = vec4(col * alpha, alpha);
}`;

const UNIFORMS = ['uRes', 'uCell', 'uGrid', 'uTime', 'uGlyphs', 'uAtlas', 'uMask', 'uHasMask', 'uReveal', 'uContrast', 'uScale', 'uSeed', 'uPointer', 'uWaves', 'uColorA', 'uColorB'] as const;

export interface AsciiFrame {
  time: number;
  pointer: [number, number, number];
  waves: number[]; // 16 floats
  colorA: [number, number, number];
  colorB: [number, number, number];
  reveal: number;
  contrast: number;
  scale: number;
  seed: number;
}

export class AsciiRenderer {
  readonly gl: WebGL2RenderingContext;
  #program: WebGLProgram;
  #vao: WebGLVertexArrayObject;
  #atlas: WebGLTexture;
  #mask: WebGLTexture;
  #loc = {} as Record<(typeof UNIFORMS)[number], WebGLUniformLocation | null>;
  #cell: [number, number] = [8, 14];
  #grid: [number, number] = [1, 1];
  #glyphs = 1;
  #hasMask = false;

  static create(canvas: HTMLCanvasElement): AsciiRenderer | null {
    let gl: WebGL2RenderingContext | null = null;
    try {
      gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false });
    } catch {
      return null;
    }
    if (!gl) return null;
    try {
      return new AsciiRenderer(gl);
    } catch (error) {
      console.warn('[ai-native-effects] ascii-field: WebGL setup failed.', error);
      return null;
    }
  }

  /** True on software rasterisers (SwiftShader, llvmpipe): start at a lower resolution there. */
  readonly software: boolean;

  private constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = String(info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    this.software = /swiftshader|llvmpipe|software|basic render/i.test(renderer);
    this.#vao = gl.createVertexArray();
    this.#program = compileProgram(gl, FRAG);
    for (const name of UNIFORMS) this.#loc[name] = gl.getUniformLocation(this.#program, name);
    const tex = (): WebGLTexture => {
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
      return t;
    };
    this.#atlas = tex();
    this.#mask = tex();
  }

  /** Uploads the glyph atlas (one row of `count` glyphs, each `cell` buffer px) and sets the grid. */
  setAtlas(source: HTMLCanvasElement, cell: [number, number], count: number, grid: [number, number]): void {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.#atlas);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    this.#cell = cell;
    this.#glyphs = count;
    this.#grid = grid;
  }

  /** Uploads a cell-resolution mask (alpha channel), or clears it. */
  setMask(source: HTMLCanvasElement | null): void {
    const gl = this.gl;
    this.#hasMask = !!source;
    if (!source) return;
    gl.bindTexture(gl.TEXTURE_2D, this.#mask);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
  }

  render(f: AsciiFrame): void {
    const gl = this.gl;
    const l = this.#loc;
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.#program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.#atlas);
    gl.uniform1i(l.uAtlas, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.#mask);
    gl.uniform1i(l.uMask, 1);
    gl.uniform2f(l.uRes, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.uniform2f(l.uCell, ...this.#cell);
    gl.uniform2f(l.uGrid, ...this.#grid);
    gl.uniform1f(l.uGlyphs, this.#glyphs);
    gl.uniform1f(l.uHasMask, this.#hasMask ? 1 : 0);
    gl.uniform1f(l.uTime, f.time);
    gl.uniform1f(l.uReveal, f.reveal);
    gl.uniform1f(l.uContrast, f.contrast);
    gl.uniform1f(l.uScale, f.scale);
    gl.uniform1f(l.uSeed, f.seed);
    gl.uniform3f(l.uPointer, ...f.pointer);
    gl.uniform4fv(l.uWaves, f.waves);
    gl.uniform3f(l.uColorA, ...f.colorA);
    gl.uniform3f(l.uColorB, ...f.colorB);
    gl.bindVertexArray(this.#vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  dispose(): void {
    const gl = this.gl;
    gl.deleteProgram(this.#program);
    gl.deleteVertexArray(this.#vao);
    gl.deleteTexture(this.#atlas);
    gl.deleteTexture(this.#mask);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}
