/**
 * WebGL2 renderer for `<ane-image-reveal>`: a diffusion-style denoising reveal.
 *
 * Each frame mixes a coarse-to-fine prediction of the image with per-step noise,
 * following the forward diffusion formula x_t = √ᾱ·x̂₀ + √(1−ᾱ)·ε:
 * - x̂₀ is sampled from a blurrier mip level early on and is desaturated, sharpening and
 *   regaining colour as the steps advance;
 * - ε is re-seeded every step (the characteristic sampler "flicker"), cross-faded briefly;
 * - early on both are quantised to latent blocks (an 8× VAE downsampling), which dissolve
 *   towards the end like a VAE decode.
 */
import { compileProgram, SCENE_FRAG } from '../scan-reveal/scan-gl';

const FRAG = /* glsl */ `#version 300 es
precision highp float;
uniform sampler2D uImage;
uniform vec2 uRes;
uniform float uT;          // continuous progress 0..1
uniform float uStep;       // current step index
uniform float uStepFrac;   // 0..1 within the step
uniform float uSeed;
uniform float uLatent;     // latent block size in device px
uniform float uMono;       // 1 = monochrome noise
uniform float uFlash;      // completion flash 0..1
uniform float uMaxLod;
uniform float uCompare;    // compare split (0..1 of width); < 0 = off
uniform vec3 uAccent;
out vec4 outColor;

float hash(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.x + p.y) * p.z);
}
// Roughly Gaussian (sum of uniforms), centred on 0, unit-ish variance.
float gauss(vec3 p) {
  return (hash(p) + hash(p + 17.3) + hash(p + 41.7) - 1.5) * 2.0;
}
// Mostly luminance noise with a little chroma, like a decoded latent; mono drops the chroma.
vec3 noiseAt(vec2 cell, float k) {
  float l = gauss(vec3(cell, k * 7.13 + uSeed));
  vec3 c = vec3(gauss(vec3(cell, k * 7.13 + uSeed + 101.0)), gauss(vec3(cell, k * 7.13 + uSeed + 211.0)), gauss(vec3(cell, k * 7.13 + uSeed + 307.0)));
  return vec3(l) + (c - dot(c, vec3(0.333))) * 0.45 * (1.0 - uMono);
}

void main() {
  vec2 frag = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec2 uv = frag / uRes;
  float t = clamp(uT, 0.0, 1.0);

  // Signal fraction ᾱ: coarse colour blobs show within the first few steps, detail late.
  float abar = t;
  if (t >= 1.0) abar = 1.0;

  // Latent quantisation fades out over the last 45% (the "VAE decode").
  float latentMix = 1.0 - smoothstep(0.45, 0.95, t);
  vec2 cell = floor(frag / uLatent);
  vec2 uvLatent = (cell + 0.5) * uLatent / uRes;
  vec2 uvS = mix(uv, uvLatent, latentMix);

  // Coarse-to-fine prediction: high mip early, full detail at the end; colour comes in late.
  float lod = uMaxLod * pow(1.0 - t, 1.6);
  vec3 x0 = textureLod(uImage, uvS, lod).rgb;
  float luma = dot(x0, vec3(0.299, 0.587, 0.114));
  x0 = mix(vec3(luma), x0, smoothstep(0.15, 0.8, t));

  // Per-step noise on latent cells plus fine grain; cross-fade into the next step.
  float k = uStep;
  float next = smoothstep(0.6, 1.0, uStepFrac);
  vec3 epsLatent = mix(noiseAt(cell, k), noiseAt(cell, k + 1.0), next);
  vec3 epsFine = mix(noiseAt(frag, k + 0.5), noiseAt(frag, k + 1.5), next);
  vec3 eps = mix(epsFine, epsLatent * 0.9 + epsFine * 0.25, latentMix);

  vec3 color = sqrt(abar) * x0 + sqrt(1.0 - abar) * (0.38 + 0.17 * eps);

  // Completion: a brief lift towards the accent and back.
  color += uAccent * 0.12 * uFlash + vec3(0.06) * uFlash;

  // Before/after comparison: left of the split shows the noisy start.
  if (uCompare >= 0.0) {
    vec3 start = 0.38 + 0.17 * (noiseAt(cell, 0.0) * 0.9 + noiseAt(frag, 0.5) * 0.25);
    vec3 final = textureLod(uImage, uv, 0.0).rgb;
    float x = uv.x;
    color = x < uCompare ? start : final;
    float line = 1.0 - smoothstep(0.0, 1.5, abs(frag.x - uCompare * uRes.x));
    color = mix(color, vec3(1.0), line * 0.9);
  }

  outColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}`;

