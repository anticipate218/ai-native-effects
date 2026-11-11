/**
 * WebGL2 renderer for `<ane-scan-reveal>`. No dependencies.
 *
 * - `bakeScene(seed)` paints a procedural farmland scene (fields, river, forest, town, roads)
 *   and its class mask into two textures, so the effect works without any image asset.
 * - `setImage()` / `setMask()` upload user imagery instead.
 * - `render()` draws one full-canvas triangle: the push-broom acquisition reveal (sensor line,
 *   band misregistration, detector striping that calibrates away) and the inference sweep that
 *   lays the class mask over the image with crisp outlines.
 */

const VERT = /* glsl */ `#version 300 es
void main() {
  vec2 p = vec2(gl_VertexID == 1 ? 3.0 : -1.0, gl_VertexID == 2 ? 3.0 : -1.0);
  gl_Position = vec4(p, 0.0, 1.0);
}`;

const SCENE = /* glsl */ `#version 300 es
precision highp float;
precision highp int;
uniform uint uSeed;
uniform vec2 uSize;
uniform int uMode; // 0 = colour, 1 = class mask
uniform vec3 uWater;
uniform vec3 uUrban;
uniform vec3 uForest;
out vec4 outColor;

// Hash: "lowbias32" integer mixer by Chris Wellons (public domain).
uint mixBits(uint x) {
  x ^= x >> 16; x *= 0x7feb352du;
  x ^= x >> 15; x *= 0x846ca68bu;
  x ^= x >> 16;
  return x;
}
float hash(ivec2 p) {
  return float(mixBits(uint(p.x) ^ mixBits(uint(p.y) ^ uSeed))) * (1.0 / 4294967296.0);
}
vec2 hash2(ivec2 p) {
  uint h = mixBits(uint(p.x) ^ mixBits(uint(p.y) ^ uSeed));
  return vec2(float(h & 0xffffu), float(h >> 16)) / 65535.0;
}
float noise(vec2 x) {
  ivec2 i = ivec2(floor(x));
  vec2 f = fract(x);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + ivec2(1, 0)), u.x), mix(hash(i + ivec2(0, 1)), hash(i + ivec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p, int octaves) {
  float s = 0.0, a = 0.5, n = 0.0;
  for (int i = 0; i < 7; i++) {
    if (i >= octaves) break;
    s += a * noise(p);
    n += a;
    p = p * 2.07 + vec2(13.1, 7.7);
    a *= 0.5;
  }
  return s / n;
}
/** Voronoi: x = distance to nearest site, y = border distance (F2 - F1), zw = nearest cell. */
vec4 voronoi(vec2 x) {
  ivec2 n = ivec2(floor(x));
  vec2 f = fract(x);
  float f1 = 8.0, f2 = 8.0;
  ivec2 best = n;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      ivec2 g = ivec2(i, j);
      vec2 o = 0.12 + 0.76 * hash2(n + g);
      float d = length(vec2(g) + o - f);
      if (d < f1) { f2 = f1; f1 = d; best = n + g; }
      else if (d < f2) { f2 = d; }
    }
  }
  return vec4(f1, f2 - f1, vec2(best));
}
float riverY(float x) {
  return 0.56 + 0.15 * sin(x * 2.3 + 0.7) + 0.05 * sin(x * 6.1 + 1.9) + 0.06 * (fbm(vec2(x * 1.4, 4.0), 3) - 0.5);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uSize;
  uv.y = 1.0 - uv.y; // row 0 = top of the scene, like an uploaded image
  float aspect = uSize.x / uSize.y;
  vec2 p = vec2(uv.x * aspect, uv.y);
  vec2 q = p + 0.05 * vec2(fbm(p * 3.0, 3) - 0.5, fbm(p * 3.0 + 9.0, 3) - 0.5);

  // Fields: large regions, each with its own orientation, split into long rectangular parcels
  // (rows of varying length, like consolidated European farmland), with tillage rows and hedges.
  vec4 region = voronoi(p * 1.5 + 30.0);
  ivec2 rid = ivec2(region.zw);
  float angle = (hash(rid + ivec2(4, 4)) - 0.5) * 1.1;
  mat2 rot = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
  vec2 r = rot * q * vec2(7.0, 10.0);
  float row = floor(r.y);
  float span = 1.2 + 2.4 * hash(rid + ivec2(int(row), 3));
  float x = r.x / span + hash(rid + ivec2(int(row), 9)) * 7.0;
  vec2 cell = vec2(floor(x), row);
  vec2 f = vec2(fract(x), fract(r.y));
  float border = min(min(f.x, 1.0 - f.x) * span / 7.0, min(f.y, 1.0 - f.y) / 10.0);
  float id = hash(rid * 31 + ivec2(cell));
  vec3 crop;
  if (id < 0.20) crop = vec3(0.26, 0.36, 0.18);
  else if (id < 0.36) crop = vec3(0.33, 0.42, 0.22);
  else if (id < 0.50) crop = vec3(0.21, 0.30, 0.15);
  else if (id < 0.64) crop = vec3(0.54, 0.51, 0.35);
  else if (id < 0.74) crop = vec3(0.47, 0.45, 0.30);
  else if (id < 0.88) crop = vec3(0.41, 0.35, 0.26);
  else crop = vec3(0.35, 0.31, 0.24);
  crop *= 0.92 + 0.14 * hash(rid * 17 + ivec2(cell) + ivec2(3, 5));
  crop *= 0.95 + 0.05 * sin((rot * p).y * 900.0 + id * 40.0);
  crop *= 0.9 + 0.2 * fbm(p * 30.0 + id * 9.0, 3);
  float hedge = 1.0 - smoothstep(0.0012, 0.0035, border);
  // Farm tracks along region boundaries (border distance converted back to scene units).
  float track = 1.0 - smoothstep(0.0012, 0.0028, region.y / 1.5 * 0.5);
  vec3 color = mix(crop, vec3(0.15, 0.21, 0.11), hedge * 0.7);
  color = mix(color, vec3(0.50, 0.48, 0.42), track * 0.6);
  int cls = 0;

  // Forest patches.
  float forest = smoothstep(0.635, 0.65, fbm(p * 2.6 + 20.0, 5));
  vec3 canopy = vec3(0.10, 0.19, 0.09) * (0.75 + 0.5 * fbm(p * 140.0, 3));
  color = mix(color, canopy, forest);
  if (forest > 0.5) cls = 2;

  // Roads.
  float road1 = abs(p.y - (0.18 + 0.22 * p.x / aspect + 0.01 * sin(p.x * 9.0)));
  float road2 = abs(p.x - (0.62 * aspect + 0.06 * sin(p.y * 5.0)));
  float roads = 1.0 - smoothstep(0.0015, 0.0035, min(road1, road2));
  color = mix(color, vec3(0.70, 0.68, 0.63), roads);

  // Town: a block grid of roofs next to the river.
  vec2 townC = vec2(0.30 * aspect, riverY(0.30 * aspect) - 0.11);
  float town = smoothstep(0.17, 0.10, length((p - townC) * vec2(0.8, 1.15)) + (fbm(p * 7.0, 3) - 0.5) * 0.09);
  if (town > 0.01) {
    // Small, irregular roofs with gardens between; a street every few lots.
    vec2 tp = (p - townC) * mat2(0.96, -0.28, 0.28, 0.96) * 80.0;
    tp += 0.35 * vec2(noise(tp * 0.2), noise(tp * 0.2 + 7.0));
    ivec2 lot = ivec2(floor(tp));
    vec2 lf = fract(tp);
    float street = max(step(0.86, fract(tp.x / 4.0)) , step(0.82, fract(tp.y / 3.0)));
    float r = hash(lot + ivec2(5, 9));
    vec3 roof = r < 0.3 ? vec3(0.60, 0.58, 0.55) : r < 0.55 ? vec3(0.47, 0.45, 0.43) : r < 0.78 ? vec3(0.54, 0.40, 0.33) : vec3(0.70, 0.68, 0.64);
    roof *= 0.8 + 0.25 * step(0.5, lf.x); // pitched roofs: lit and shaded halves
    float building = step(0.1, lf.x) * step(lf.x, 0.9) * step(0.12, lf.y) * step(lf.y, 0.88) * step(0.12, hash(lot + ivec2(8, 1)));
    vec3 garden = vec3(0.22, 0.30, 0.16) * (0.8 + 0.4 * fbm(p * 200.0, 2));
    vec3 urban = mix(garden, roof, building);
    urban = mix(urban, vec3(0.40, 0.40, 0.40), street);
    color = mix(color, urban, town);
    if (town > 0.5) cls = 3;
  }

  // River with a greener floodplain and sediment-tinted water.
  float d = abs(p.y - riverY(p.x));
  float width = 0.016 + 0.008 * fbm(vec2(p.x * 3.0, 1.0), 2);
  float plain = 1.0 - smoothstep(0.03, 0.12, d);
  color = mix(color, color * vec3(0.85, 1.05, 0.85), plain * 0.5);
  float water = 1.0 - smoothstep(width - 0.002, width + 0.002, d);
  vec3 river = mix(vec3(0.09, 0.20, 0.24), vec3(0.20, 0.27, 0.25), fbm(p * 25.0, 3));
  color = mix(color, river, water);
  if (water > 0.5) cls = 1;
  float bank = (1.0 - smoothstep(0.0, 0.004, abs(d - width))) * 0.35;
  color = mix(color, vec3(0.55, 0.52, 0.42), bank);

  // Gentle relief shading and atmospheric haze.
  float hx = fbm(p * 4.0 + vec2(0.01, 0.0), 4) - fbm(p * 4.0 - vec2(0.01, 0.0), 4);
  color *= 1.0 + hx * 2.2;
  color = mix(color, vec3(0.58, 0.63, 0.68), 0.05);

  if (uMode == 0) {
    outColor = vec4(color, 1.0);
  } else {
    vec3 c = cls == 1 ? uWater : cls == 2 ? uForest : cls == 3 ? uUrban : vec3(0.0);
    outColor = vec4(c, cls == 0 ? 0.0 : 1.0);
  }
}`;

