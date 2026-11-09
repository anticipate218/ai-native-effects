import { defineElement, EffectElement } from '../../core/effect-element';
import { clamp, createRandom, damp, easeOutCubic, parseNumber } from '../../core/math';
import { PlanetRenderer } from './planet-gl';

const STYLE = /* css */ `
:host {
  --_bg: var(--ane-screen-bg, #03060e);
  --_text: var(--ane-screen-text, #eef2ff);
  --_muted: rgba(226, 232, 255, 0.72);
  --_dim: rgba(226, 232, 255, 0.58);
  display: block;
  position: relative;
  width: 100%;
  height: var(--ane-size, 480px);
  min-height: 300px;
  overflow: hidden;
  color: var(--_text);
  background: var(--_bg);
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
  -webkit-font-smoothing: antialiased;
  contain: layout paint style;
}
:host([hidden]) { display: none; }
:host([fullscreen]) {
  position: fixed;
  inset: 0;
  width: auto;
  height: auto;
  z-index: var(--ane-screen-z, 2147483000);
}
.screen { position: absolute; inset: 0; container: screen / size; --_tone: #5ef2ff; --_mark: #5ef2ff; }
canvas { position: absolute; display: block; pointer-events: none; }
.bg, .fx { left: 0; top: 0; width: 100%; height: 100%; }

.panel {
  position: absolute;
  left: clamp(24px, 6.5cqi, 140px);
  top: 50%;
  width: clamp(280px, 36cqi, 560px);
  transform: translateY(-50%);
}
.eyebrow {
  margin: 0 0 clamp(12px, 1.2cqi, 20px);
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: clamp(11px, 0.85cqi, 14px);
  font-weight: 650;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--_muted);
}
.beacon {
  width: 7px;
  height: 7px;
  flex: none;
  border-radius: 50%;
  background: var(--_tone);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--_tone) 16%, transparent), 0 0 14px var(--_tone);
}
.heading {
  margin: 0;
  font-size: clamp(20px, 2.5cqi, 46px);
  line-height: 1.16;
  font-weight: 600;
  letter-spacing: -0.015em;
  text-wrap: balance;
}
.meter { margin-top: clamp(14px, 2.8cqi, 30px); }
.value {
  display: flex;
  align-items: flex-start;
  font-size: clamp(46px, 7.2cqi, 140px);
  font-weight: 250;
  line-height: 0.92;
  letter-spacing: -0.045em;
  font-variant-numeric: tabular-nums;
}
.value .unit {
  margin: 0.2em 0 0 0.1em;
  font-size: 0.34em;
  font-weight: 400;
  letter-spacing: 0;
  color: var(--_muted);
}
.bar {
  position: relative;
  height: 2px;
  margin-top: clamp(12px, 2cqi, 20px);
  border-radius: 2px;
  background: rgba(226, 232, 255, 0.12);
  /* Clip the indeterminate sweep to the track, but let the head glow overflow vertically. */
  clip-path: inset(-8px -8px -8px 0);
}
.fill, .sweep {
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  border-radius: inherit;
  transform-origin: 0 50%;
}
.fill {
  width: 100%;
  transform: scaleX(0);
  background: linear-gradient(90deg, color-mix(in srgb, var(--_tone) 25%, transparent), var(--_tone));
}
.sweep {
  width: 30%;
  opacity: 0;
  background: linear-gradient(90deg, transparent, var(--_tone), transparent);
}
.head {
  position: absolute;
  left: -3px;
  top: -2px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 0 8px 2px var(--_tone);
}
.steps {
  list-style: none;
  margin: clamp(18px, 3cqi, 30px) 0 0;
  padding: 0;
  display: grid;
  gap: clamp(10px, 0.9cqi, 16px);
  font-size: clamp(13px, 1.05cqi, 18px);
}
.steps li { display: flex; align-items: center; gap: 12px; color: var(--_dim); }
.steps li[data-status="done"] { color: var(--_muted); }
.steps li[data-status="active"], .steps li[data-status="failed"] { color: var(--_text); }
.idx { display: none; margin-left: auto; color: var(--_dim); font-variant-numeric: tabular-nums; }
.mark { width: 1.18em; height: 1.18em; flex: none; overflow: visible; }
.mark * { fill: none; stroke-width: 1.4; stroke-linecap: round; stroke-linejoin: round; }
.mark .ring { stroke: rgba(226, 232, 255, 0.28); }
.mark .arc, .mark .check, .mark .cross { stroke: var(--_tone); opacity: 0; }
.mark .arc { stroke-dasharray: 26 100; transform-box: fill-box; transform-origin: center; }
li[data-status="done"] .ring { stroke: color-mix(in srgb, var(--_mark) 55%, transparent); fill: color-mix(in srgb, var(--_mark) 14%, transparent); }
li[data-status="done"] .check { opacity: 1; stroke: var(--_mark); }
li[data-status="active"] .arc { opacity: 1; }
li[data-status="active"] .ring { stroke: rgba(226, 232, 255, 0.18); }
li[data-status="failed"] .ring { stroke: var(--_tone); }
li[data-status="failed"] .cross { opacity: 1; }
.detail {
  margin: clamp(16px, 2.6cqi, 32px) 0 0;
  font-size: clamp(12.5px, 0.95cqi, 16px);
  color: var(--_muted);
  font-variant-numeric: tabular-nums;
}
.status {
  margin: 6px 0 0;
  font: clamp(11.5px, 0.85cqi, 14px)/1.45 ui-monospace, "SFMono-Regular", "Cascadia Mono", Menlo, Consolas, monospace;
  color: var(--_dim);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.detail:empty, .status:empty, .steps:empty { display: none; }
.actions { margin-top: 22px; display: flex; flex-wrap: wrap; gap: 10px; }
.actions[hidden] { display: none; }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }

@container screen (max-height: 420px) {
  .status { display: none; }
}
@container screen (max-width: 639px), (max-height: 380px) {
  .steps { gap: 0; margin-top: 16px; }
  .steps li:not([data-status="active"]):not([data-status="failed"]) { display: none; }
  .idx { display: inline; }
}
@container screen (max-width: 639px) {
  .panel { left: 22px; right: 22px; top: auto; bottom: 24px; width: auto; transform: none; }
  .value { font-size: 52px; }
}
`;

