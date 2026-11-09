import { defineElement, EffectElement } from '../../core/effect-element';
import { clamp, createRandom, damp, easeOutCubic, parseNumber } from '../../core/math';

const STYLE = /* css */ `
:host {
  --_color: var(--ane-orbit-color, #7c5cff);
  --_accent: var(--ane-orbit-accent, #5ef2ff);
  --_danger: var(--ane-danger, #ff5d6c);
  display: inline-block;
  position: relative;
  width: var(--ane-size, 240px);
  aspect-ratio: 1 / 1;
  vertical-align: middle;
  contain: layout style;
}
:host([hidden]) { display: none; }
.bar { position: absolute; inset: 0; }
canvas { display: block; width: 100%; height: 100%; }
.value {
  position: absolute;
  inset: 0;
  display: none;
  place-items: center;
  font: 700 calc(var(--ane-size, 240px) * 0.105) / 1 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
  color: #fff;
  text-shadow: 0 0 6px rgba(4, 6, 18, 0.95), 0 0 18px rgba(4, 6, 18, 0.9);
  pointer-events: none;
  user-select: none;
}
:host([show-value]) .value { display: grid; }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
`;

/** Globe tilt towards the viewer (radians): we look slightly down on the north pole. */
const TILT = 0.36;
/** Candidate dot positions on the globe; roughly a third become land. */
const SPHERE_POINTS = 1500;
const DEPTH_BUCKETS = 4;
const ORBIT_SEGMENTS = 72;
const TRAIL_SEGMENTS = 10;
/** Celebration length after progress reaches 100% (ms, effect time). */
const DONE_BURST = 1600;
export const MAX_SATELLITES = 6;

export interface OrbitCompleteDetail {
  /** Effect time (ms) at which the loader completed. */
  at: number;
}

interface Satellite {
  radius: number; // orbit radius in globe radii
  incline: number;
  node: number;
  rate: number; // rad/s, sign = direction
  phase: number;
  period: number; // downlink cycle (s)
  offset: number;
  /** Projected orbit path, recomputed on resize: x, y, z per vertex. */
  path: Float32Array;
}

interface Rgb {
  r: number;
  g: number;
  b: number;
}

const BLACK: Rgb = { r: 5, g: 7, b: 16 };
const mix = (a: Rgb, b: Rgb, t: number): string =>
  `rgb(${Math.round(a.r + (b.r - a.r) * t)}, ${Math.round(a.g + (b.g - a.g) * t)}, ${Math.round(a.b + (b.b - a.b) * t)})`;
const rgba = (c: Rgb, a: number): string => `rgba(${c.r}, ${c.g}, ${c.b}, ${a})`;

/** Normalises any CSS color through the canvas parser (handles names, hsl(), oklch()...). */
function toRgb(ctx: CanvasRenderingContext2D, color: string, fallback: Rgb): Rgb {
  ctx.fillStyle = '#000';
  ctx.fillStyle = color;
  const value = String(ctx.fillStyle);
  if (value.startsWith('#') && value.length === 7) {
    return {
      r: parseInt(value.slice(1, 3), 16),
      g: parseInt(value.slice(3, 5), 16),
      b: parseInt(value.slice(5, 7), 16),
    };
  }
  const parts = value.match(/[\d.]+/g);
  return parts && parts.length >= 3 ? { r: +parts[0]!, g: +parts[1]!, b: +parts[2]! } : fallback;
}

/** Applies the fixed globe tilt (rotation about the screen X axis). */
const tiltY = (y: number, z: number): number => y * Math.cos(TILT) - z * Math.sin(TILT);
const tiltZ = (y: number, z: number): number => y * Math.sin(TILT) + z * Math.cos(TILT);

/**
 * Builds a procedural planet: seeded "continents" (spherical caps with wobbly coasts)
 * sampled on a Fibonacci sphere. No map data, so nothing to license.
 */