const FRAG = /* glsl */ `#version 300 es
precision highp float;
uniform sampler2D uImage;
uniform sampler2D uMask;
uniform bool uHasMask;
uniform vec2 uRes;
uniform vec2 uMaskTexel;
uniform float uScan;      // acquisition line, 0..1 along track
uniform float uAnalysis;  // inference line, 0..1 along track
uniform float uAngle;
uniform float uTime;
uniform float uDpr;
uniform float uGhost;
uniform float uFx;        // 0 in reduced motion: no fringes, striping or glow
uniform vec3 uAccent;
out vec4 outColor;

float hash1(float n) { return fract(sin(n * 12.9898) * 43758.5453); }

void main() {
  vec2 frag = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y); // top-left origin, device px
  vec2 uv = frag / uRes;
  vec2 dir = vec2(sin(uAngle), cos(uAngle));   // along-track (downwards)
  vec2 across = vec2(dir.y, -dir.x);
  vec2 c = frag - uRes * 0.5;
  float ext = 0.5 * (uRes.x * abs(dir.x) + uRes.y * abs(dir.y));
  float s = dot(c, dir);                         // px along track, -ext..ext
  float px = uDpr;

  // Line positions overshoot both ends so the sweep starts and finishes off-frame.
  float margin = 40.0 * px;
  float lineA = mix(-ext - margin, ext + margin, uScan);
  float lineB = mix(-ext - margin, ext + margin, uAnalysis);
  float d = lineA - s;                           // > 0: acquired
  float dB = lineB - s;

  vec3 img = texture(uImage, uv).rgb;

  // Not yet acquired: dark plate, survey grid, faint ghost of the scene.
  float luma = dot(img, vec3(0.299, 0.587, 0.114));
  vec3 ahead = vec3(0.024, 0.035, 0.06) + vec3(0.30, 0.45, 0.60) * luma * uGhost;
  vec2 g = abs(fract(frag / (32.0 * px) - 0.5) - 0.5) * 32.0 * px;
  float grid = 1.0 - smoothstep(0.0, 1.2 * px, min(g.x, g.y));
  ahead += vec3(0.35, 0.5, 0.7) * grid * 0.05;

  // Acquired: band misregistration right behind the line, detector striping that settles.
  vec3 acquired = img;
  if (uFx > 0.0 && d > 0.0) {
    float fringe = exp(-d / (26.0 * px)) * 7.0 * px;
    vec2 o = dir * fringe / uRes;
    acquired = vec3(texture(uImage, uv - o).r, img.g, texture(uImage, uv + o).b);
    float column = floor(dot(c, across) / (3.0 * px));
    // Each detector column has its own gain error until calibration settles it.
    float stripe = (hash1(column) - 0.5) * 0.32;
    float settle = exp(-d / (42.0 * px));
    acquired *= 1.0 + stripe * settle;
    acquired += uAccent * 0.22 * exp(-d / (14.0 * px));
    acquired = mix(acquired, vec3(dot(acquired, vec3(0.333))), 0.35 * settle);
  }
  float cover = uFx > 0.0 ? smoothstep(-0.8 * px, 0.8 * px, d) : step(0.0, d);
  vec3 color = mix(ahead, acquired, cover);

  // Inference sweep: class overlay with outlines; fresh detections are brighter.
  if (uHasMask && uAnalysis > 0.0) {
    vec4 m = texture(uMask, uv);
    vec2 t = uMaskTexel * 1.5;
    vec4 mx = texture(uMask, uv + vec2(t.x, 0.0)) - texture(uMask, uv - vec2(t.x, 0.0));
    vec4 my = texture(uMask, uv + vec2(0.0, t.y)) - texture(uMask, uv - vec2(0.0, t.y));
    float edge = smoothstep(0.15, 0.6, length(mx) + length(my));
    float inB = uFx > 0.0 ? smoothstep(-0.8 * px, 0.8 * px, dB) : step(0.0, dB);
    float fresh = uFx > 0.0 ? exp(-max(dB, 0.0) / (60.0 * px)) : 0.0;
    vec3 tint = m.rgb;
    color = mix(color, tint, inB * m.a * (0.22 + 0.38 * fresh));
    color = mix(color, mix(tint, vec3(1.0), 0.25), inB * edge * (0.75 + 0.25 * fresh) * max(m.a, 0.6));
    // Dashed inference line.
    float dash = step(0.45, fract((dot(c, across) + uTime * 60.0 * px * uFx) / (14.0 * px)));
    float lineGlowB = exp(-abs(dB) / (1.4 * px)) * (uAnalysis < 1.0 ? 1.0 : 0.0);
    color += vec3(1.0, 0.95, 0.85) * lineGlowB * dash * 0.9;
    color += uAccent * exp(-abs(dB) / (10.0 * px)) * 0.12 * uFx * (uAnalysis < 1.0 ? 1.0 : 0.0);
  }

  // Sensor line with a soft footprint glow and detector ticks.
  if (uScan < 1.0) {
    float core = exp(-abs(d) / (1.1 * px));
    float halo = exp(-abs(d) / (16.0 * px)) * 0.35 + exp(-max(-d, 0.0) / (40.0 * px)) * 0.10 * step(d, 0.0);
    float ticks = step(0.86, fract(dot(c, across) / (18.0 * px))) * exp(-abs(d + 5.0 * px) / (1.5 * px));
    color += uAccent * (halo * uFx + ticks * 0.7 * uFx);
    color = mix(color, vec3(1.0), core * 0.85);
  }

  outColor = vec4(color, 1.0);
}`;