const MARK = `<svg class="mark" viewBox="0 0 16 16" aria-hidden="true"><circle class="ring" cx="8" cy="8" r="6.6"/><circle class="arc" cx="8" cy="8" r="6.6" pathLength="100"/><path class="check" d="M5 8.3l2 2 4.1-4.4"/><path class="cross" d="M5.8 5.8l4.4 4.4M10.2 5.8l-4.4 4.4"/></svg>`;

export type StepStatus = 'done' | 'active' | 'pending' | 'failed';
export const SCREEN_DEFAULTS = { heading: 'Preparing your workspace', eyebrow: 'Loading' } as const;
export const MAX_SCREEN_SATELLITES = 4;
const STEP_TEXT: Record<StepStatus, string> = { done: 'done', active: 'in progress', pending: 'pending', failed: 'failed' };

/** Sun direction in view space: light from the upper left, night side on the right. */
const LIGHT = (() => {
  const v = [-0.78, 0.34, 0.52];
  const l = Math.hypot(v[0]!, v[1]!, v[2]!);
  return [v[0]! / l, v[1]! / l, v[2]! / l] as const;
})();
const ROLL = -0.36;
const PITCH = 0.3;
const SPIN_RATE = 0.045; // rad/s
const BURST_MS = 1800;
const ORBIT_SEGMENTS = 128;
const TRAIL = 1.7; // rad of glowing trail behind each satellite

export interface ScreenCompleteDetail {
  at: number;
}

interface Satellite {
  radius: number;
  incline: number;
  node: number;
  rate: number;
  phase: number;
  path: Float32Array;
}

interface Rgb {
  r: number;
  g: number;
  b: number;
}

type Vec3 = readonly [number, number, number];

const linear = (c: Rgb): Vec3 => [(c.r / 255) ** 2.2, (c.g / 255) ** 2.2, (c.b / 255) ** 2.2];
const rgba = (c: Rgb, a: number): string => `rgba(${c.r}, ${c.g}, ${c.b}, ${a})`;

function parseColor(ctx: CanvasRenderingContext2D | null, color: string, fallback: Rgb): Rgb {
  if (!ctx) return fallback;
  ctx.fillStyle = '#000';
  ctx.fillStyle = color;
  const value = String(ctx.fillStyle);
  if (/^#[0-9a-f]{6}$/i.test(value)) {
    return { r: parseInt(value.slice(1, 3), 16), g: parseInt(value.slice(3, 5), 16), b: parseInt(value.slice(5, 7), 16) };
  }
  const parts = value.match(/[\d.]+/g);
  return parts && parts.length >= 3 ? { r: +parts[0]!, g: +parts[1]!, b: +parts[2]! } : fallback;
}

/** Row-major 3×3 product. */
function mul(a: number[], b: number[]): number[] {
  const out = new Array<number>(9);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) out[r * 3 + c] = a[r * 3]! * b[c]! + a[r * 3 + 1]! * b[3 + c]! + a[r * 3 + 2]! * b[6 + c]!;
  }
  return out;
}
const rotX = (a: number): number[] => [1, 0, 0, 0, Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a)];
const rotY = (a: number): number[] => [Math.cos(a), 0, Math.sin(a), 0, 1, 0, -Math.sin(a), 0, Math.cos(a)];
const rotZ = (a: number): number[] => [Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a), 0, 0, 0, 1];
/** Equatorial frame → view (no spin): tilts the axis right and towards the viewer. */
const FRAME = mul(rotZ(ROLL), rotX(PITCH));
const apply = (m: number[], x: number, y: number, z: number): [number, number, number] => [
  m[0]! * x + m[1]! * y + m[2]! * z,
  m[3]! * x + m[4]! * y + m[5]! * z,
  m[6]! * x + m[7]! * y + m[8]! * z,
];

/** Parses `progress`: `0`-`1`, `0%`-`100%`, or `null` (indeterminate). */
export function parseProgress(raw: string | null): number | null {
  if (raw == null || raw.trim() === '') return null;
  const text = raw.trim();
  const percent = text.endsWith('%');
  const value = parseNumber(percent ? text.slice(0, -1) : text, Number.NaN);
  if (Number.isNaN(value)) return null;
  return clamp(percent ? value / 100 : value, 0, 1);
}

