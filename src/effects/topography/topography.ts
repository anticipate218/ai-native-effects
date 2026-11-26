import { defineElement, EffectElement } from '../../core/effect-element';
import { damp, parseNumber } from '../../core/math';
import { hexToRgb } from '../dither-gradient/dither-gradient';
import { MAX_RIPPLES, type RGB, TopoRenderer } from './topo-gl';

/** Colour presets: background, contour lines, index contours (and the top of the tint). */
export const TOPO_THEMES: Record<string, { background: string; color: string; accent: string }> = {
  paper: { background: '#f2ece0', color: '#5a4c3d', accent: '#b4532f' },
  night: { background: '#0a1022', color: '#3fc8b8', accent: '#a78bfa' },
  blueprint: { background: '#10375f', color: '#b9d6ff', accent: '#ffffff' },
  moss: { background: '#1a231b', color: '#a9bd8e', accent: '#e9d27a' },
};

/** Resolved colours: the theme, with `background` / `color` / `accent` overriding single entries. */
export function resolveTopoColors(
  theme: string | null,
  overrides: { background?: string | null; color?: string | null; accent?: string | null } = {},
): { background: RGB; color: RGB; accent: RGB } {
  const base = TOPO_THEMES[(theme ?? '').trim()] ?? TOPO_THEMES.paper!;
  const pick = (key: 'background' | 'color' | 'accent'): RGB => (overrides[key] && hexToRgb(overrides[key]!)) || hexToRgb(base[key])!;
  return { background: pick('background'), color: pick('color'), accent: pick('accent') };
}

/** Whether contour number `k` is an index (heavier) contour when every `index`-th one is. */
export function isIndexContour(k: number, index: number): boolean {
  return index >= 1 && Math.round(k) % Math.round(index) === 0;
}

/** Ripple lifetime in seconds of effect time. */
export const RIPPLE_LIFE = 3.6;

const STYLE = /* css */ `
:host {
  display: block;
  position: relative;
  width: 100%;
  min-height: var(--ane-size, 260px);
  overflow: hidden;
  isolation: isolate;
  background-color: var(--_bg, #f2ece0);
  background-image: repeating-radial-gradient(circle at 30% 40%, transparent 0 22px, var(--_line, #5a4c3d) 22px 23px);
  background-blend-mode: normal;
}
:host([data-gl]) { background-image: none; }
:host([hidden]) { display: none; }
canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; z-index: 0; }
.content { position: relative; z-index: 1; height: 100%; min-height: inherit; }
`;

type Ripple = { x: number; y: number; age: number; strength: number };

/**
 * `<ane-topography>`: a living contour map. A drifting height field is drawn as crisp contour lines
 * with heavier index contours, stepped elevation tints and a soft hillshade. The pointer slowly raises
 * a hill under it and a click or tap sends a ripple through the terrain. Put content inside to layer
 * it on top (hero copy, cards).
 *
 * @attr theme - `paper` (default, light print) | `night` | `blueprint` | `moss`
 * @attr background, color, accent - hex colours overriding the theme (paper, contours, index contours)
 * @attr levels - contour density, `4`-`40`, default `14`
 * @attr line-width - contour width in CSS px, `0.5`-`4`, default `1.2`
 * @attr index - every Nth contour is heavier, `0` (none)-`10`, default `5`
 * @attr scale - terrain feature size, `0.3`-`4`, default `1` (higher = smaller features)
 * @attr relief - height of the pointer hill, `0`-`2`, default `1` (`0` turns it off)
 * @attr ripples - `on` (default) | `off`: clicks and taps send ripples
 * @attr fill - elevation tint strength, `0`-`1`, default `0.5`
 * @attr shade - hillshade strength, `0`-`1`, default `0.4`
 * @attr grain - paper grain, `0`-`1`, default `0.35`
 * @attr quality - render scale `0.4`-`1`, default `1`
 * @attr speed - terrain drift speed, `0`-`5`, default `1` (`0` = a still map; the pointer hill and ripples still respond)
 * @attr seed, motion, size (minimum height)
 */
export class TopographyElement extends EffectElement {
  static override get observedAttributes(): string[] {
    return [
      ...super.observedAttributes,
      'theme', 'background', 'color', 'accent', 'levels', 'line-width', 'index', 'scale', 'relief', 'ripples', 'fill', 'shade', 'grain', 'quality', 'seed',
    ];
  }