export function generateLand(seed: number, points = SPHERE_POINTS): Float32Array<ArrayBuffer> {
  const random = createRandom(seed * 7919 + 17);
  const unit = (): [number, number, number] => {
    const z = random() * 2 - 1;
    const a = random() * Math.PI * 2;
    const r = Math.sqrt(1 - z * z);
    return [r * Math.cos(a), r * Math.sin(a), z];
  };
  const continents = Array.from({ length: 10 }, () => {
    const c = unit();
    const size = 0.2 + random() * 0.36;
    return { c, cos: Math.cos(size) };
  });
  const waves = Array.from({ length: 4 }, () => ({ d: unit(), f: 5 + random() * 6, p: random() * Math.PI * 2 }));
  const land: number[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < points; i++) {
    const y = 1 - (2 * (i + 0.5)) / points;
    const r = Math.sqrt(1 - y * y);
    const x = r * Math.cos(golden * i);
    const z = r * Math.sin(golden * i);
    let score = -Infinity;
    for (const { c, cos } of continents) {
      score = Math.max(score, (x * c[0] + y * c[1] + z * c[2] - cos) / (1 - cos));
    }
    let wobble = 0;
    for (const { d, f, p } of waves) wobble += Math.sin(f * (x * d[0] + y * d[1] + z * d[2]) + p);
    if (score + (wobble / waves.length) * 0.5 > 0 && Math.abs(y) < 0.94) land.push(x, y, z);
  }
  return new Float32Array(land);
}

/**
 * `<ane-orbit-loader>`: a procedural planet with satellites downlinking data packets,
 * wrapped in a progress ring. Determinate (`progress="0.42"`) or indeterminate.
 *
 * @attr progress - `0`-`1` (or `0%`-`100%`); omit for an indeterminate loader
 * @attr satellites - number of satellites, `1`-`6`, default `3`
 * @attr error - shows the failed state (danger ring, downlinks stop)
 * @attr show-value - shows the percentage over the globe
 * @attr color - planet color (any CSS color), default `#7c5cff`
 * @attr accent - satellites, downlinks and progress color, default `#5ef2ff`
 * @attr size - CSS length, default `240px`
 * @attr speed - animation time scale, `0`-`5`, default `1`
 * @attr motion - `auto` | `reduce` | `full`
 * @attr label - accessible name, default `Loading data`
 * @attr seed - integer seed for the planet and orbits
 * @fires ane-complete - once each time progress reaches 100%
 * @cssprop --ane-size, --ane-orbit-color, --ane-orbit-accent, --ane-danger
 */
export class OrbitLoaderElement extends EffectElement {
  static override get observedAttributes(): string[] {
    return [...super.observedAttributes, 'progress', 'satellites', 'error', 'color', 'accent', 'label', 'seed'];
  }

  #bar: HTMLElement | null = null;
  #canvas: HTMLCanvasElement | null = null;
  #ctx: CanvasRenderingContext2D | null = null;
  #value: HTMLElement | null = null;
  #resize: ResizeObserver | null = null;
  #width = 0;
  #height = 0;

  #land: Float32Array<ArrayBuffer> = new Float32Array(0);
  #buckets: Float32Array[] = [];
  #bucketCounts = new Int32Array(DEPTH_BUCKETS);
  #satellites: Satellite[] = [];

  #color: Rgb = { r: 124, g: 92, b: 255 };
  #accent: Rgb = { r: 94, g: 242, b: 255 };
  #danger: Rgb = { r: 255, g: 93, b: 108 };
  #colorStr = '#7c5cff';
  #accentStr = '#5ef2ff';
  #dangerStr = '#ff5d6c';
  #ocean: CanvasGradient | string = '#0b0d22';
  #halo: CanvasGradient | string = 'transparent';

  /** Target progress (0..1) or `null` when indeterminate. */
  #target: number | null = null;
  /** Displayed progress, eased towards the target. */
  #shown = 0;
  /** Blend between indeterminate (0) and determinate (1) ring styles. */
  #determinate = 0;
  #doneAt = -Infinity;
  #completed = false;
  #errorMix = 0;
  #lastText = '';

