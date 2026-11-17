/**
 * WebGL2 renderer for `<ane-aurora>`: one full-canvas fragment shader.
 *
 * Three auroral curtains hang from wavy lower edges that drift with time. Above each edge
 * the light decays exponentially with height and is broken into vertical rays; colour shifts
 * from the low-altitude hue (green) to the high-altitude hue (violet). Behind: a night sky with
 * twinkling stars; in front: optional mountain ridges rim-lit by the aurora.
 */
import { compileProgram } from '../scan-reveal/scan-gl';

const FRAG = /* glsl */ `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uPointer;      // 0..aspect, 0..1 (y up)
uniform float uPointerOn;
uniform vec3 uLow;
uniform vec3 uHigh;
uniform vec3 uSky;
uniform float uIntensity;
uniform float uRays;
uniform float uStars;
uniform float uHorizon;
uniform float uSeed;
out vec4 outColor;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 3; i++) {
    s += a * noise(p);
    p = p * 2.03 + 17.1;
    a *= 0.5;
  }
  return s / 0.875;
}
// Two octaves: enough for slow, large shapes (hems, heights, ridges).
float fbm2(vec2 p) {
  return (noise(p) * 0.5 + noise(p * 2.03 + 17.1) * 0.25) / 0.75;
}

// Returns colour contribution of one curtain at point p (x in 0..aspect, y in 0..1).
vec3 curtain(vec2 p, float i, float t, out float glow) {
  float seed = uSeed + i * 13.7;
  float x = p.x;
  float base = 0.40 + 0.09 * i
    + 0.09 * sin(x * (0.8 + 0.25 * i) + t * (0.10 + 0.03 * i) + seed)
    + 0.10 * (fbm2(vec2(x * 1.2 + seed, t * 0.04 + i)) - 0.5);
  float dxp = x - uPointer.x;
  base -= uPointerOn * 0.07 * exp(-dxp * dxp * 6.0);
  float height = 0.16 + 0.18 * fbm2(vec2(x * 1.8 + seed * 2.0, t * 0.05));
  float dy = p.y - base;
  float above = dy > 0.0 ? exp(-dy / height) : 0.0;
  float below = dy <= 0.0 ? exp(dy * 55.0) : 0.0;
  float shape = above + below;
  // Vertical rays drifting sideways; stretched along y so they read as streaks.
  float r = noise(vec2(x * 46.0 + seed * 3.0 - t * 0.35, p.y * 1.4 - t * 0.04));
  r = mix(1.0, 0.2 + 1.7 * r * r, uRays);
  // Brightness rolling along the curtain (the "dance").
  // Folds and gaps: some stretches of the curtain are dark, others blaze.
  float pulse = 1.35 * smoothstep(0.38, 0.78, fbm(vec2(x * 1.5 - t * 0.12, seed + t * 0.02)));
  float pointerBoost = 1.0 + uPointerOn * 0.6 * exp(-dxp * dxp * 10.0);
  float a = shape * r * pulse * pointerBoost;
  glow = exp(-abs(dy) * 4.0) * pulse * 0.6;
  vec3 col = mix(uLow, uHigh, smoothstep(0.0, height * 1.05, dy));
  // A thin hot edge at the very bottom of the curtain.
  col += vec3(0.6) * exp(-abs(dy) * 140.0) * 0.25;
  return col * a;
}

void main() {
  float aspect = uRes.x / uRes.y;
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 p = vec2(uv.x * aspect, uv.y);
  float t = uTime;

  // Sky: deep at the top, a little lifted towards the horizon.
  vec3 sky = mix(uSky * 1.2 + vec3(0.004, 0.007, 0.014), uSky * 0.45, smoothstep(0.0, 1.0, uv.y));

  // Stars: one candidate per cell, twinkling at its own rate.
  vec2 cell = floor(p * vec2(160.0));
  float h = hash(cell + uSeed);
  if (h > 1.0 - 0.022 * uStars) {
    vec2 c = (cell + vec2(hash(cell + 3.1), hash(cell + 7.7))) / 160.0;
    float d = length(p - c) * 160.0;
    float tw = 0.55 + 0.45 * sin(t * (1.0 + 3.0 * hash(cell + 1.3)) + h * 40.0);
    float size = 0.18 + 0.32 * hash(cell + 9.9);
    sky += vec3(0.85, 0.9, 1.0) * smoothstep(size, 0.0, d) * tw * smoothstep(0.15, 0.55, uv.y) * 0.75;
  }

  vec3 light = vec3(0.0);
  float glow = 0.0;
  for (int i = 0; i < 3; i++) {
    float g;
    float w = i == 0 ? 1.0 : i == 1 ? 0.65 : 0.4;
    light += curtain(p, float(i), t, g) * w;
    glow += g * w;
  }
  // Soft atmospheric bloom in the curtains' colours.
  vec3 bloom = mix(uLow, uHigh, 0.45) * glow * 0.12;
  // Stars drown in bright aurora, as they do in real skies.
  float lum = dot(light, vec3(0.3, 0.5, 0.2));
  sky = mix(sky, uSky, clamp(lum * 1.2, 0.0, 1.0) * 0.8);
  vec3 color = sky + (light * 0.5 + bloom) * uIntensity;

  // Mountains: a far, hazy ridge and a near, black one with an aurora rim light.
  // Ridges only exist near the bottom; skip the work elsewhere.
  if (uHorizon > 0.0 && uv.y < 0.3) {
    float far = 0.12 + 0.06 * fbm2(vec2(p.x * 2.2 + uSeed, 1.0)) + 0.025 * noise(vec2(p.x * 9.0, 4.0));
    float near = 0.06 + 0.05 * fbm2(vec2(p.x * 1.4 + uSeed + 5.0, 2.0)) + 0.02 * noise(vec2(p.x * 14.0, 6.0));
    far = mix(-0.2, far, uHorizon);
    near = mix(-0.2, near, uHorizon);
    vec3 haze = uSky * 0.7 + mix(uLow, uHigh, 0.3) * 0.025;
    float aaF = 1.5 / uRes.y;
    color = mix(color, haze + glow * 0.02 * uLow, smoothstep(far + aaF, far - aaF, uv.y));
    float rim = exp(-abs(uv.y - near) * 260.0) * glow * 0.35;
    color = mix(color, vec3(0.006, 0.008, 0.016), smoothstep(near + aaF, near - aaF, uv.y));
    color += mix(uLow, uHigh, 0.2) * rim * uIntensity;
  }

  // Filmic shoulder so bright rays roll off instead of clipping.
  color = 1.0 - exp(-color * 1.6);
  outColor = vec4(color, 1.0);
}`;

