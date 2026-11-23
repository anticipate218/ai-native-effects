import { compileProgram } from '../scan-reveal/scan-gl';

/**
 * WebGL2 renderer for the dither gradient: a flowing multi-stop gradient (or an image), sampled per
 * pixel cell, nudged by an ordered (Bayer 4×4 / 8×8) or noise threshold and snapped to the nearest
 * palette colour. Inside the lens the smooth, undithered colour shows through.
 */
const FRAG = /* glsl */ `#version 300 es
precision highp float;
precision highp int;
uniform vec2 uRes;
uniform float uPixel;
uniform float uTime;
uniform float uScale;
uniform float uSeed;
uniform vec3 uStops[6];
uniform int uStopCount;
uniform vec3 uPal[8];
uniform int uPalCount;
uniform int uMode;        // 0 bayer4, 1 bayer8, 2 noise
uniform float uSpread;
uniform sampler2D uImage;
uniform float uHasImage;
uniform vec4 uCover;      // uv scale.xy, offset.zw
uniform vec4 uLens;       // x, y (buffer px, top-left), radius, strength
out vec4 outColor;

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21) + uSeed); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int k = 0; k < 4; k++) { v += a * noise(p); p = p * 2.02 + vec2(7.3, 1.9); a *= 0.5; }
  return v;
}
vec3 ramp(float t) {
  t = clamp(t, 0.0, 1.0) * float(uStopCount - 1);
  int i = int(floor(t));
  int j = min(i + 1, uStopCount - 1);
  return mix(uStops[i], uStops[j], smoothstep(0.0, 1.0, fract(t)));
}
vec3 source(vec2 px) {
  if (uHasImage > 0.5) {
    vec2 uv = (px / uRes) * uCover.xy + uCover.zw;
    return texture(uImage, uv).rgb;
  }
  vec2 p = px / uRes.y * uScale;
  float t = uTime;
  vec2 q = vec2(fbm(p * 1.2 + vec2(0.0, t * 0.05)), fbm(p * 1.2 + vec2(4.1, 2.7) - t * 0.04));
  float v = fbm(p * 0.9 + 1.6 * q + vec2(t * 0.03, 0.0));
  // A gentle diagonal sweep keeps every stop on screen.
  v = v * 0.75 + (px.x / uRes.x * 0.35 + (1.0 - px.y / uRes.y) * 0.25) - 0.18;
  return ramp(smoothstep(0.08, 0.92, v));
}
// Ordered dither thresholds via bit interleaving (same maths as bayer4/bayer8 in dither-gradient.ts).
float bayer4(ivec2 p) {
  int x = p.x & 3, y = p.y & 3, xy = x ^ y;
  return float(((xy & 1) << 3) | ((x & 1) << 2) | (xy & 2) | ((x & 2) >> 1)) / 16.0;
}
float bayer8(ivec2 p) {
  int x = p.x & 7, y = p.y & 7, xy = x ^ y;
  return float(((xy & 1) << 5) | ((x & 1) << 4) | ((xy & 2) << 2) | ((x & 2) << 1) | ((xy & 4) >> 1) | ((x & 4) >> 2)) / 64.0;
}
vec3 nearest(vec3 c) {
  vec3 best = uPal[0];
  float bd = 1e9;
  for (int i = 0; i < 8; i++) {
    if (i >= uPalCount) break;
    vec3 d = (c - uPal[i]) * vec3(0.30, 0.59, 0.11) * 3.0;
    float e = dot(d, d) + dot(c - uPal[i], c - uPal[i]) * 0.25;
    if (e < bd) { bd = e; best = uPal[i]; }
  }
  return best;
}

void main() {
  vec2 frag = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec2 cell = floor(frag / uPixel);
  vec3 c = source((cell + 0.5) * uPixel);
  ivec2 ic = ivec2(cell);
  float b = uMode == 0 ? bayer4(ic) : uMode == 1 ? bayer8(ic) : fract(52.9829189 * fract(0.06711056 * cell.x + 0.00583715 * cell.y));
  vec3 q = nearest(c + (b - 0.5) * uSpread);

  // Lens: the smooth source, sampled per pixel, with a thin bright rim.
  float d = distance(frag, uLens.xy);
  float r = uLens.z;
  float inside = (1.0 - smoothstep(r - 1.5, r + 0.5, d)) * uLens.w;
  vec3 col = inside > 0.001 ? mix(q, source(frag), inside) : q; // only pay for the second sample inside the lens
  col += vec3(1.0) * (1.0 - smoothstep(0.0, 1.6, abs(d - r))) * 0.55 * uLens.w;
  outColor = vec4(col, 1.0);
}`;

