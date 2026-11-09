/**
 * WebGL2 planet renderer for `<ane-orbit-loading-screen>`. No dependencies.
 *
 * 1. A one-time "bake" pass writes a procedural planet into a 1024×512 equirectangular
 *    RGBA8 texture: R = elevation, G = clouds, B = settlement noise, A = ice.
 *    Noise is sampled on the unit sphere, so there are no seams or pole pinches.
 * 2. Every frame a single full-canvas triangle ray-casts an orthographic sphere and
 *    shades it: soft terminator, ocean glint, drifting clouds, night-side lights,
 *    atmosphere rim and halo, and the "tile acquisition" overlay that visualises progress.
 */

const VERT = /* glsl */ `#version 300 es
void main() {
  vec2 p = vec2(gl_VertexID == 1 ? 3.0 : -1.0, gl_VertexID == 2 ? 3.0 : -1.0);
  gl_Position = vec4(p, 0.0, 1.0);
}`;

// Hash: "lowbias32" integer mixer by Chris Wellons (public domain).
const NOISE = /* glsl */ `
uint mixBits(uint x) {
  x ^= x >> 16; x *= 0x7feb352du;
  x ^= x >> 15; x *= 0x846ca68bu;
  x ^= x >> 16;
  return x;
}
float hash3(ivec3 p) {
  uint h = mixBits(uint(p.x) ^ mixBits(uint(p.y) ^ mixBits(uint(p.z) ^ uSeed)));
  return float(h) * (1.0 / 4294967296.0);
}
float valueNoise(vec3 x) {
  ivec3 i = ivec3(floor(x));
  vec3 f = fract(x);
  vec3 u = f * f * (3.0 - 2.0 * f);
  float a = hash3(i), b = hash3(i + ivec3(1, 0, 0));
  float c = hash3(i + ivec3(0, 1, 0)), d = hash3(i + ivec3(1, 1, 0));
  float e = hash3(i + ivec3(0, 0, 1)), g = hash3(i + ivec3(1, 0, 1));
  float h = hash3(i + ivec3(0, 1, 1)), k = hash3(i + ivec3(1, 1, 1));
  return mix(mix(mix(a, b, u.x), mix(c, d, u.x), u.y), mix(mix(e, g, u.x), mix(h, k, u.x), u.y), u.z);
}
float fbm(vec3 p, int octaves) {
  float sum = 0.0, amp = 0.5, norm = 0.0;
  for (int i = 0; i < 8; i++) {
    if (i >= octaves) break;
    sum += amp * valueNoise(p);
    norm += amp;
    p = p * 2.03 + vec3(17.1, 3.7, 9.2);
    amp *= 0.5;
  }
  return sum / norm;
}`;

const BAKE = /* glsl */ `#version 300 es
precision highp float;
precision highp int;
uniform uint uSeed;
uniform vec2 uSize;
out vec4 outColor;
${NOISE}
void main() {
  vec2 uv = gl_FragCoord.xy / uSize;
  float lon = (uv.x - 0.5) * 6.2831853;
  float lat = (uv.y - 0.5) * 3.14159265;
  vec3 p = vec3(cos(lat) * sin(lon), sin(lat), cos(lat) * cos(lon));
  // Domain warping gives natural, ragged coastlines.
  vec3 warp = vec3(fbm(p * 1.6 + 3.1, 4), fbm(p * 1.6 + 7.3, 4), fbm(p * 1.6 + 11.9, 4)) - 0.5;
  float elevation = fbm(p * 1.8 + warp * 1.3, 7);
  vec3 swirl = vec3(fbm(p * 2.2 + 21.0, 4), fbm(p * 2.2 + 27.0, 4), fbm(p * 2.2 + 33.0, 4)) - 0.5;
  float clouds = fbm(vec3(p.x, p.y * 1.6, p.z) * 2.4 + swirl * 2.6 + 40.0, 6);
  float settlements = fbm(p * 46.0 + 5.0, 3);
  float ice = smoothstep(0.80, 0.90, abs(p.y) + (fbm(p * 5.0 + 60.0, 3) - 0.5) * 0.18);
  outColor = vec4(elevation, clouds, settlements, ice);
}`;