export interface AuroraFrame {
  time: number;
  pointer: readonly [number, number];
  pointerOn: number;
  low: readonly [number, number, number];
  high: readonly [number, number, number];
  sky: readonly [number, number, number];
  intensity: number;
  rays: number;
  stars: number;
  horizon: number;
  seed: number;
}

const UNIFORMS = ['uRes', 'uTime', 'uPointer', 'uPointerOn', 'uLow', 'uHigh', 'uSky', 'uIntensity', 'uRays', 'uStars', 'uHorizon', 'uSeed'] as const;

export class AuroraRenderer {
  readonly gl: WebGL2RenderingContext;
  #program: WebGLProgram;
  #vao: WebGLVertexArrayObject;
  #loc = {} as Record<(typeof UNIFORMS)[number], WebGLUniformLocation | null>;

  static create(canvas: HTMLCanvasElement): AuroraRenderer | null {
    let gl: WebGL2RenderingContext | null = null;
    try {
      gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false });
    } catch {
      return null;
    }
    if (!gl) return null;
    try {
      return new AuroraRenderer(gl);
    } catch (error) {
      console.warn('[ai-native-effects] aurora: WebGL setup failed, using the CSS fallback.', error);
      return null;
    }
  }

  private constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.#vao = gl.createVertexArray();
    this.#program = compileProgram(gl, FRAG);
    for (const name of UNIFORMS) this.#loc[name] = gl.getUniformLocation(this.#program, name);
  }

  render(f: AuroraFrame): void {
    const gl = this.gl;
    const l = this.#loc;
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.useProgram(this.#program);
    gl.uniform2f(l.uRes, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.uniform1f(l.uTime, f.time);
    gl.uniform2f(l.uPointer, f.pointer[0], f.pointer[1]);
    gl.uniform1f(l.uPointerOn, f.pointerOn);
    gl.uniform3f(l.uLow, ...f.low);
    gl.uniform3f(l.uHigh, ...f.high);
    gl.uniform3f(l.uSky, ...f.sky);
    gl.uniform1f(l.uIntensity, f.intensity);
    gl.uniform1f(l.uRays, f.rays);
    gl.uniform1f(l.uStars, f.stars);
    gl.uniform1f(l.uHorizon, f.horizon);
    gl.uniform1f(l.uSeed, f.seed);
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