  #canvas: HTMLCanvasElement | null = null;
  #gl: TopoRenderer | null = null;
  #ro: ResizeObserver | null = null;
  #dirty = true;
  #quality = 1;
  #pointer: { x: number; y: number } | null = null;
  #hill = { x: 0, y: 0, a: 0 };
  #ripples: Ripple[] = [];
  #colors: { background: RGB; color: RGB; accent: RGB } | null = null;
  #frames: number[] = [];
  #lastReal = 0;
  #lastTick = 0;

  /** Whether the WebGL2 renderer is running (false: a CSS fallback shows). */
  get webgl(): boolean {
    return !!this.#gl;
  }

  /** Seconds of terrain time (frozen under reduced motion). */
  get time(): number {
    return this.reducedMotion ? 12 : this.elapsed / 1000;
  }

  /** The target colours (0..1 RGB) after theme and overrides. */
  get colors(): { background: RGB; color: RGB; accent: RGB } {
    return resolveTopoColors(this.getAttribute('theme'), {
      background: this.getAttribute('background'),
      color: this.getAttribute('color'),
      accent: this.getAttribute('accent'),
    });
  }

  /** Current height of the pointer hill, 0..1 of `relief`. */
  get hill(): number {
    return this.#hill.a;
  }

  /** Active ripples (count). */
  get rippleCount(): number {
    return this.#ripples.length;
  }

  /** Current render scale (device pixels per CSS pixel × quality). */
  get renderScale(): number {
    return this.#quality * Math.min(globalThis.devicePixelRatio || 1, 1.5);
  }