export interface ScanFrame {
  scan: number;
  analysis: number;
  angle: number;
  time: number;
  dpr: number;
  ghost: number;
  fx: number;
  accent: readonly [number, number, number];
}

export interface SceneClasses {
  water: readonly [number, number, number];
  urban: readonly [number, number, number];
  forest: readonly [number, number, number];
}

function compile(gl: WebGL2RenderingContext, frag: string): WebGLProgram {
  const program = gl.createProgram();
  for (const [type, source] of [[gl.VERTEX_SHADER, VERT], [gl.FRAGMENT_SHADER, frag]] as const) {
    const shader = gl.createShader(type);
    if (!shader) throw new Error('createShader failed');
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(`shader: ${gl.getShaderInfoLog(shader)}`);
    gl.attachShader(program, shader);
    gl.deleteShader(shader);
  }
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(`link: ${gl.getProgramInfoLog(program)}`);
  return program;
}

const UNIFORMS = ['uImage', 'uMask', 'uHasMask', 'uRes', 'uMaskTexel', 'uScan', 'uAnalysis', 'uAngle', 'uTime', 'uDpr', 'uGhost', 'uFx', 'uAccent'] as const;

export class ScanRenderer {
  readonly gl: WebGL2RenderingContext;
  #program: WebGLProgram;
  #vao: WebGLVertexArrayObject;
  #image: WebGLTexture;
  #mask: WebGLTexture;
  #hasMask = false;
  #maskSize: [number, number] = [1, 1];
  #loc = {} as Record<(typeof UNIFORMS)[number], WebGLUniformLocation | null>;