const FRAG = /* glsl */ `#version 300 es
precision highp float;
uniform sampler2D uTex;
uniform vec2 uCenter;
uniform float uRadius;
uniform mat3 uRot;
uniform vec3 uLight;
uniform float uCloud;
uniform float uProgress;
uniform float uDet;
uniform float uScan;
uniform float uBurst;
uniform float uDone;
uniform float uError;
uniform float uOrder;
uniform float uSea;
uniform vec3 uAtmo;
uniform vec3 uAccent;
uniform vec3 uDanger;
uniform float uLod;
out vec4 outColor;

const float PI = 3.14159265;
const float TAU = 6.2831853;
const vec2 GRID = vec2(72.0, 36.0);
const float SWATHS = 12.0;

float hash21(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

vec3 shade(vec4 t, float cloudRaw, float ndl, vec3 n, float cloudAmount) {
  float e = t.r;
  float land = smoothstep(uSea - 0.006, uSea + 0.006, e);
  float depth = clamp((uSea - e) / 0.14, 0.0, 1.0);
  vec3 ocean = mix(vec3(0.010, 0.048, 0.088), vec3(0.003, 0.012, 0.034), depth);
  float height = clamp((e - uSea) / 0.2, 0.0, 1.0);
  vec3 ground = mix(vec3(0.060, 0.105, 0.055), vec3(0.200, 0.170, 0.095), smoothstep(0.08, 0.5, height));
  ground = mix(ground, vec3(0.300, 0.275, 0.235), smoothstep(0.55, 1.0, height));
  vec3 albedo = mix(ocean, ground, land);
  albedo = mix(albedo, vec3(0.70, 0.76, 0.84), t.a);

  float diffuse = smoothstep(-0.10, 0.60, ndl);
  vec3 color = albedo * (0.015 + 1.35 * diffuse);
  vec3 halfway = normalize(uLight + vec3(0.0, 0.0, 1.0));
  float glint = pow(max(dot(n, halfway), 0.0), 64.0) * (1.0 - land) * (1.0 - t.a);
  color += vec3(1.0, 0.90, 0.75) * glint * 0.65 * diffuse;

  float cloud = smoothstep(0.56, 0.84, cloudRaw) * cloudAmount;
  color *= 1.0 - 0.28 * cloud;
  color = mix(color, vec3(0.80, 0.85, 0.93) * (0.01 + 1.0 * diffuse), cloud * 0.72);

  float night = 1.0 - smoothstep(-0.20, 0.04, ndl);
  float coast = 1.0 - smoothstep(0.0, 0.14, e - uSea);
  float lights = land * (1.0 - t.a) * smoothstep(0.66, 0.72, t.b) * (0.25 + 0.75 * coast);
  color += vec3(1.0, 0.62, 0.30) * lights * night * (1.0 - cloud) * 0.85;
  return color;
}

vec3 toneMap(vec3 c) { return pow(1.0 - exp(-c * 1.2), vec3(1.0 / 2.2)); }

void main() {
  vec2 d = (gl_FragCoord.xy - uCenter) / uRadius;
  float r = length(d);
  float aa = 1.5 / uRadius;
  vec3 color = vec3(0.0);
  float alpha = 0.0;

  vec2 dir = r > 1e-4 ? d / r : vec2(0.0, 1.0);
  float facing = dot(dir, normalize(uLight.xy + vec2(1e-5)));
  float side = 0.20 + 0.80 * smoothstep(-0.6, 0.9, facing);
  vec3 atmoSrgb = pow(uAtmo, vec3(1.0 / 2.2));
  // Completion "lock-in": a brief flash of the whole survey grid and the atmosphere.
  float flash = uBurst >= 0.0 ? pow(1.0 - clamp(uBurst, 0.0, 1.0), 2.0) : 0.0;

  if (r > 1.0 - aa) {
    float x = max(r - 1.0, 0.0);
    float halo = (exp(-x * 18.0) * 0.85 + exp(-x * 5.5) * 0.16) * side * (1.0 + flash * 0.6);
    // Reach zero before the canvas edge (the canvas spans r = 1.3) so no square shows.
    halo *= 1.0 - smoothstep(1.1, 1.28, r);
    halo = clamp(halo, 0.0, 1.0);
    color = atmoSrgb * halo;
    alpha = halo;
  }

  if (r < 1.0 + aa) {
    float z = sqrt(max(1.0 - r * r, 0.0));
    vec3 n = vec3(d, z);
    vec3 p = uRot * n;
    float lat = asin(clamp(p.y, -1.0, 1.0));
    float lon = atan(p.x, p.z);
    vec2 uv = vec2(lon / TAU + 0.5, lat / PI + 0.5);
    float ndl = dot(n, uLight);

    // Tile acquisition order: diagonal "ground track" swaths, each filled south to north.
    vec2 g = uv * GRID;
    vec2 cell = floor(g);
    float diag = fract((cell.x + cell.y * 0.55) / GRID.x);
    float swath = floor(diag * SWATHS);
    float rank = mod(swath * 5.0 + uOrder, SWATHS);
    float along = clamp(cell.y / GRID.y * 0.9 + hash21(cell) * 0.1, 0.0, 0.999);
    float key = (rank + along) / SWATHS;
    float p1 = uProgress * 1.01;
    float got = max(smoothstep(key, key + 0.004, p1) * uDet, uDone);
    float fresh = uDet * step(key, p1) * (1.0 - smoothstep(0.0, 0.035, p1 - key)) * (1.0 - uDone);
    float scan = (1.0 - uDet) * step(key, uScan) * (1.0 - smoothstep(0.0, 0.06, uScan - key));

    // Anti-aliased survey grid (seam-safe derivatives across the date line).
    vec2 fw = vec2(min(fwidth(g.x), fwidth(fract(uv.x + 0.5) * GRID.x)), fwidth(g.y));
    vec2 edge = (0.5 - abs(fract(g) - 0.5)) / max(fw, vec2(1e-4));
    float line = 1.0 - clamp(min(edge.x, edge.y) - 0.3, 0.0, 1.0);
    line *= smoothstep(0.10, 0.35, cos(lat));

    // Not yet downloaded: a blurred, desaturated preview (like a progressive JPEG).
    // Downloaded: full detail. Explicit LODs also avoid the date-line derivative seam.
    vec2 uvCloud = uv + vec2(uCloud, 0.0);
    vec4 tHi = textureLod(uTex, uv, uLod);
    float cHi = textureLod(uTex, uvCloud, uLod).g;
    // Four taps on a coarse mip hide the bilinear blockiness of a single low-LOD sample.
    float lodLo = uLod + 3.4;
    vec2 o = vec2(1.0 / 64.0, 1.0 / 32.0) * 0.5;
    vec4 tLo = 0.25 * (textureLod(uTex, uv + o, lodLo) + textureLod(uTex, uv - o, lodLo)
      + textureLod(uTex, uv + vec2(o.x, -o.y), lodLo) + textureLod(uTex, uv + vec2(-o.x, o.y), lodLo));
    float cLo = textureLod(uTex, uvCloud, lodLo + 0.6).g;
    vec3 hi = shade(tHi, cHi, ndl, n, 1.0);
    vec3 lo = shade(tLo, cLo, ndl, n, 0.45);
    // The preview reads as a cool, low-key "not loaded yet" render, not as a broken texture.
    float luma = dot(lo, vec3(0.2126, 0.7152, 0.0722));
    lo = vec3(luma) * 0.18 + uAtmo * luma * 0.55;
    vec3 base = mix(lo, hi, got);

    float day = 0.40 + 0.60 * smoothstep(-0.25, 0.35, ndl);
    vec3 tint = mix(uAccent, uDanger, uError);
    base += vec3(0.45, 0.60, 0.90) * line * 0.035 * (1.0 - got) * day;
    base += tint * (fresh * (0.12 + line * 0.5) + scan * (0.05 + line * 0.4)) * day;
    base += uAccent * flash * (0.03 + line * 0.5) * day;

    float rim = pow(1.0 - z, 2.4);
    base += uAtmo * rim * (0.05 + 0.9 * smoothstep(-0.35, 0.7, ndl)) * (1.0 + flash * 0.8);

    float coverage = 1.0 - smoothstep(1.0 - aa, 1.0 + aa, r);
    color = mix(color, toneMap(base), coverage);
    alpha = mix(alpha, 1.0, coverage);
  }
  outColor = vec4(color, alpha);
}`;

