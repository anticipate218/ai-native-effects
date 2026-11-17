import { defineElement, EffectElement } from '../../core/effect-element';
import { clamp, damp, parseNumber } from '../../core/math';
import { AuroraRenderer } from './aurora-gl';

export const AURORA_PALETTES = {
  borealis: { low: '#3dffa8', high: '#8a5cff', sky: '#050916' },
  dusk: { low: '#ff7ac6', high: '#6f5cff', sky: '#0a0614' },
  glacier: { low: '#5ef2ff', high: '#3a6bff', sky: '#03091a' },
  ember: { low: '#ffb547', high: '#ff4d6d', sky: '#120608' },
} as const;
export type AuroraPalette = keyof typeof AURORA_PALETTES;

type Rgb = readonly [number, number, number];

/** Parses #rgb / #rrggbb / rgb() into 0..1 floats (linear-ish working space is fine here). */
export function parseColor(value: string | null | undefined, fallback: Rgb): Rgb {
  if (!value) return fallback;
  const v = value.trim();
  let m = /^#([0-9a-f]{3})$/i.exec(v);
  if (m) {
    const [r, g, b] = m[1]!.split('').map((c) => parseInt(c + c, 16) / 255);
    return [r!, g!, b!];
  }
  m = /^#([0-9a-f]{6})$/i.exec(v);
  if (m) return [parseInt(m[1]!.slice(0, 2), 16) / 255, parseInt(m[1]!.slice(2, 4), 16) / 255, parseInt(m[1]!.slice(4, 6), 16) / 255];
  const n = v.match(/^rgba?\(([^)]+)\)$/i)?.[1]?.split(/[ ,/]+/).filter(Boolean).map(Number);
  if (n && n.length >= 3 && n.slice(0, 3).every((x) => Number.isFinite(x))) return [n[0]! / 255, n[1]! / 255, n[2]! / 255];
  return fallback;
}