const UNIFORMS = ['uRes', 'uPixel', 'uTime', 'uScale', 'uSeed', 'uStops', 'uStopCount', 'uPal', 'uPalCount', 'uMode', 'uSpread', 'uImage', 'uHasImage', 'uCover', 'uLens'] as const;

export interface DitherFrame {
  time: number;
  pixel: number;
  scale: number;
  seed: number;
  stops: number[]; // flat rgb, up to 6
  palette: number[]; // flat rgb, up to 8
  mode: 0 | 1 | 2;
  spread: number;
  cover: [number, number, number, number];
  lens: [number, number, number, number];
}

export class DitherRenderer {
  readonly gl: WebGL2RenderingContext;
  readonly software: boolean;
  #program: WebGLProgram;
  #vao: WebGLVertexArrayObject;
  #image: WebGLTexture;
  #hasImage = false;
  #loc = {} as Record<(typeof UNIFORMS)[number], WebGLUniformLocation | null>;

  static create(canvas: HTMLCanvasElement): DitherRenderer | null {
    let gl: WebGL2RenderingContext | null = null;
    try {
      gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false });
    } catch {
      return null;
    }
    if (!gl) return null;
    try {
      return new DitherRenderer(gl);
    } catch (error) {
      console.warn('[ai-native-effects] dither-gradient: WebGL setup failed, using the CSS fallback.', error);
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
    this.#image = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.#image);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
  }

  setImage(img: HTMLImageElement | null): void {
    const gl = this.gl;
    this.#hasImage = !!img;
    if (!img) return;
    gl.bindTexture(gl.TEXTURE_2D, this.#image);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
  }

  render(f: DitherFrame): void {
    const gl = this.gl;
    const l = this.#loc;
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.useProgram(this.#program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.#image);
    gl.uniform1i(l.uImage, 0);
    gl.uniform1f(l.uHasImage, this.#hasImage ? 1 : 0);
    gl.uniform2f(l.uRes, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.uniform1f(l.uPixel, f.pixel);
    gl.uniform1f(l.uTime, f.time);
    gl.uniform1f(l.uScale, f.scale);
    gl.uniform1f(l.uSeed, f.seed);
    const stops = f.stops.concat(new Array(18).fill(0)).slice(0, 18);
    const pal = f.palette.concat(new Array(24).fill(0)).slice(0, 24);
    gl.uniform3fv(l.uStops, stops);
    gl.uniform1i(l.uStopCount, Math.max(2, Math.min(6, f.stops.length / 3)));
    gl.uniform3fv(l.uPal, pal);
    gl.uniform1i(l.uPalCount, Math.max(2, Math.min(8, f.palette.length / 3)));
    gl.uniform1i(l.uMode, f.mode);
    gl.uniform1f(l.uSpread, f.spread);
    gl.uniform4f(l.uCover, ...f.cover);
    gl.uniform4f(l.uLens, ...f.lens);
    gl.bindVertexArray(this.#vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  dispose(): void {
    const gl = this.gl;
    gl.deleteProgram(this.#program);
    gl.deleteVertexArray(this.#vao);
    gl.deleteTexture(this.#image);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}