export interface PlanetFrame {
  /** Planet center in canvas device pixels, origin bottom-left. */
  centerX: number;
  centerY: number;
  /** Planet radius in device pixels. */
  radius: number;
  /** View → object rotation, column-major. */
  rotation: Float32Array;
  light: readonly [number, number, number];
  cloud: number;
  progress: number;
  determinate: number;
  scan: number;
  burst: number;
  done: number;
  error: number;
  order: number;
  sea: number;
  /** Linear RGB colors. */
  atmosphere: readonly [number, number, number];
  accent: readonly [number, number, number];
  danger: readonly [number, number, number];
  /** Texture LOD for full detail (0 when the planet is large). */
  lod: number;
}

const UNIFORMS = [
  'uTex', 'uCenter', 'uRadius', 'uRot', 'uLight', 'uCloud', 'uProgress', 'uDet', 'uScan', 'uBurst',
  'uDone', 'uError', 'uOrder', 'uSea', 'uAtmo', 'uAccent', 'uDanger', 'uLod',
] as const;

const TEX_W = 1024;
const TEX_H = 512;

function compile(gl: WebGL2RenderingContext, vert: string, frag: string): WebGLProgram {
  const program = gl.createProgram();
  for (const [type, source] of [[gl.VERTEX_SHADER, vert], [gl.FRAGMENT_SHADER, frag]] as const) {
    const shader = gl.createShader(type);
    if (!shader) throw new Error('createShader failed');
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(`shader: ${gl.getShaderInfoLog(shader)}`);
    }
    gl.attachShader(program, shader);
    gl.deleteShader(shader);
  }
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(`link: ${gl.getProgramInfoLog(program)}`);
  return program;
}