const NOISE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .55 0"/></filter><rect width="100%" height="100%" filter="url(#n)"/></svg>`;

const STYLE = /* css */ `
:host {
  display: block;
  position: relative;
  isolation: isolate;
  overflow: hidden;
  width: 100%;
  min-height: var(--ane-size, 520px);
  background: var(--_sky, #050916);
  color: #f2f4ff;
  contain: paint;
}
:host([hidden]) { display: none; }
canvas, .fallback, .grain { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
canvas { z-index: -2; }
.fallback {
  z-index: -2;
  display: none;
  background:
    radial-gradient(60% 40% at 30% 35%, color-mix(in srgb, var(--_high) 40%, transparent), transparent 70%),
    radial-gradient(70% 30% at 65% 55%, color-mix(in srgb, var(--_low) 35%, transparent), transparent 70%),
    var(--_sky, #050916);
}
:host([data-fallback]) .fallback { display: block; }
.grain {
  z-index: -1;
  background-image: url("data:image/svg+xml;base64,${typeof btoa === 'function' ? btoa(NOISE_SVG) : ''}");
  mix-blend-mode: overlay;
  opacity: var(--_grain, 0.22);
}
.content { position: relative; z-index: 0; min-height: inherit; }
`;

/**
 * `<ane-aurora>`: an aurora borealis background that hosts your hero content. Curtains of light
 * hang from bright lower edges, rays rise and fade, folds drift in the wind and lean towards
 * the pointer; stars twinkle above a mountain horizon. Children render on top, untouched.
 *
 * @attr palette - `borealis` (default) | `dusk` | `glacier` | `ember`
 * @attr color - low-altitude colour (overrides the palette)
 * @attr accent - high-altitude colour (overrides the palette)
 * @attr intensity - brightness 0..2, default `1`
 * @attr rays - ray contrast 0..1, default `0.8`
 * @attr stars - star density 0..2, default `1`
 * @attr horizon - mountain ridges 0..1, default `1` (`0` hides them)
 * @attr grain - film grain 0..1, default `0.22`
 * @attr interactive - curtains lean towards the pointer
 * @attr quality - render scale 0.25..1, default `0.75` (the aurora is soft; grain stays crisp)
 * @attr seed - shape seed, default `7`
 * @attr size - minimum height (CSS length), default `520px`
 * @attr speed, motion
 * @cssprop --ane-size
 */
export class AuroraElement extends EffectElement {
  static override get observedAttributes(): string[] {
    return [
      ...super.observedAttributes,
      'palette', 'color', 'accent', 'intensity', 'rays', 'stars', 'horizon', 'grain', 'interactive', 'quality', 'seed',
    ];
  }

  #canvas: HTMLCanvasElement | null = null;
  #gl: AuroraRenderer | null = null;
  #resize: ResizeObserver | null = null;
  #w = 0;
  #h = 0;
  #pointer = { x: 0.5, y: 0.6, tx: 0.5, ty: 0.6, on: 0, target: 0 };
  /** Adaptive render scale: starts at the `quality` attribute and drops on slow devices. */
  #scale = 0.75;
  #perf = { since: 0, frames: 0 };

  /** Current render scale (may be below `quality` on slow devices). */
  get renderScale(): number {
    return this.#scale;
  }

  get palette(): AuroraPalette {
    const p = this.getAttribute('palette');
    return p && p in AURORA_PALETTES ? (p as AuroraPalette) : 'borealis';
  }

  /** Whether the WebGL renderer is active (`false` = CSS gradient fallback). */
  get webgl(): boolean {
    return this.#gl != null;
  }

  protected build(root: ShadowRoot): void {
    root.innerHTML = `<style>${STYLE}</style><canvas aria-hidden="true"></canvas><div class="fallback" aria-hidden="true"></div><div class="grain" aria-hidden="true"></div><div class="content" part="content"><slot></slot></div>`;
    this.#canvas = root.querySelector('canvas');
    this.#scale = parseNumber(this.getAttribute('quality'), 0.75, 0.25, 1);
    this.addEventListener('pointermove', this.#onPointer);
    this.addEventListener('pointerdown', this.#onPointer);
    this.addEventListener('pointerleave', () => {
      this.#pointer.target = 0;
    });
    this.#syncStyle();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (!this.#gl && this.#canvas) {
      this.#gl = AuroraRenderer.create(this.#canvas);
      this.toggleAttribute('data-fallback', !this.#gl);
    }
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
    if (this.#gl && this.#canvas) {
      this.#gl.dispose();
      this.#gl = null;
      const fresh = this.#canvas.cloneNode(false) as HTMLCanvasElement;
      this.#canvas.replaceWith(fresh);
      this.#canvas = fresh;
    }
  }

  protected override attributeChanged(name: string): void {
    if (name === 'quality') {
      this.#scale = parseNumber(this.getAttribute('quality'), 0.75, 0.25, 1);
      this.#fit();
    }
    this.#syncStyle();
    this.tick(0);
  }

  protected override motionChanged(): void {
    this.tick(0);
  }

  #colors(): { low: Rgb; high: Rgb; sky: Rgb } {
    const p = AURORA_PALETTES[this.palette];
    return {
      low: parseColor(this.getAttribute('color'), parseColor(p.low, [0.24, 1, 0.66])),
      high: parseColor(this.getAttribute('accent'), parseColor(p.high, [0.54, 0.36, 1])),
      sky: parseColor(p.sky, [0.02, 0.035, 0.086]),
    };
  }

  #syncStyle(): void {
    const p = AURORA_PALETTES[this.palette];
    this.style.setProperty('--_sky', p.sky);
    this.style.setProperty('--_low', this.getAttribute('color') || p.low);
    this.style.setProperty('--_high', this.getAttribute('accent') || p.high);
    this.style.setProperty('--_grain', String(parseNumber(this.getAttribute('grain'), 0.22, 0, 1)));
  }

  #onPointer = (event: PointerEvent): void => {
    if (!this.hasAttribute('interactive') || !this.#h) return;
    const box = this.getBoundingClientRect();
    const aspect = box.width / box.height;
    this.#pointer.tx = ((event.clientX - box.left) / box.width) * aspect;
    this.#pointer.ty = 1 - (event.clientY - box.top) / box.height;
    this.#pointer.target = 1;
  };

  #fit(): void {
    const canvas = this.#canvas;
    if (!canvas) return;
    const rect = this.getBoundingClientRect();
    this.#w = rect.width;
    this.#h = rect.height;
    // The aurora is soft: 1.5× is plenty on dense screens, and a pixel budget keeps huge heroes cheap.
    const dpr = Math.min(globalThis.devicePixelRatio || 1, 1.5);
    let scale = this.#scale * dpr;
    const budget = 1_000_000;
    if (rect.width * rect.height * scale * scale > budget) scale = Math.sqrt(budget / (rect.width * rect.height));
    canvas.width = Math.max(1, Math.round(rect.width * scale));
    canvas.height = Math.max(1, Math.round(rect.height * scale));
    this.tick(0);
  }

  /** Every half second of real time, lowers the render scale if frames are slow (min 0.3). */
  #adapt(deltaMs: number): void {
    if (deltaMs === 0 || typeof performance === 'undefined') return;
    const now = performance.now();
    if (!this.#perf.since) {
      this.#perf = { since: now, frames: 0 };
      return;
    }
    this.#perf.frames++;
    const span = now - this.#perf.since;
    if (span < 500) return;
    const interval = span / this.#perf.frames;
    this.#perf = { since: now, frames: 0 };
    if (interval > 24 && this.#scale > 0.3) {
      this.#scale = Math.max(0.3, this.#scale * 0.72);
      this.#fit();
    }
  }

  protected tick(deltaMs: number): void {
    if (!this.#gl || !this.#w || !this.#h) return;
    this.#adapt(deltaMs);
    const reduced = this.reducedMotion;
    const ptr = this.#pointer;
    const interactive = this.hasAttribute('interactive') && !reduced;
    ptr.x = damp(ptr.x, ptr.tx, 4, deltaMs);
    ptr.y = damp(ptr.y, ptr.ty, 4, deltaMs);
    ptr.on = damp(ptr.on, interactive ? ptr.target : 0, 3, deltaMs);
    const { low, high, sky } = this.#colors();
    this.#gl.render({
      // Reduced motion: a still frame (a pleasant moment of the animation, not t = 0).
      time: reduced ? 12 : 8 + this.elapsed / 1000,
      pointer: [ptr.x, ptr.y],
      pointerOn: ptr.on,
      low,
      high,
      sky,
      intensity: parseNumber(this.getAttribute('intensity'), 1, 0, 2),
      rays: parseNumber(this.getAttribute('rays'), 0.8, 0, 1),
      stars: parseNumber(this.getAttribute('stars'), 1, 0, 2),
      horizon: parseNumber(this.getAttribute('horizon'), 1, 0, 1),
      seed: clamp(parseNumber(this.getAttribute('seed'), 7), -1e4, 1e4) * 1.618,
    });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ane-aurora': AuroraElement;
  }
}

/** Registers `<ane-aurora>` (or a custom tag name). Safe to call more than once. */
export function defineAurora(tag = 'ane-aurora'): void {
  defineElement(tag, AuroraElement);
}