/** Splits the `steps` attribute (`"Sign in|Query catalog|Download"`). */
export function parseSteps(raw: string | null): string[] {
  return (raw ?? '')
    .split('|')
    .map((step) => step.trim())
    .filter(Boolean);
}

/** Status of step `index` given the active step, completion and error. */
export function stepStatus(index: number, active: number, complete: boolean, error: boolean): StepStatus {
  if (complete) return 'done';
  if (index < active) return 'done';
  if (index === active) return error ? 'failed' : 'active';
  return 'pending';
}

/**
 * `<ane-orbit-loading-screen>`: a full loading screen for data-heavy AI and geo apps.
 * A WebGL planet is "downloaded" tile by tile: unloaded regions show a low-resolution
 * preview, finished tiles switch to full detail, satellites sweep their swaths and a
 * typographic panel shows the percentage, steps and live details.
 *
 * @attr progress - `0`-`1` or `0%`-`100%`; omit for indeterminate
 * @attr heading - main line, default `Preparing your workspace`
 * @attr eyebrow - small caps line above the heading, default `Loading`
 * @attr steps - pipe-separated step labels, e.g. `Sign in|Query catalog|Download tiles`
 * @attr step - index of the active step (0-based)
 * @attr detail - secondary line (sizes, speed, ETA)
 * @attr status - monospace log line
 * @attr error - failed state
 * @attr satellites - `0`-`4`, default `2`
 * @attr accent - data and progress color, default `#5ef2ff`
 * @attr color - atmosphere color, default `#6aa6ff`
 * @attr fullscreen - covers the viewport (`position: fixed`)
 * @attr quality - `auto` | `high` | `low` render resolution
 * @attr size - height (CSS length), default `480px`; width follows the container
 * @attr speed, motion, seed, label
 * @slot actions - buttons under the panel (e.g. Cancel)
 * @fires ane-complete - once each time progress reaches 100%
 * @csspart screen, panel
 * @cssprop --ane-size, --ane-screen-bg, --ane-screen-text, --ane-screen-z, --ane-success, --ane-danger
 */
export class OrbitLoadingScreenElement extends EffectElement {
  static override get observedAttributes(): string[] {
    return [
      ...super.observedAttributes,
      'progress', 'heading', 'eyebrow', 'steps', 'step', 'detail', 'status', 'error',
      'satellites', 'accent', 'color', 'quality', 'label', 'seed',
    ];
  }