export class PlanetRenderer {
  readonly gl: WebGL2RenderingContext;
  #program: WebGLProgram;
  #texture: WebGLTexture;
  #vao: WebGLVertexArrayObject;
  #loc = {} as Record<(typeof UNIFORMS)[number], WebGLUniformLocation | null>;

  /** Returns `null` when WebGL2 is unavailable or the shaders fail (callers fall back to 2D). */
  static create(canvas: HTMLCanvasElement, seed: number): PlanetRenderer | null {
    let gl: WebGL2RenderingContext | null = null;
    try {
      gl = canvas.getContext('webgl2', {
        alpha: true,
        premultipliedAlpha: true,
        antialias: false,
        depth: false,
        stencil: false,
        powerPreference: 'default',
      });
    } catch {
      return null;
    }
    if (!gl) return null;
    try {
      return new PlanetRenderer(gl, seed);
    } catch (error) {
      console.warn('[ai-native-effects] orbit-loading-screen: WebGL setup failed, using the 2D fallback.', error);
      return null;
    }
  }

  private constructor(gl: WebGL2RenderingContext, seed: number) {
    this.gl = gl;
    this.#vao = gl.createVertexArray();
    this.#texture = gl.createTexture();
    this.#program = compile(gl, VERT, FRAG);
    for (const name of UNIFORMS) this.#loc[name] = gl.getUniformLocation(this.#program, name);
    this.bake(seed);
  }

  /** Regenerates the planet textures for a seed (one draw call into a framebuffer). */
  bake(seed: number): void {
    const gl = this.gl;
    const program = compile(gl, VERT, BAKE);
    gl.bindTexture(gl.TEXTURE_2D, this.#texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, TEX_W, TEX_H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.#texture, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('bake framebuffer incomplete');
    gl.viewport(0, 0, TEX_W, TEX_H);
    gl.useProgram(program);
    gl.uniform1ui(gl.getUniformLocation(program, 'uSeed'), (seed * 2654435761) >>> 0);
    gl.uniform2f(gl.getUniformLocation(program, 'uSize'), TEX_W, TEX_H);
    gl.bindVertexArray(this.#vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.deleteFramebuffer(framebuffer);
    gl.bindTexture(gl.TEXTURE_2D, this.#texture);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.deleteProgram(program);
  }

  render(frame: PlanetFrame): void {
    const gl = this.gl;
    const loc = this.#loc;
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.#program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.#texture);
    gl.uniform1i(loc.uTex, 0);
    gl.uniform2f(loc.uCenter, frame.centerX, frame.centerY);
    gl.uniform1f(loc.uRadius, frame.radius);
    gl.uniformMatrix3fv(loc.uRot, false, frame.rotation);
    gl.uniform3f(loc.uLight, ...frame.light);
    gl.uniform1f(loc.uCloud, frame.cloud);
    gl.uniform1f(loc.uProgress, frame.progress);
    gl.uniform1f(loc.uDet, frame.determinate);
    gl.uniform1f(loc.uScan, frame.scan);
    gl.uniform1f(loc.uBurst, frame.burst);
    gl.uniform1f(loc.uDone, frame.done);
    gl.uniform1f(loc.uError, frame.error);
    gl.uniform1f(loc.uOrder, frame.order);
    gl.uniform1f(loc.uSea, frame.sea);
    gl.uniform3f(loc.uAtmo, ...frame.atmosphere);
    gl.uniform3f(loc.uAccent, ...frame.accent);
    gl.uniform3f(loc.uDanger, ...frame.danger);
    gl.uniform1f(loc.uLod, frame.lod);
    gl.bindVertexArray(this.#vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  /** Frees GPU resources and releases the context slot (browsers cap live contexts). */
  dispose(): void {
    const gl = this.gl;
    gl.deleteTexture(this.#texture);
    gl.deleteProgram(this.#program);
    gl.deleteVertexArray(this.#vao);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}
