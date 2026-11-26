import { compileProgram } from '../scan-reveal/scan-gl';

/**
 * WebGL2 renderer for the topography background. A domain-warped fbm height field drifts slowly;
 * the pointer raises a hill and clicks send ripples through it. Contours are drawn at a constant
 * pixel width using screen-space derivatives (fwidth), every Nth one as a heavier index contour,
 * and fade out where they would crowd into moiré. Elevation bands get a light hypsometric tint and
 * an optional hillshade.
 */
export const MAX_RIPPLES = 4;

const FRAG = /* glsl */ `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform float uScale;
uniform float uSeed;
uniform float uLevels;
uniform float uLineW;     // buffer px
uniform float uIndex;     // every Nth contour is an index contour (0 = none)
uniform vec3 uBg;
uniform vec3 uLine;
uniform vec3 uAccent;
uniform float uFill;
uniform float uShade;
uniform float uGrain;
uniform vec4 uHill;       // x, y (buffer px, top-left), radius (buffer px), height
uniform vec4 uRipples[${MAX_RIPPLES}]; // x, y (buffer px), age (s), strength
out vec4 outColor;

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21) + uSeed); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 r = mat2(0.8, -0.6, 0.6, 0.8);
  for (int k = 0; k < 4; k++) { v += a * noise(p); p = r * p * 2.01 + vec2(3.1, 7.7); a *= 0.42; }
  return v / 0.85;
}

float height(vec2 px) {
  vec2 p = px / uRes.y * uScale;
  float t = uTime * 0.035;
  vec2 q = vec2(fbm(p + vec2(0.0, t)), fbm(p + vec2(5.2, 1.3) - t * 0.8));
  float h = fbm(p * 0.8 + 1.1 * q + vec2(t * 0.6, -t * 0.3));
  h = (h - 0.5) * 1.45 + 0.5; // stretch without clamping: a clamped plateau would sit exactly on a contour
  // Pointer hill: a smooth gaussian dome.
  vec2 dh = (px - uHill.xy) / max(uHill.z, 1.0);
  h += uHill.w * exp(-dot(dh, dh) * 1.3);
  // Ripples: a travelling wave packet that fades with age.
  for (int i = 0; i < ${MAX_RIPPLES}; i++) {
    vec4 r = uRipples[i];
    if (r.w <= 0.0) continue;
    float d = distance(px, r.xy) / uRes.y;
    float w = d - r.z * 0.32;
    h += r.w * 0.11 * sin(w * 40.0) * exp(-w * w * 55.0) * exp(-r.z * 0.75) * smoothstep(0.0, 0.2, r.z);
  }
  return h;
}

void main() {
  vec2 frag = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  float h = height(frag);
  float n = h * uLevels;
  float fw = max(fwidth(n), 1e-4);

  // Distance to the nearest contour, in pixels.
  float f = abs(fract(n + 0.5) - 0.5) / fw;
  float k = floor(n + 0.5);
  bool major = uIndex > 0.5 && abs(mod(k, uIndex)) < 0.5;
  float w = uLineW * (major ? 1.9 : 1.0);
  float a = 1.0 - smoothstep(w * 0.5 - 0.5, w * 0.5 + 0.6, f);
  // Contours closer than ~3 px apart dissolve instead of turning into moiré.
  a *= 1.0 - smoothstep(0.3, 0.65, fw);

  // Hypsometric tint: stepped bands towards the line colour (and the accent at the top).
  float band = clamp(floor(n) / max(uLevels, 1.0), 0.0, 1.0);
  vec3 tint = mix(uLine, uAccent, smoothstep(0.55, 1.0, band));
  vec3 col = mix(uBg, tint, band * uFill * 0.22);

  // Hillshade from screen-space slope (light from the top left).
  vec2 g = vec2(dFdx(h), -dFdy(h)) * uRes.y * 0.9;
  vec3 nrm = normalize(vec3(-g, 1.0));
  float lambert = dot(nrm, normalize(vec3(-0.55, -0.6, 0.6))) - 0.6;
  col *= 1.0 + lambert * uShade * 0.35;

  vec3 lc = major ? uAccent : uLine;
  col = mix(col, lc, a * (major ? 0.95 : 0.72));

  // Static paper grain.
  col += (hash(floor(frag)) - 0.5) * uGrain * 0.07;
  outColor = vec4(col, 1.0);
}`;

const UNIFORMS = ['uRes', 'uTime', 'uScale', 'uSeed', 'uLevels', 'uLineW', 'uIndex', 'uBg', 'uLine', 'uAccent', 'uFill', 'uShade', 'uGrain', 'uHill', 'uRipples'] as const;

export type RGB = [number, number, number];

export interface TopoFrame {
  time: number;
  scale: number;
  seed: number;
  levels: number;
  lineWidth: number;
  index: number;
  bg: RGB;
  line: RGB;
  accent: RGB;
  fill: number;
  shade: number;
  grain: number;
  hill: [number, number, number, number];
  ripples: Array<[number, number, number, number]>;
}

export class TopoRenderer {
  readonly gl: WebGL2RenderingContext;
  readonly software: boolean;
  #program: WebGLProgram;
  #vao: WebGLVertexArrayObject;
  #loc = {} as Record<(typeof UNIFORMS)[number], WebGLUniformLocation | null>;

  static create(canvas: HTMLCanvasElement): TopoRenderer | null {
    let gl: WebGL2RenderingContext | null = null;
    try {
      gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false });
    } catch {
      return null;
    }
    if (!gl) return null;
    try {
      return new TopoRenderer(gl);
    } catch (error) {
      console.warn('[ai-native-effects] topography: WebGL setup failed, using the CSS fallback.', error);
      return null;
    }
  }

  private constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = String(info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    this.software = /swiftshader|llvmpipe|software|basic render/i.test(renderer);
    this.#vao = gl.createVertexArray();
    this.#program = compileProgram(gl, FRAG);
    for (const name of UNIFORMS) this.#loc[name] = gl.getUniformLocation(this.#program, name);
  }

  render(f: TopoFrame): void {
    const gl = this.gl;
    const l = this.#loc;
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.useProgram(this.#program);
    gl.uniform2f(l.uRes, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.uniform1f(l.uTime, f.time);
    gl.uniform1f(l.uScale, f.scale);
    gl.uniform1f(l.uSeed, f.seed);
    gl.uniform1f(l.uLevels, f.levels);
    gl.uniform1f(l.uLineW, f.lineWidth);
    gl.uniform1f(l.uIndex, f.index);
    gl.uniform3f(l.uBg, ...f.bg);
    gl.uniform3f(l.uLine, ...f.line);
    gl.uniform3f(l.uAccent, ...f.accent);
    gl.uniform1f(l.uFill, f.fill);
    gl.uniform1f(l.uShade, f.shade);
    gl.uniform1f(l.uGrain, f.grain);
    gl.uniform4f(l.uHill, ...f.hill);
    const r = new Float32Array(MAX_RIPPLES * 4);
    f.ripples.slice(0, MAX_RIPPLES).forEach((v, i) => r.set(v, i * 4));
    gl.uniform4fv(l.uRipples, r);
    gl.bindVertexArray(this.#vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  dispose(): void {
    const gl = this.gl;
    gl.deleteProgram(this.#program);
    gl.deleteVertexArray(this.#vao);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}