  /** Sends a ripple from a point in the element's CSS pixel coordinates (e.g. from your own events). */
  ripple(x: number, y: number, strength = 1): void {
    if (this.reducedMotion) return;
    this.#ripples.push({ x, y, age: 0, strength: Math.max(0, Math.min(2, strength)) });
    while (this.#ripples.length > MAX_RIPPLES) this.#ripples.shift();
  }

  protected build(root: ShadowRoot): void {
    root.innerHTML = `<style>${STYLE}</style><canvas aria-hidden="true"></canvas><div class="content" part="content"><slot></slot></div>`;
    this.#canvas = root.querySelector('canvas');
    this.#gl = this.#canvas ? TopoRenderer.create(this.#canvas) : null;
    this.toggleAttribute('data-gl', !!this.#gl);
    this.#quality = parseNumber(this.getAttribute('quality'), 1, 0.4, 1);
    if (this.#gl?.software) this.#quality = Math.min(this.#quality, 0.5);
    this.addEventListener('pointermove', this.#onMove);
    this.addEventListener('pointerdown', this.#onDown);
    this.addEventListener('pointerleave', () => (this.#pointer = null));
    this.addEventListener('pointercancel', () => (this.#pointer = null));
    this.addEventListener('pointerup', (e) => e.pointerType !== 'mouse' && (this.#pointer = null));
    this.#syncFallback();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (!this.#ro && typeof ResizeObserver === 'function') {
      this.#ro = new ResizeObserver(() => (this.#dirty = true));
      this.#ro.observe(this);
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#ro?.disconnect();
    this.#ro = null;
  }

  protected override attributeChanged(name: string): void {
    if (name === 'quality') {
      this.#quality = parseNumber(this.getAttribute('quality'), 1, 0.4, 1);
      this.#dirty = true;
    }
    if (name === 'theme' || name === 'background' || name === 'color' || name === 'accent') this.#syncFallback();
  }

  protected override visibilityChanged(): void {
    this.#lastTick = 0;
  }

  protected override motionChanged(reduced: boolean): void {
    if (reduced) this.#ripples = [];
  }

  #syncFallback(): void {
    const c = this.colors;
    const css = (v: RGB): string => `rgb(${v.map((x) => Math.round(x * 255)).join(' ')})`;
    this.style.setProperty('--_bg', css(c.background));
    this.style.setProperty('--_line', css(c.color));
  }

  #local(e: PointerEvent): { x: number; y: number } {
    const r = this.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  #onMove = (e: PointerEvent): void => {
    if (e.pointerType !== 'mouse' && e.buttons === 0) return;
    this.#pointer = this.#local(e);
  };

  #onDown = (e: PointerEvent): void => {
    const p = this.#local(e);
    this.#pointer = p;
    if (this.getAttribute('ripples') !== 'off') this.ripple(p.x, p.y);
  };

  #layout(): void {
    this.#dirty = false;
    const canvas = this.#canvas;
    if (!canvas) return;
    const r = this.getBoundingClientRect();
    if (!r.width || !r.height) return;
    let scale = this.renderScale;
    const budget = 1_400_000;
    if (r.width * r.height * scale * scale > budget) scale = Math.sqrt(budget / (r.width * r.height));
    canvas.width = Math.max(1, Math.round(r.width * scale));
    canvas.height = Math.max(1, Math.round(r.height * scale));
  }

  #adapt(): void {
    const now = performance.now();
    if (this.#lastReal && now - this.#lastReal > 250) this.#frames = [];
    else if (this.#lastReal) {
      this.#frames.push(now - this.#lastReal);
      if (this.#frames.length > 15) this.#frames.shift();
      const avg = this.#frames.reduce((a, b) => a + b, 0) / this.#frames.length;
      if (this.#frames.length >= 15 && avg > 24 && this.#quality > 0.3) {
        this.#quality = Math.max(0.3, this.#quality * 0.75);
        this.#frames = [];
        this.#dirty = true;
      }
    }
    this.#lastReal = now;
  }

  protected tick(_deltaMs: number): void {
    const reduced = this.reducedMotion;
    // `speed` only scales the terrain drift; the hill, ripples and colour fades run in real time,
    // so `speed="0"` gives a still map that keeps responding to the pointer.
    const now = performance.now();
    const deltaMs = this.#lastTick ? Math.min(100, Math.max(0, now - this.#lastTick)) : 16;
    this.#lastTick = now;

    // Colours ease towards the theme (a theme switch cross-fades instead of snapping).
    const target = this.colors;
    if (!this.#colors || reduced) this.#colors = { background: [...target.background], color: [...target.color], accent: [...target.accent] };
    else {
      for (const key of ['background', 'color', 'accent'] as const) {
        const cur = this.#colors[key];
        for (let i = 0; i < 3; i++) cur[i] = damp(cur[i]!, target[key][i]!, 5, deltaMs);
      }
    }

    // The hill follows the pointer lazily and rises / sinks slowly, like land, not a cursor.
    const H = this.#hill;
    const relief = parseNumber(this.getAttribute('relief'), 1, 0, 2);
    const up = this.#pointer && relief > 0 ? 1 : 0;
    if (this.#pointer) {
      if (H.a < 0.02 || reduced) {
        H.x = this.#pointer.x;
        H.y = this.#pointer.y;
      } else {
        H.x = damp(H.x, this.#pointer.x, 5, deltaMs);
        H.y = damp(H.y, this.#pointer.y, 5, deltaMs);
      }
    }
    H.a = reduced ? up : damp(H.a, up, up ? 2.2 : 1.4, deltaMs);
    if (H.a < 0.001) H.a = 0;

    for (const r of this.#ripples) r.age += deltaMs / 1000;
    this.#ripples = this.#ripples.filter((r) => r.age < RIPPLE_LIFE);

    const gl = this.#gl;
    if (!gl) return;
    this.#adapt();
    if (this.#dirty) this.#layout();
    const canvas = this.#canvas!;
    const rect = this.getBoundingClientRect();
    const s = rect.width ? canvas.width / rect.width : 1;
    const c = this.#colors;
    gl.render({
      time: this.time,
      scale: parseNumber(this.getAttribute('scale'), 1, 0.3, 4) * 1.45,
      seed: (parseNumber(this.getAttribute('seed'), 11) % 97) / 97,
      levels: parseNumber(this.getAttribute('levels'), 14, 4, 40),
      lineWidth: parseNumber(this.getAttribute('line-width'), 1.2, 0.5, 4) * s,
      index: Math.round(parseNumber(this.getAttribute('index'), 5, 0, 10)),
      bg: c.background,
      line: c.color,
      accent: c.accent,
      fill: parseNumber(this.getAttribute('fill'), 0.5, 0, 1),
      shade: parseNumber(this.getAttribute('shade'), 0.4, 0, 1),
      grain: parseNumber(this.getAttribute('grain'), 0.35, 0, 1),
      hill: [H.x * s, H.y * s, Math.max(60, Math.min(rect.width, rect.height) * 0.3) * s, H.a * relief * 0.55],
      ripples: this.#ripples.map((r) => [r.x * s, r.y * s, r.age, r.strength] as [number, number, number, number]),
    });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ane-topography': TopographyElement;
  }
}

/** Registers `<ane-topography>` (or a custom tag name). Safe to call more than once. */
export function defineTopography(tag = 'ane-topography'): void {
  defineElement(tag, TopographyElement);
}