  #el = {} as {
    screen: HTMLElement;
    bg: HTMLCanvasElement;
    gl: HTMLCanvasElement;
    fx: HTMLCanvasElement;
    panel: HTMLElement;
    eyebrow: HTMLElement;
    beacon: HTMLElement;
    heading: HTMLElement;
    meter: HTMLElement;
    value: HTMLElement;
    num: HTMLElement;
    unit: HTMLElement;
    bar: HTMLElement;
    fill: HTMLElement;
    sweep: HTMLElement;
    head: HTMLElement;
    steps: HTMLOListElement;
    detail: HTMLElement;
    status: HTMLElement;
    actions: HTMLElement;
  };
  #bg: CanvasRenderingContext2D | null = null;
  #fx: CanvasRenderingContext2D | null = null;
  #planet: PlanetRenderer | null = null;
  #resize: ResizeObserver | null = null;

  // Layout (CSS px).
  #w = 0;
  #h = 0;
  #cx = 0;
  #cy = 0;
  #radius = 0;
  #barWidth = 0;
  #dpr = 1;
  #quality = 1;
  #frameTimes: number[] = [];
  #lastReal = 0;

  #accent: Rgb = { r: 94, g: 242, b: 255 };
  #atmo: Rgb = { r: 106, g: 166, b: 255 };
  #danger: Rgb = { r: 255, g: 93, b: 108 };
  #success: Rgb = { r: 61, g: 220, b: 151 };
  #glow: HTMLCanvasElement | null = null;

  #satellites: Satellite[] = [];
  #twinkles: Array<{ x: number; y: number; r: number; rate: number; phase: number }> = [];

  #target: number | null = null;
  #shown = 0;
  #det = 0;
  #errorMix = 0;
  #completed = false;
  #doneAt = -Infinity;
  #lastNumber = -2;
  #fades = new Map<HTMLElement, number>();
  #activeArc: SVGElement | null = null;

  /** Progress `0`-`1`, or `null` while indeterminate. Reflects to `progress`. */
  get progress(): number | null {
    return this.#target;
  }
  set progress(value: number | null) {
    if (value == null || Number.isNaN(value)) this.removeAttribute('progress');
    else this.setAttribute('progress', String(clamp(value, 0, 1)));
  }

  /** Step labels. Reflects to `steps` (pipe-separated). */
  get steps(): string[] {
    return parseSteps(this.getAttribute('steps'));
  }
  set steps(value: string[]) {
    this.setAttribute('steps', value.map((s) => s.replace(/\|/g, '/')).join('|'));
  }

  /** Index of the active step. Reflects to `step`. */
  get step(): number {
    return Math.round(parseNumber(this.getAttribute('step'), 0, 0, 999));
  }
  set step(value: number) {
    this.setAttribute('step', String(value));
  }

  get error(): boolean {
    return this.hasAttribute('error');
  }
  set error(value: boolean) {
    this.toggleAttribute('error', Boolean(value));
  }

  get satellites(): number {
    return Math.round(parseNumber(this.getAttribute('satellites'), 2, 0, MAX_SCREEN_SATELLITES));
  }
  set satellites(value: number) {
    this.setAttribute('satellites', String(value));
  }

  /** Whether the planet is drawn with WebGL (`false` = 2D fallback). */
  get webgl(): boolean {
    return this.#planet != null;
  }

  protected build(root: ShadowRoot): void {
    root.innerHTML = `<style>${STYLE}</style>
<div class="screen" part="screen">
  <canvas class="bg" aria-hidden="true"></canvas>
  <canvas class="gl" aria-hidden="true"></canvas>
  <canvas class="fx" aria-hidden="true"></canvas>
  <section class="panel" part="panel">
    <p class="eyebrow"><i class="beacon"></i><span class="eyebrow-text"></span></p>
    <h2 class="heading" id="heading"></h2>
    <div class="meter" role="progressbar" aria-valuemin="0" aria-valuemax="100">
      <div class="value" aria-hidden="true"><span class="num">0</span><span class="unit">%</span></div>
      <div class="bar" aria-hidden="true"><i class="fill"></i><i class="sweep"></i><i class="head"></i></div>
    </div>
    <ol class="steps"></ol>
    <p class="detail"></p>
    <p class="status"></p>
    <div class="actions" hidden><slot name="actions"></slot></div>
  </section>
</div>`;
    const $ = <T extends Element>(selector: string): T => root.querySelector<T>(selector)!;
    this.#el = {
      screen: $('.screen'),
      bg: $('.bg'),
      gl: $('.gl'),
      fx: $('.fx'),
      panel: $('.panel'),
      eyebrow: $('.eyebrow-text'),
      beacon: $('.beacon'),
      heading: $('.heading'),
      meter: $('.meter'),
      value: $('.value'),
      num: $('.num'),
      unit: $('.unit'),
      bar: $('.bar'),
      fill: $('.fill'),
      sweep: $('.sweep'),
      head: $('.head'),
      steps: $('.steps'),
      detail: $('.detail'),
      status: $('.status'),
      actions: $('.actions'),
    };
    this.#bg = this.#context2d(this.#el.bg);
    this.#fx = this.#context2d(this.#el.fx);
    const slot = root.querySelector('slot')!;
    slot.addEventListener('slotchange', () => {
      this.#el.actions.hidden = slot.assignedElements().length === 0;
    });

    this.#target = parseProgress(this.getAttribute('progress'));
    this.#shown = this.#target ?? 0;
    this.#det = this.#target == null ? 0 : 1;
    this.#completed = this.#target === 1 && !this.error;
    if (this.#completed) this.#doneAt = -BURST_MS;
    this.#errorMix = this.error ? 1 : 0;
    this.#quality = this.#baseQuality();
    this.#syncColors();
    this.#syncText(false);
    this.#renderSteps();
    this.#syncMeter();
    this.#generate();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (!this.#planet) this.#initPlanet();
    if (!this.#resize && typeof ResizeObserver === 'function') {
      this.#resize = new ResizeObserver(() => this.#fit());
      this.#resize.observe(this);
      this.#resize.observe(this.#el.panel);
    }
    this.#fit();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#resize?.disconnect();
    this.#resize = null;
    // Free the WebGL context: pages that mount many loaders would otherwise hit the browser cap.
    if (this.#planet) {
      this.#planet.dispose();
      this.#planet = null;
      const fresh = this.#el.gl.cloneNode(false) as HTMLCanvasElement;
      this.#el.gl.replaceWith(fresh);
      this.#el.gl = fresh;
    }
  }

  protected override attributeChanged(name: string): void {
    switch (name) {
      case 'progress': {
        const next = parseProgress(this.getAttribute('progress'));
        if (next == null || next < 1) this.#completed = false;
        if (next != null && this.#target == null) this.#shown = 0;
        this.#target = next;
        if (this.reducedMotion && next != null) this.#shown = next;
        this.#syncMeter();
        this.#syncStatuses();
        this.#syncTone();
        break;
      }
      case 'heading':
      case 'eyebrow':
      case 'detail':
      case 'status':
      case 'label':
        this.#syncText(true, name);
        break;
      case 'steps':
        this.#renderSteps();
        break;
      case 'step':
        this.#syncStatuses();
        break;
      case 'error':
        if (this.error) this.#completed = false;
        this.#syncMeter();
        this.#syncStatuses();
        this.#syncTone();
        break;
      case 'accent':
      case 'color':
        this.#syncColors();
        this.#paintBackground();
        break;
      case 'quality':
        this.#quality = this.#baseQuality();
        this.#fit();
        break;
      case 'satellites':
        this.#generate();
        break;
      case 'seed':
        this.#generate();
        this.#planet?.bake(this.#seed());
        this.#fit();
        break;
    }
    this.tick(0);
  }

  protected override motionChanged(): void {
    if (this.reducedMotion && this.#target != null) this.#shown = this.#target;
    this.tick(0);
  }

  // --- setup ---------------------------------------------------------------------

  #context2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
    try {
      return canvas.getContext('2d');
    } catch {
      return null;
    }
  }

  #seed(): number {
    return Math.round(parseNumber(this.getAttribute('seed'), 7));
  }

  #baseQuality(): number {
    const q = this.getAttribute('quality');
    return q === 'low' ? 0.6 : 1;
  }

  #initPlanet(): void {
    this.#planet = PlanetRenderer.create(this.#el.gl, this.#seed());
    this.#el.gl.hidden = !this.#planet;
    this.#el.gl.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      this.#planet = null;
    });
  }

  #generate(): void {
    const seed = this.#seed();
    const count = this.satellites;
    this.#satellites = Array.from({ length: count }, (_, i) => {
      const random = createRandom(seed * 131 + i * 977 + 5);
      const radius = 1.2 + i * 0.13 + random() * 0.04;
      const sat: Satellite = {
        radius,
        incline: (i % 2 ? -1 : 1) * (0.55 + random() * 0.55),
        node: random() * Math.PI * 2,
        rate: 0.34 / Math.pow(radius, 1.5),
        phase: random() * Math.PI * 2,
        path: new Float32Array((ORBIT_SEGMENTS + 1) * 3),
      };
      for (let k = 0; k <= ORBIT_SEGMENTS; k++) {
        const [x, y, z] = this.#orbitPoint(sat, (k / ORBIT_SEGMENTS) * Math.PI * 2);
        sat.path.set([x, y, z], k * 3);
      }
      return sat;
    });
  }

  #orbitPoint(sat: Satellite, theta: number): [number, number, number] {
    const ex = sat.radius * Math.cos(theta);
    const ez = sat.radius * Math.sin(theta);
    const iy = -ez * Math.sin(sat.incline);
    const iz = ez * Math.cos(sat.incline);
    const nx = ex * Math.cos(sat.node) + iz * Math.sin(sat.node);
    const nz = -ex * Math.sin(sat.node) + iz * Math.cos(sat.node);
    return apply(FRAME, nx, iy, nz);
  }

  #syncColors(): void {
    const style = getComputedStyle(this);
    const ctx = this.#fx;
    this.#accent = parseColor(ctx, this.getAttribute('accent') || '#5ef2ff', { r: 94, g: 242, b: 255 });
    this.#atmo = parseColor(ctx, this.getAttribute('color') || '#6aa6ff', { r: 106, g: 166, b: 255 });
    this.#danger = parseColor(ctx, style.getPropertyValue('--ane-danger').trim() || '#ff5d6c', this.#danger);
    this.#success = parseColor(ctx, style.getPropertyValue('--ane-success').trim() || '#3ddc97', this.#success);
    this.#glow = this.#makeGlow();
    this.#syncTone();
  }

  #syncTone(): void {
    const tone = this.error ? this.#danger : this.#completed ? this.#success : this.#accent;
    this.#el.screen?.style.setProperty('--_tone', rgba(tone, 1));
    // Finished steps keep their colour when a later step fails.
    this.#el.screen?.style.setProperty('--_mark', rgba(this.error ? this.#accent : tone, 1));
  }

  /** Pre-rendered soft glow sprite for satellites (cheaper than shadowBlur). */
  #makeGlow(): HTMLCanvasElement | null {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    const ctx = this.#context2d(canvas);
    if (!ctx) return null;
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, rgba(this.#accent, 0.9));
    g.addColorStop(0.18, rgba(this.#accent, 0.35));
    g.addColorStop(1, rgba(this.#accent, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    return canvas;
  }

  #syncText(fade: boolean, only?: string): void {
    const set = (el: HTMLElement, text: string): void => {
      if (el.textContent === text) return;
      el.textContent = text;
      if (fade && !this.reducedMotion && text) this.#fades.set(el, this.elapsed);
    };
    if (!only || only === 'heading') set(this.#el.heading, this.getAttribute('heading') ?? SCREEN_DEFAULTS.heading);
    if (!only || only === 'eyebrow') set(this.#el.eyebrow, this.getAttribute('eyebrow') ?? SCREEN_DEFAULTS.eyebrow);
    if (!only || only === 'detail') set(this.#el.detail, this.getAttribute('detail') ?? '');
    if (!only || only === 'status') set(this.#el.status, this.getAttribute('status') ?? '');
    const label = this.getAttribute('label');
    if (label) {
      this.#el.meter.setAttribute('aria-label', label);
      this.#el.meter.removeAttribute('aria-labelledby');
    } else {
      this.#el.meter.setAttribute('aria-labelledby', 'heading');
      this.#el.meter.removeAttribute('aria-label');
    }
  }

  #renderSteps(): void {
    const steps = this.steps;
    this.#el.steps.innerHTML = steps
      .map(
        (label, i) =>
          `<li>${MARK}<span class="label"></span><span class="sr"></span><span class="idx" aria-hidden="true">${i + 1}/${steps.length}</span></li>`,
      )
      .join('');
    this.#el.steps.querySelectorAll('.label').forEach((node, i) => (node.textContent = steps[i]!));
    this.#syncStatuses();
  }

  #syncStatuses(): void {
    const active = this.step;
    this.#activeArc = null;
    this.#el.steps.querySelectorAll('li').forEach((li, i) => {
      const status = stepStatus(i, active, this.#completed, this.error);
      li.dataset.status = status;
      li.querySelector('.sr')!.textContent = `, ${STEP_TEXT[status]}`;
      if (status === 'active') {
        li.setAttribute('aria-current', 'step');
        this.#activeArc = li.querySelector('.arc');
      } else {
        li.removeAttribute('aria-current');
      }
    });
  }

  #syncMeter(): void {
    const meter = this.#el.meter;
    const target = this.#target;
    if (target == null) meter.removeAttribute('aria-valuenow');
    else meter.setAttribute('aria-valuenow', String(Math.round(target * 100)));
    meter.setAttribute(
      'aria-valuetext',
      this.error ? 'Failed' : target == null ? 'Loading' : target >= 1 ? 'Complete' : `${Math.round(target * 100)}%`,
    );
  }

  // --- layout --------------------------------------------------------------------

  #fit(): void {
    const rect = this.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const w = rect.width;
    const h = rect.height;
    this.#w = w;
    this.#h = h;
    this.#dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
    const panel = this.#el.panel.getBoundingClientRect();
    if (w >= 640) {
      const left = panel.right - rect.left + w * 0.03;
      const region = Math.max(w - left, w * 0.4);
      this.#radius = Math.max(40, Math.min(h * 0.34, region * 0.34));
      this.#cx = left + region * 0.5;
      this.#cy = h * 0.5;
    } else {
      const top = Math.max(panel.top - rect.top, h * 0.32);
      this.#radius = Math.max(36, Math.min(w * 0.33, top * 0.34));
      this.#cx = w * 0.5;
      this.#cy = top * 0.5 + 4;
    }
    this.#barWidth = this.#el.bar.getBoundingClientRect().width;

    for (const canvas of [this.#el.bg, this.#el.fx]) {
      canvas.width = Math.max(1, Math.round(w * this.#dpr));
      canvas.height = Math.max(1, Math.round(h * this.#dpr));
    }
    this.#bg?.setTransform(this.#dpr, 0, 0, this.#dpr, 0, 0);
    this.#fx?.setTransform(this.#dpr, 0, 0, this.#dpr, 0, 0);
    this.#fitPlanetCanvas();
    this.#paintBackground();
    this.tick(0);
  }

  /** The WebGL canvas only covers the planet and its halo, at a quality-scaled resolution. */
  #fitPlanetCanvas(): void {
    const canvas = this.#el.gl;
    const size = this.#radius * 2.6;
    canvas.style.left = `${this.#cx - size / 2}px`;
    canvas.style.top = `${this.#cy - size / 2}px`;
    canvas.style.width = canvas.style.height = `${size}px`;
    const device = Math.min(2048, Math.round(size * this.#dpr * this.#quality));
    canvas.width = canvas.height = Math.max(1, device);
  }

  #paintBackground(): void {
    const ctx = this.#bg;
    if (!ctx || !this.#w) return;
    const w = this.#w;
    const h = this.#h;
    const R = this.#radius;
    ctx.clearRect(0, 0, w, h);
    // Soft nebula around the planet and a faint accent bloom near the panel.
    let g = ctx.createRadialGradient(this.#cx, this.#cy, R * 0.8, this.#cx, this.#cy, R * 3.4);
    g.addColorStop(0, rgba(this.#atmo, 0.13));
    g.addColorStop(1, rgba(this.#atmo, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    g = ctx.createRadialGradient(w * 0.12, h * 0.85, 0, w * 0.12, h * 0.85, Math.max(w, h) * 0.6);
    g.addColorStop(0, rgba(this.#accent, 0.05));
    g.addColorStop(1, rgba(this.#accent, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // Stars: density follows area; a few are tinted.
    const random = createRandom(this.#seed() * 17 + 3);
    const count = Math.round((w * h) / 1400);
    this.#twinkles = [];
    for (let i = 0; i < count; i++) {
      const x = random() * w;
      const y = random() * h;
      const m = random();
      const r = m > 0.985 ? 1.25 : m > 0.9 ? 0.85 : 0.55;
      const a = 0.18 + random() * (m > 0.9 ? 0.7 : 0.4);
      const tint = random();
      ctx.fillStyle = tint > 0.9 ? `rgba(255, 214, 170, ${a})` : tint > 0.75 ? `rgba(170, 200, 255, ${a})` : `rgba(235, 240, 255, ${a})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      if (m > 0.985 && this.#twinkles.length < 16) {
        this.#twinkles.push({ x, y, r: 3 + random() * 3, rate: 0.6 + random() * 1.2, phase: random() * 6.28 });
      }
    }
    // Vignette.
    g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.hypot(w, h) * 0.62);
    g.addColorStop(0, 'rgba(0, 0, 0, 0)');
    g.addColorStop(1, 'rgba(0, 0, 0, 0.55)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    if (!this.#planet) this.#paintFallbackPlanet(ctx);
  }

  /** Without WebGL: a lit sphere with an atmosphere rim, painted once. */
  #paintFallbackPlanet(ctx: CanvasRenderingContext2D): void {
    const { r, g, b } = this.#atmo;
    const R = this.#radius;
    const halo = ctx.createRadialGradient(this.#cx, this.#cy, R * 0.95, this.#cx, this.#cy, R * 1.25);
    halo.addColorStop(0, rgba(this.#atmo, 0.45));
    halo.addColorStop(1, rgba(this.#atmo, 0));
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(this.#cx, this.#cy, R * 1.25, 0, Math.PI * 2);
    ctx.fill();
    const body = ctx.createRadialGradient(this.#cx - R * 0.45, this.#cy - R * 0.3, R * 0.05, this.#cx, this.#cy, R);
    body.addColorStop(0, `rgb(${(r * 0.35) | 0}, ${(g * 0.45) | 0}, ${(b * 0.55) | 0})`);
    body.addColorStop(0.7, `rgb(${(r * 0.08) | 0}, ${(g * 0.12) | 0}, ${(b * 0.18) | 0})`);
    body.addColorStop(1, '#02040a');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(this.#cx, this.#cy, R, 0, Math.PI * 2);
    ctx.fill();
  }

  // --- frame ---------------------------------------------------------------------

  protected tick(deltaMs: number): void {
    const reduced = this.reducedMotion;
    const target = this.#target;

    if (target != null) {
      this.#shown = reduced ? target : damp(this.#shown, target, 5, deltaMs);
      if (Math.abs(this.#shown - target) < 0.002) this.#shown = target;
    }
    const det = target == null ? 0 : 1;
    this.#det = reduced ? det : damp(this.#det, det, 6, deltaMs);
    this.#errorMix = reduced ? (this.error ? 1 : 0) : damp(this.#errorMix, this.error ? 1 : 0, 6, deltaMs);
    if (target === 1 && this.#shown >= 0.9995 && !this.#completed && !this.error) {
      this.#completed = true;
      this.#doneAt = this.elapsed;
      this.#syncStatuses();
      this.#syncTone();
      this.#syncMeter();
      this.dispatchEvent(
        new CustomEvent<ScreenCompleteDetail>('ane-complete', { detail: { at: this.elapsed }, bubbles: true, composed: true }),
      );
    }

    this.#adaptQuality(deltaMs);
    this.#updatePanel(reduced);
    this.#renderPlanet(reduced);
    this.#renderOverlay(reduced);
  }

  /** `quality="auto"`: lowers the WebGL resolution when frames take too long. */
  #adaptQuality(deltaMs: number): void {
    if (!this.#planet || deltaMs === 0 || this.getAttribute('quality') || typeof performance === 'undefined') return;
    const now = performance.now();
    if (this.#lastReal) this.#frameTimes.push(now - this.#lastReal);
    this.#lastReal = now;
    if (this.#frameTimes.length < 60) return;
    const average = this.#frameTimes.reduce((a, b) => a + b, 0) / this.#frameTimes.length;
    this.#frameTimes = [];
    if (average > 26 && this.#quality > 0.5) {
      this.#quality = Math.max(0.5, this.#quality - 0.15);
      this.#fitPlanetCanvas();
    }
  }

  #updatePanel(reduced: boolean): void {
    const el = this.#el;
    const t = this.elapsed / 1000;
    const det = this.#det;
    const shown = this.#shown;

    // Indeterminate shows an em dash in the same slot, so the layout never jumps.
    const number = det < 0.5 ? -1 : Math.min(100, Math.floor(shown * 100 + 1e-6));
    if (number !== this.#lastNumber) {
      el.num.textContent = number < 0 ? '—' : String(number);
      this.#lastNumber = number;
    }
    el.num.style.opacity = String(number < 0 ? 0.4 : 1);
    el.unit.style.opacity = String(det);
    el.fill.style.transform = `scaleX(${shown})`;
    el.fill.style.opacity = String(det);
    el.head.style.transform = `translateX(${shown * this.#barWidth}px)`;
    el.head.style.opacity = String(det * (this.#completed ? 0 : 1));
    const sweep = reduced ? 0.35 : ((t * 0.5) % 1.3) - 0.3;
    el.sweep.style.transform = `translateX(${sweep * this.#barWidth}px)`;
    el.sweep.style.opacity = String((1 - det) * (reduced ? 0.6 : 1));

    const loading = !this.#completed && !this.error;
    el.beacon.style.opacity = String(loading && !reduced ? 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(t * 3.2)) : 1);
    if (this.#activeArc) {
      this.#activeArc.style.transform = `rotate(${reduced ? 0 : (t * 300) % 360}deg)`;
    }

    for (const [node, start] of this.#fades) {
      const k = clamp((this.elapsed - start) / 380, 0, 1);
      const e = easeOutCubic(k);
      node.style.opacity = String(e);
      node.style.transform = k < 1 ? `translateY(${(1 - e) * 6}px)` : '';
      if (k >= 1) this.#fades.delete(node);
    }
  }

  #renderPlanet(reduced: boolean): void {
    const planet = this.#planet;
    if (!planet || !this.#w) return;
    const t = this.elapsed / 1000;
    const spin = reduced ? 0.9 : 0.9 + t * SPIN_RATE;
    // View → object = (FRAME · RotY(spin))ᵀ; a row-major matrix read as column-major is its transpose.
    const rotation = new Float32Array(mul(FRAME, rotY(spin)));
    const burstT = (this.elapsed - this.#doneAt) / BURST_MS;
    const bursting = this.#completed && burstT < 1 && !reduced;
    const canvas = this.#el.gl;
    planet.render({
      centerX: canvas.width / 2,
      centerY: canvas.height / 2,
      radius: (canvas.width / 2.6) * 1,
      rotation,
      light: LIGHT,
      cloud: reduced ? 0 : t * 0.0012,
      progress: this.#shown,
      determinate: this.#det,
      scan: reduced ? 0.35 : (t * 0.07) % 1.1,
      burst: bursting ? burstT : -1,
      done: this.#completed && !this.error ? clamp(burstT * 1.4, 0, 1) : 0,
      error: this.#errorMix,
      order: this.#seed() % 12,
      sea: 0.525,
      atmosphere: linear(this.#atmo),
      accent: linear(this.#accent),
      danger: linear(this.#danger),
      // Texels per device pixel at the disc center: 1024 / 2π ≈ 163.
      lod: Math.log2(Math.max(1, 163 / Math.max(1, canvas.width / 2.6))),
    });
  }

  #renderOverlay(reduced: boolean): void {
    const ctx = this.#fx;
    if (!ctx || !this.#w) return;
    const t = this.elapsed / 1000;
    const { r: ar, g: ag, b: ab } = this.#accent;
    const R = this.#radius;
    const cx = this.#cx;
    const cy = this.#cy;
    const sx = (x: number): number => cx + x * R;
    const sy = (y: number): number => cy - y * R;
    const hidden = (x: number, y: number, z: number): boolean => z < 0 && x * x + y * y < 1;
    const loading = !this.#completed && !this.error;
    const acquiring = loading && this.#det > 0.5 && !reduced;

    ctx.clearRect(0, 0, this.#w, this.#h);
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';

    // Twinkling bright stars.
    if (!reduced) {
      for (const star of this.#twinkles) {
        const a = Math.max(0, Math.sin(t * star.rate + star.phase)) ** 3 * 0.55;
        if (a < 0.02) continue;
        ctx.strokeStyle = `rgba(220, 232, 255, ${a})`;
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.moveTo(star.x - star.r, star.y);
        ctx.lineTo(star.x + star.r, star.y);
        ctx.moveTo(star.x, star.y - star.r);
        ctx.lineTo(star.x, star.y + star.r);
        ctx.stroke();
      }
    }

    for (const sat of this.#satellites) {
      const theta = sat.phase + (reduced ? 0 : t * sat.rate);
      const path = sat.path;
      // Faint full orbit (hidden behind the planet).
      ctx.strokeStyle = `rgba(${ar}, ${ag}, ${ab}, 0.09)`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      let pen = false;
      for (let k = 0; k <= ORBIT_SEGMENTS; k++) {
        const x = path[k * 3]!;
        const y = path[k * 3 + 1]!;
        const z = path[k * 3 + 2]!;
        if (hidden(x, y, z)) {
          pen = false;
          continue;
        }
        if (pen) ctx.lineTo(sx(x), sy(y));
        else ctx.moveTo(sx(x), sy(y));
        pen = true;
      }
      ctx.stroke();

      // Glowing trail behind the satellite.
      const steps = 30;
      let prev = this.#orbitPoint(sat, theta);
      for (let k = 1; k <= steps; k++) {
        const next = this.#orbitPoint(sat, theta - (k / steps) * TRAIL);
        if (!hidden(...prev) && !hidden(...next)) {
          const fade = 1 - k / steps;
          ctx.strokeStyle = `rgba(${ar}, ${ag}, ${ab}, ${0.5 * fade * fade})`;
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(sx(prev[0]), sy(prev[1]));
          ctx.lineTo(sx(next[0]), sy(next[1]));
          ctx.stroke();
        }
        prev = next;
      }

      const [x, y, z] = this.#orbitPoint(sat, theta);
      if (hidden(x, y, z)) continue;
      const px = sx(x);
      const py = sy(y);

      // Sensor swath down to the ground track while tiles are being acquired.
      const len = Math.hypot(x, y, z);
      const gx = x / len;
      const gy = y / len;
      const gz = z / len;
      if (acquiring && gz > 0.2) {
        const strength = clamp((gz - 0.2) / 0.3, 0, 1);
        const ground = [sx(gx), sy(gy)] as const;
        const nx = -(ground[1] - py);
        const ny = ground[0] - px;
        const nl = Math.hypot(nx, ny) || 1;
        const spread = R * 0.07;
        const grad = ctx.createLinearGradient(px, py, ground[0], ground[1]);
        grad.addColorStop(0, `rgba(${ar}, ${ag}, ${ab}, 0)`);
        grad.addColorStop(1, `rgba(${ar}, ${ag}, ${ab}, ${0.16 * strength})`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(ground[0] + (nx / nl) * spread, ground[1] + (ny / nl) * spread);
        ctx.lineTo(ground[0] - (nx / nl) * spread, ground[1] - (ny / nl) * spread);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = `rgba(${ar}, ${ag}, ${ab}, ${0.55 * strength})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(ground[0], ground[1], spread, spread * (0.3 + 0.7 * gz), Math.atan2(ny, nx), 0, Math.PI * 2);
        ctx.stroke();
      }

      // Satellite: soft glow sprite plus a crisp core.
      const depth = 0.75 + 0.25 * clamp(z / sat.radius, -1, 1);
      if (this.#glow) {
        const s = R * 0.16 * depth;
        ctx.globalAlpha = this.error ? 0.4 : 1;
        ctx.drawImage(this.#glow, px - s / 2, py - s / 2, s, s);
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.beginPath();
      ctx.arc(px, py, Math.max(1.2, R * 0.009) * depth, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ane-orbit-loading-screen': OrbitLoadingScreenElement;
  }
}

/** Registers `<ane-orbit-loading-screen>` (or a custom tag name). Safe to call more than once. */
export function defineOrbitLoadingScreen(tag = 'ane-orbit-loading-screen'): void {
  defineElement(tag, OrbitLoadingScreenElement);
}