  /** Current progress `0`-`1`, or `null` while indeterminate. Reflects to `progress`. */
  get progress(): number | null {
    return this.#target;
  }
  set progress(value: number | null) {
    if (value == null || Number.isNaN(value)) this.removeAttribute('progress');
    else this.setAttribute('progress', String(clamp(value, 0, 1)));
  }

  /** Whether the loader shows its failed state. Reflects to `error`. */
  get error(): boolean {
    return this.hasAttribute('error');
  }
  set error(value: boolean) {
    this.toggleAttribute('error', Boolean(value));
  }

  /** Number of satellites (`1`-`6`). Reflects to `satellites`. */
  get satellites(): number {
    return Math.round(parseNumber(this.getAttribute('satellites'), 3, 1, MAX_SATELLITES));
  }
  set satellites(value: number) {
    this.setAttribute('satellites', String(value));
  }

  protected build(root: ShadowRoot): void {
    root.innerHTML = `<style>${STYLE}</style><div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100"><canvas aria-hidden="true"></canvas><span class="value" aria-hidden="true"></span></div>`;
    this.#bar = root.querySelector('.bar');
    this.#canvas = root.querySelector('canvas');
    this.#value = root.querySelector('.value');
    try {
      this.#ctx = this.#canvas?.getContext('2d') ?? null;
    } catch {
      this.#ctx = null; // e.g. test DOMs without canvas support
    }
    this.#target = this.#parseProgress();
    this.#shown = this.#target ?? 0;
    this.#determinate = this.#target == null ? 0 : 1;
    this.#completed = this.#target === 1;
    this.#errorMix = this.error ? 1 : 0;
    this.#generate();
    this.#syncColors();
    this.#syncAria();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (!this.#resize && typeof ResizeObserver === 'function') {
      this.#resize = new ResizeObserver(() => this.#fit());
      this.#resize.observe(this);
    }
    this.#fit();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#resize?.disconnect();
    this.#resize = null;
  }

  protected override attributeChanged(name: string): void {
    switch (name) {
      case 'progress': {
        const next = this.#parseProgress();
        if (next == null || next < 1) this.#completed = false;
        if (next != null && this.#target == null) this.#shown = 0; // start the ring from empty
        this.#target = next;
        if (this.reducedMotion && next != null) this.#shown = next;
        break;
      }
      case 'color':
      case 'accent':
        this.#syncColors();
        break;
      case 'seed':
        this.#generate();
        this.#project();
        break;
      case 'satellites':
        this.#generate();
        this.#project();
        break;
    }
    this.#syncAria();
    this.tick(0);
  }

  protected override motionChanged(): void {
    this.tick(0);
  }

  #parseProgress(): number | null {
    const raw = this.getAttribute('progress');
    if (raw == null || raw.trim() === '') return null;
    const percent = raw.trim().endsWith('%');
    const value = parseNumber(percent ? raw.trim().slice(0, -1) : raw, Number.NaN);
    if (Number.isNaN(value)) return null;
    return clamp(percent ? value / 100 : value, 0, 1);
  }

  #generate(): void {
    const seed = Math.round(parseNumber(this.getAttribute('seed'), 7));
    this.#land = generateLand(seed);
    const capacity = this.#land.length / 3;
    this.#buckets = Array.from({ length: DEPTH_BUCKETS }, () => new Float32Array(capacity * 2));
    const count = this.satellites;
    this.#satellites = Array.from({ length: count }, (_, i) => {
      // Per-index streams: adding a satellite never reshuffles the others.
      const random = createRandom(seed * 131 + i * 977 + 3);
      const radius = 1.3 + (count === 1 ? 0.14 : (i / (count - 1)) * 0.3) + random() * 0.03;
      return {
        radius,
        incline: (i % 2 ? -1 : 1) * (0.3 + random() * 0.75),
        node: random() * Math.PI * 2,
        rate: ((i % 2 ? -1 : 1) * 0.95) / Math.pow(radius, 1.5),
        phase: random() * Math.PI * 2,
        period: 1.7 + random() * 0.9,
        offset: random() * 3,
        path: new Float32Array((ORBIT_SEGMENTS + 1) * 3),
      };
    });
  }

  #syncColors(): void {
    const style = getComputedStyle(this);
    const pick = (attr: string | null, prop: string, fallback: string): string =>
      attr || style.getPropertyValue(prop).trim() || fallback;
    this.#colorStr = pick(this.getAttribute('color'), '--ane-orbit-color', '#7c5cff');
    this.#accentStr = pick(this.getAttribute('accent'), '--ane-orbit-accent', '#5ef2ff');
    this.#dangerStr = pick(null, '--ane-danger', '#ff5d6c');
    const ctx = this.#ctx;
    if (!ctx) return;
    this.#color = toRgb(ctx, this.#colorStr, this.#color);
    this.#accent = toRgb(ctx, this.#accentStr, this.#accent);
    this.#danger = toRgb(ctx, this.#dangerStr, this.#danger);
    this.#colorStr = rgba(this.#color, 1);
    this.#accentStr = rgba(this.#accent, 1);
    this.#dangerStr = rgba(this.#danger, 1);
    this.#gradients();
  }

  #syncAria(): void {
    const bar = this.#bar;
    if (!bar) return;
    bar.setAttribute('aria-label', this.getAttribute('label') || 'Loading data');
    const target = this.#target;
    if (target == null) bar.removeAttribute('aria-valuenow');
    else bar.setAttribute('aria-valuenow', String(Math.round(target * 100)));
    const text = this.error
      ? 'Failed'
      : target == null
        ? 'Loading'
        : target >= 1
          ? 'Complete'
          : `${Math.round(target * 100)}%`;
    bar.setAttribute('aria-valuetext', text);
  }

  /** Matches the canvas backing store to its CSS size and devicePixelRatio. */
  #fit(): void {
    const canvas = this.#canvas;
    if (!canvas) return;
    const dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
    const rect = this.getBoundingClientRect();
    this.#width = rect.width;
    this.#height = rect.height;
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    this.#ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (this.#value) this.#value.style.fontSize = `${Math.min(rect.width, rect.height) * 0.105}px`;
    this.#gradients();
    this.#project();
    this.tick(0);
  }

  get #geometry(): { cx: number; cy: number; s: number; globe: number; ring: number; line: number } {
    const s = Math.min(this.#width, this.#height);
    return { cx: this.#width / 2, cy: this.#height / 2, s, globe: s * 0.25, ring: s * 0.445, line: Math.max(2, s * 0.026) };
  }

  #gradients(): void {
    const ctx = this.#ctx;
    if (!ctx || !this.#width) return;
    const { cx, cy, globe } = this.#geometry;
    const ocean = ctx.createRadialGradient(cx - globe * 0.35, cy - globe * 0.4, globe * 0.1, cx, cy, globe);
    ocean.addColorStop(0, mix(this.#color, BLACK, 0.68));
    ocean.addColorStop(0.55, mix(this.#color, BLACK, 0.84));
    ocean.addColorStop(1, mix(this.#color, BLACK, 0.93));
    this.#ocean = ocean;
    const halo = ctx.createRadialGradient(cx, cy, globe * 0.92, cx, cy, globe * 1.28);
    halo.addColorStop(0, rgba(this.#color, 0.42));
    halo.addColorStop(0.35, rgba(this.#color, 0.14));
    halo.addColorStop(1, rgba(this.#color, 0));
    this.#halo = halo;
  }

  /** Orbit paths are static in screen space: project them once per resize. */
  #project(): void {
    const { globe } = this.#geometry;
    for (const sat of this.#satellites) {
      for (let i = 0; i <= ORBIT_SEGMENTS; i++) {
        const [x, y, z] = this.#orbitPoint(sat, (i / ORBIT_SEGMENTS) * Math.PI * 2);
        sat.path[i * 3] = x * globe;
        sat.path[i * 3 + 1] = y * globe;
        sat.path[i * 3 + 2] = z;
      }
    }
  }

  /** Satellite position for orbit angle `theta`, in view space (globe radius = 1, y up). */
  #orbitPoint(sat: Satellite, theta: number): [number, number, number] {
    const a = sat.radius;
    const ex = a * Math.cos(theta);
    const ez = a * Math.sin(theta);
    // Inclination about X, then the ascending node about Y, then the globe tilt.
    const iy = -ez * Math.sin(sat.incline);
    const iz = ez * Math.cos(sat.incline);
    const nx = ex * Math.cos(sat.node) + iz * Math.sin(sat.node);
    const nz = -ex * Math.sin(sat.node) + iz * Math.cos(sat.node);
    return [nx, tiltY(iy, nz), tiltZ(iy, nz)];
  }

  protected tick(deltaMs: number): void {
    const reduced = this.reducedMotion;
    const target = this.#target;
    const t = this.elapsed / 1000;

    // --- state ---------------------------------------------------------------
    if (target != null) {
      this.#shown = reduced ? target : damp(this.#shown, target, 5, deltaMs);
      if (Math.abs(this.#shown - target) < 0.0005) this.#shown = target;
    }
    this.#determinate = reduced
      ? target == null ? 0 : 1
      : damp(this.#determinate, target == null ? 0 : 1, 7, deltaMs);
    this.#errorMix = reduced ? (this.error ? 1 : 0) : damp(this.#errorMix, this.error ? 1 : 0, 8, deltaMs);
    if (target === 1 && this.#shown >= 0.999 && !this.#completed && !this.error) {
      this.#completed = true;
      this.#doneAt = this.elapsed;
      this.dispatchEvent(
        new CustomEvent<OrbitCompleteDetail>('ane-complete', {
          detail: { at: this.elapsed },
          bubbles: true,
          composed: true,
        }),
      );
    }
    const text = target == null ? '' : `${Math.round(this.#shown * 100)}%`;
    if (text !== this.#lastText && this.#value) {
      this.#value.textContent = text;
      this.#lastText = text;
    }

    // --- render --------------------------------------------------------------
    const ctx = this.#ctx;
    if (!ctx || !this.#width) return;
    const { cx, cy, s, globe, ring, line } = this.#geometry;
    const done = this.#completed && !this.error;
    const burst = clamp((this.elapsed - this.#doneAt) / DONE_BURST, 0, 1);
    const bursting = done && burst < 1 && !reduced;
    const spin = reduced ? 0.6 : t * 0.22 + 0.6;
    const loading = !done && !this.error;

    ctx.clearRect(0, 0, this.#width, this.#height);

    // Satellite positions for this frame.
    const sats = this.#satellites.map((sat) => {
      const theta = sat.phase + (reduced ? 0 : t * sat.rate);
      const [x, y, z] = this.#orbitPoint(sat, theta);
      return { sat, theta, x, y, z };
    });

    // Back half of the orbits and satellites behind the planet.
    this.#drawOrbits(ctx, cx, cy, false);
    for (const p of sats) if (p.z < 0) this.#drawSatellite(ctx, cx, cy, globe, s, p, reduced);

    // Planet: halo, ocean, graticule, land dots.
    ctx.fillStyle = this.#halo;
    ctx.beginPath();
    ctx.arc(cx, cy, globe * 1.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = this.#ocean;
    ctx.beginPath();
    ctx.arc(cx, cy, globe, 0, Math.PI * 2);
    ctx.fill();
    this.#drawGraticule(ctx, cx, cy, globe, spin);
    this.#drawLand(ctx, cx, cy, globe, s, spin, bursting ? 1 - burst : 0);
    ctx.strokeStyle = this.#colorStr;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = Math.max(1, s * 0.004);
    ctx.beginPath();
    ctx.arc(cx, cy, globe, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Front half of the orbits, downlinks and front satellites.
    this.#drawOrbits(ctx, cx, cy, true);
    if (loading && !reduced) {
      for (const p of sats) if (p.z > 0) this.#drawDownlink(ctx, cx, cy, globe, s, p, t);
    }
    for (const p of sats) if (p.z >= 0) this.#drawSatellite(ctx, cx, cy, globe, s, p, reduced);

    // Completion shockwave.
    if (bursting) {
      const e = easeOutCubic(burst);
      ctx.strokeStyle = this.#accentStr;
      ctx.globalAlpha = (1 - burst) * 0.8;
      ctx.lineWidth = Math.max(1.5, s * 0.012 * (1 - burst));
      ctx.beginPath();
      ctx.arc(cx, cy, globe + (ring - globe) * e, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    this.#drawRing(ctx, cx, cy, ring, line, t, reduced, done, bursting ? 1 - burst : 0);
  }

  #drawOrbits(ctx: CanvasRenderingContext2D, cx: number, cy: number, front: boolean): void {
    ctx.strokeStyle = this.#accentStr;
    ctx.lineWidth = 1;
    ctx.globalAlpha = (front ? 0.3 : 0.13) * (1 - this.#errorMix * 0.4);
    ctx.beginPath();
    for (const sat of this.#satellites) {
      const path = sat.path;
      let pen = false;
      for (let i = 0; i <= ORBIT_SEGMENTS; i++) {
        const z = path[i * 3 + 2]!;
        if (z >= 0 === front) {
          const x = cx + path[i * 3]!;
          const y = cy - path[i * 3 + 1]!;
          if (pen) ctx.lineTo(x, y);
          else ctx.moveTo(x, y);
          pen = true;
        } else {
          pen = false;
        }
      }
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  #drawGraticule(ctx: CanvasRenderingContext2D, cx: number, cy: number, globe: number, spin: number): void {
    ctx.strokeStyle = this.#colorStr;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.2;
    ctx.beginPath();
    const plot = (lat: number, lon: number, first: boolean): boolean => {
      const cl = Math.cos(lat);
      const x0 = cl * Math.sin(lon + spin);
      const y0 = Math.sin(lat);
      const z0 = cl * Math.cos(lon + spin);
      const z = tiltZ(y0, z0);
      if (z < 0) return false;
      const x = cx + x0 * globe;
      const y = cy - tiltY(y0, z0) * globe;
      if (first) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
      return true;
    };
    for (let m = 0; m < 12; m++) {
      const lon = (m / 12) * Math.PI * 2;
      let pen = false;
      for (let i = 0; i <= 20; i++) pen = plot(-Math.PI / 2 + (i / 20) * Math.PI, lon, !pen);
    }
    for (const lat of [-1.05, -0.52, 0, 0.52, 1.05]) {
      let pen = false;
      for (let i = 0; i <= 40; i++) pen = plot(lat, (i / 40) * Math.PI * 2, !pen);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  #drawLand(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    globe: number,
    s: number,
    spin: number,
    flash: number,
  ): void {
    const land = this.#land;
    const counts = this.#bucketCounts;
    counts.fill(0);
    const cs = Math.cos(spin);
    const sn = Math.sin(spin);
    const ct = Math.cos(TILT);
    const st = Math.sin(TILT);
    for (let i = 0; i < land.length; i += 3) {
      const x = land[i]!;
      const y = land[i + 1]!;
      const z = land[i + 2]!;
      const x1 = x * cs + z * sn;
      const z1 = -x * sn + z * cs;
      const z2 = y * st + z1 * ct;
      if (z2 <= 0.04) continue;
      const b = Math.min(DEPTH_BUCKETS - 1, Math.floor(z2 * DEPTH_BUCKETS));
      const bucket = this.#buckets[b]!;
      const n = counts[b]!;
      bucket[n * 2] = cx + x1 * globe;
      bucket[n * 2 + 1] = cy - (y * ct - z1 * st) * globe;
      counts[b] = n + 1;
    }
    const base = Math.max(0.9, s * 0.0072);
    for (let b = 0; b < DEPTH_BUCKETS; b++) {
      const depth = (b + 0.5) / DEPTH_BUCKETS;
      const r = base * (0.65 + 0.45 * depth);
      const bucket = this.#buckets[b]!;
      ctx.beginPath();
      for (let n = 0; n < counts[b]!; n++) {
        const x = bucket[n * 2]!;
        const y = bucket[n * 2 + 1]!;
        ctx.moveTo(x + r, y);
        ctx.arc(x, y, r, 0, Math.PI * 2);
      }
      ctx.fillStyle = this.#colorStr;
      ctx.globalAlpha = 0.25 + 0.75 * depth;
      ctx.fill();
      // Lighter cores keep the dots readable on dark planets.
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = (0.08 + 0.3 * depth) * (1 - flash);
      ctx.fill();
      if (flash > 0) {
        ctx.fillStyle = this.#accentStr;
        ctx.globalAlpha = flash * depth;
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  #drawDownlink(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    globe: number,
    s: number,
    p: { sat: Satellite; x: number; y: number; z: number },
    t: number,
  ): void {
    // Ground station = the point on the surface directly below the satellite.
    const len = Math.hypot(p.x, p.y, p.z);
    const gz = p.z / len;
    if (gz < 0.12) return;
    const sx = cx + p.x * globe;
    const sy = cy - p.y * globe;
    const gx = cx + (p.x / len) * globe;
    const gy = cy - (p.y / len) * globe;
    const u = ((t + p.sat.offset) / p.sat.period) % 1;
    const fade = clamp((gz - 0.12) / 0.2, 0, 1);

    // Faint beam while the link is open.
    const open = u < 0.62 ? Math.min(1, u / 0.08) : Math.max(0, 1 - (u - 0.62) / 0.2);
    if (open > 0) {
      ctx.strokeStyle = this.#accentStr;
      ctx.lineWidth = Math.max(1, s * 0.0055);
      ctx.globalAlpha = 0.5 * open * fade;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(gx, gy);
      ctx.stroke();
    }
    // Packets: three dots travelling down the beam.
    ctx.fillStyle = '#ffffff';
    for (let k = 0; k < 3; k++) {
      const q = (u - k * 0.07) / 0.45;
      if (q <= 0 || q >= 1) continue;
      const e = q * q;
      ctx.globalAlpha = fade * (1 - k * 0.3) * (1 - q * 0.3);
      ctx.beginPath();
      ctx.arc(sx + (gx - sx) * e, sy + (gy - sy) * e, Math.max(1, s * (0.012 - k * 0.0025)), 0, Math.PI * 2);
      ctx.fill();
    }
    // Ground ping, flattened by the surface angle.
    const ping = (u - 0.45) / 0.55;
    if (ping > 0) {
      const r = s * 0.014 + s * 0.065 * easeOutCubic(ping);
      ctx.strokeStyle = this.#accentStr;
      ctx.lineWidth = Math.max(1, s * 0.005);
      ctx.globalAlpha = (1 - ping) * 0.9 * fade;
      ctx.beginPath();
      ctx.ellipse(gx, gy, r, r * (0.35 + 0.65 * gz), Math.atan2(gy - cy, gx - cx), 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = this.#accentStr;
      ctx.globalAlpha = (1 - ping) * fade;
      ctx.beginPath();
      ctx.arc(gx, gy, Math.max(1, s * 0.008), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  #drawSatellite(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    globe: number,
    s: number,
    p: { sat: Satellite; theta: number; x: number; y: number; z: number },
    reduced: boolean,
  ): void {
    const { sat, theta } = p;
    const x = cx + p.x * globe;
    const y = cy - p.y * globe;
    const depth = 0.75 + 0.25 * clamp(p.z / sat.radius, -1, 1);
    const behind = p.z < 0 ? 0.55 : 1;
    const tint = this.#errorMix > 0.5 ? this.#dangerStr : this.#accentStr;
    const dir = Math.sign(sat.rate) || 1;

    // Comet trail along the orbit (skipped in reduced motion: nothing is moving).
    if (!reduced) {
      ctx.strokeStyle = tint;
      ctx.lineWidth = Math.max(1, s * 0.006) * depth;
      ctx.lineCap = 'round';
      let px = x;
      let py = y;
      for (let i = 1; i <= TRAIL_SEGMENTS; i++) {
        const [tx, ty] = this.#orbitPoint(sat, theta - dir * i * 0.045);
        const nx = cx + tx * globe;
        const ny = cy - ty * globe;
        ctx.globalAlpha = 0.55 * (1 - i / (TRAIL_SEGMENTS + 1)) * behind;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(nx, ny);
        ctx.stroke();
        px = nx;
        py = ny;
      }
      ctx.lineCap = 'butt';
    }

    // Body with two solar panels across the direction of travel.
    const [ax, ay] = this.#orbitPoint(sat, theta + dir * 0.05);
    const angle = Math.atan2(-(ay - p.y), ax - p.x);
    const r = s * 0.016 * depth;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle + Math.PI / 2);
    ctx.fillStyle = tint;
    ctx.globalAlpha = 0.18 * behind;
    ctx.beginPath();
    ctx.arc(0, 0, r * 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.9 * behind;
    ctx.fillRect(-r * 2.7, -r * 0.45, r * 1.5, r * 0.9);
    ctx.fillRect(r * 1.2, -r * 0.45, r * 1.5, r * 0.9);
    ctx.globalAlpha = behind;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.85, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  #drawRing(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    ring: number,
    line: number,
    t: number,
    reduced: boolean,
    done: boolean,
    flash: number,
  ): void {
    const top = -Math.PI / 2;
    const tint = this.#errorMix > 0.5 ? this.#dangerStr : this.#accentStr;
    ctx.lineCap = 'round';

    // Track and quarter ticks.
    ctx.strokeStyle = this.#colorStr;
    ctx.globalAlpha = 0.16;
    ctx.lineWidth = line;
    ctx.beginPath();
    ctx.arc(cx, cy, ring, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = Math.max(1, line * 0.18);
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const a = top + (i * Math.PI) / 2;
      ctx.moveTo(cx + Math.cos(a) * (ring + line * 0.9), cy + Math.sin(a) * (ring + line * 0.9));
      ctx.lineTo(cx + Math.cos(a) * (ring + line * 1.5), cy + Math.sin(a) * (ring + line * 1.5));
    }
    ctx.stroke();

    // Determinate arc and indeterminate comet are cross-faded while switching modes.
    const d = this.#determinate;
    const arcs: Array<[number, number, number]> = [];
    if (d > 0.01) arcs.push([top, top + Math.PI * 2 * this.#shown, d]);
    if (d < 0.99) {
      if (reduced) {
        arcs.push([top - 0.5, top + 0.5, (1 - d) * (0.55 + 0.35 * Math.sin(t * 2.2))]);
      } else {
        const head = t * 4.2;
        const length = 0.5 + 1.1 * (0.5 + 0.5 * Math.sin(t * 2.1));
        arcs.push([top + head - length, top + head, 1 - d]);
      }
    }
    for (const [from, to, alpha] of arcs) {
      if (to - from < 0.001) continue;
      // Soft glow underneath, then the crisp arc, then a bright head.
      ctx.strokeStyle = tint;
      ctx.globalAlpha = alpha * (0.22 + (done ? 0.18 + 0.25 * flash : 0));
      ctx.lineWidth = line * (2.1 + flash);
      ctx.beginPath();
      ctx.arc(cx, cy, ring, from, to);
      ctx.stroke();
      ctx.globalAlpha = alpha;
      ctx.lineWidth = line;
      ctx.beginPath();
      ctx.arc(cx, cy, ring, from, to);
      ctx.stroke();
      if (!done) {
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = alpha * 0.95;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(to) * ring, cy + Math.sin(to) * ring, line * 0.34, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    ctx.lineCap = 'butt';
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ane-orbit-loader': OrbitLoaderElement;
  }
  interface HTMLElementEventMap {
    'ane-complete': CustomEvent<OrbitCompleteDetail>;
  }
}

/** Registers `<ane-orbit-loader>` (or a custom tag name). Safe to call more than once. */
export function defineOrbitLoader(tag = 'ane-orbit-loader'): void {
  defineElement(tag, OrbitLoaderElement);
}