export interface RevealFrame {
  t: number;
  step: number;
  stepFrac: number;
  seed: number;
  latent: number;
  mono: boolean;
  flash: number;
  compare: number;
  accent: readonly [number, number, number];
}

const UNIFORMS = ['uImage', 'uRes', 'uT', 'uStep', 'uStepFrac', 'uSeed', 'uLatent', 'uMono', 'uFlash', 'uMaxLod', 'uCompare', 'uAccent'] as const;

export class RevealRenderer {
  readonly gl: WebGL2RenderingContext;
  #program: WebGLProgram;
  #vao: WebGLVertexArrayObject;
  #image: WebGLTexture;
  #levels = 1;
  #loc = {} as Record<(typeof UNIFORMS)[number], WebGLUniformLocation | null>;

  static create(canvas: HTMLCanvasElement): RevealRenderer | null {
    let gl: WebGL2RenderingContext | null = null;
    try {
      gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false });
    } catch {
      return null;
    }
    if (!gl) return null;
    try {
      return new RevealRenderer(gl);
    } catch (error) {
      console.warn('[ai-native-effects] image-reveal: WebGL setup failed, using the 2D fallback.', error);
      return null;
    }
  }

  private constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.#vao = gl.createVertexArray();
    this.#image = gl.createTexture();
    this.#program = compileProgram(gl, FRAG);
    for (const name of UNIFORMS) this.#loc[name] = gl.getUniformLocation(this.#program, name);
  }

  #finish(width: number, height: number): void {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.#image);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.#levels = Math.floor(Math.log2(Math.max(width, height)));
  }

  /** Paints the procedural farmland scene (shared with `<ane-scan-reveal>`). */
  bakeScene(seed: number, width: number, height: number): void {
    const gl = this.gl;
    const program = compileProgram(gl, SCENE_FRAG);
    const framebuffer = gl.createFramebuffer();
    gl.bindTexture(gl.TEXTURE_2D, this.#image);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.#image, 0);
    gl.viewport(0, 0, width, height);
    gl.useProgram(program);
    gl.uniform1ui(gl.getUniformLocation(program, 'uSeed'), (seed * 2654435761) >>> 0);
    gl.uniform2f(gl.getUniformLocation(program, 'uSize'), width, height);
    gl.uniform1i(gl.getUniformLocation(program, 'uMode'), 0);
    gl.bindVertexArray(this.#vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.deleteFramebuffer(framebuffer);
    gl.deleteProgram(program);
    this.#finish(width, height);
  }

  /** Uploads a decoded image (throws for cross-origin images without CORS). */
  setImage(source: TexImageSource, width: number, height: number): void {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.#image);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, source);
    this.#finish(width, height);
  }

  render(frame: RevealFrame): void {
    const gl = this.gl;
    const loc = this.#loc;
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.useProgram(this.#program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.#image);
    gl.uniform1i(loc.uImage, 0);
    gl.uniform2f(loc.uRes, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.uniform1f(loc.uT, frame.t);
    gl.uniform1f(loc.uStep, frame.step);
    gl.uniform1f(loc.uStepFrac, frame.stepFrac);
    gl.uniform1f(loc.uSeed, frame.seed % 997);
    gl.uniform1f(loc.uLatent, frame.latent);
    gl.uniform1f(loc.uMono, frame.mono ? 1 : 0);
    gl.uniform1f(loc.uFlash, frame.flash);
    gl.uniform1f(loc.uMaxLod, Math.min(7, Math.max(0, this.#levels - 3)));
    gl.uniform1f(loc.uCompare, frame.compare);
    gl.uniform3f(loc.uAccent, ...frame.accent);
    gl.bindVertexArray(this.#vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  dispose(): void {
    const gl = this.gl;
    gl.deleteTexture(this.#image);
    gl.deleteProgram(this.#program);
    gl.deleteVertexArray(this.#vao);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}