  static create(canvas: HTMLCanvasElement): ScanRenderer | null {
    let gl: WebGL2RenderingContext | null = null;
    try {
      gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false });
    } catch {
      return null;
    }
    if (!gl) return null;
    try {
      return new ScanRenderer(gl);
    } catch (error) {
      console.warn('[ai-native-effects] scan-reveal: WebGL setup failed, using the 2D fallback.', error);
      return null;
    }
  }

  private constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.#vao = gl.createVertexArray();
    this.#image = gl.createTexture();
    this.#mask = gl.createTexture();
    this.#program = compile(gl, FRAG);
    for (const name of UNIFORMS) this.#loc[name] = gl.getUniformLocation(this.#program, name);
  }

  get hasMask(): boolean {
    return this.#hasMask;
  }

  #params(texture: WebGLTexture, mipmaps: boolean): void {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    if (mipmaps) gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mipmaps ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  /** Paints the procedural scene and its class mask (width × height texels). */
  bakeScene(seed: number, width: number, height: number, classes: SceneClasses): void {
    const gl = this.gl;
    const program = compile(gl, SCENE);
    const framebuffer = gl.createFramebuffer();
    gl.useProgram(program);
    gl.uniform1ui(gl.getUniformLocation(program, 'uSeed'), (seed * 2654435761) >>> 0);
    gl.uniform2f(gl.getUniformLocation(program, 'uSize'), width, height);
    gl.uniform3f(gl.getUniformLocation(program, 'uWater'), ...classes.water);
    gl.uniform3f(gl.getUniformLocation(program, 'uUrban'), ...classes.urban);
    gl.uniform3f(gl.getUniformLocation(program, 'uForest'), ...classes.forest);
    gl.bindVertexArray(this.#vao);
    for (const [mode, texture] of [[0, this.#image], [1, this.#mask]] as const) {
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('scene framebuffer incomplete');
      gl.viewport(0, 0, width, height);
      gl.uniform1i(gl.getUniformLocation(program, 'uMode'), mode);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      this.#params(texture, mode === 0);
    }
    gl.deleteFramebuffer(framebuffer);
    gl.deleteProgram(program);
    this.#hasMask = true;
    this.#maskSize = [width, height];
  }

  /** Uploads a decoded image (row 0 = top). Throws on cross-origin images without CORS. */
  setImage(source: TexImageSource): void {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.#image);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, source);
    this.#params(this.#image, true);
  }

  setMask(source: TexImageSource | null, width = 1, height = 1): void {
    const gl = this.gl;
    if (!source) {
      this.#hasMask = false;
      return;
    }
    gl.bindTexture(gl.TEXTURE_2D, this.#mask);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, source);
    // Outlines come from neighbour differences in the shader, so plain linear filtering is enough.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.#hasMask = true;
    this.#maskSize = [width, height];
  }

  render(frame: ScanFrame): void {
    const gl = this.gl;
    const loc = this.#loc;
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.useProgram(this.#program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.#image);
    gl.uniform1i(loc.uImage, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.#mask);
    gl.uniform1i(loc.uMask, 1);
    gl.uniform1i(loc.uHasMask, this.#hasMask ? 1 : 0);
    gl.uniform2f(loc.uRes, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.uniform2f(loc.uMaskTexel, 1 / this.#maskSize[0], 1 / this.#maskSize[1]);
    gl.uniform1f(loc.uScan, frame.scan);
    gl.uniform1f(loc.uAnalysis, frame.analysis);
    gl.uniform1f(loc.uAngle, frame.angle);
    gl.uniform1f(loc.uTime, frame.time);
    gl.uniform1f(loc.uDpr, frame.dpr);
    gl.uniform1f(loc.uGhost, frame.ghost);
    gl.uniform1f(loc.uFx, frame.fx);
    gl.uniform3f(loc.uAccent, ...frame.accent);
    gl.bindVertexArray(this.#vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.activeTexture(gl.TEXTURE0);
  }

  dispose(): void {
    const gl = this.gl;
    gl.deleteTexture(this.#image);
    gl.deleteTexture(this.#mask);
    gl.deleteProgram(this.#program);
    gl.deleteVertexArray(this.#vao);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}
