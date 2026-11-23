import { defineElement, EffectElement } from '../../core/effect-element';
import { damp, parseNumber } from '../../core/math';
import { DitherRenderer } from './dither-gl';

/** Palette presets (dark → light). `auto` uses the gradient colours themselves. */
export const DITHER_PALETTES: Record<string, string[]> = {
  sunset: ['#1b1035', '#5b2a86', '#d94f70', '#ffb86b', '#fff1c1'],
  paper: ['#2b2620', '#8a7f6e', '#d9cdb4', '#f3ecdc'],
  gameboy: ['#0f380f', '#306230', '#8bac0f', '#9bbc0f'],
  mono: ['#0b0b10', '#f2efe6'],
  cga: ['#000000', '#ff55ff', '#55ffff', '#ffffff'],
  ocean: ['#03121f', '#0b4f6c', '#20a4c3', '#a8e6f0', '#f4fbff'],
};
const DEFAULT_COLORS = ['#1b1035', '#5b2a86', '#d94f70', '#ffb86b'];

/** Parses `#rrggbb` (or `#rgb`) into 0..1 RGB; null when invalid. */
export function hexToRgb(hex: string): [number, number, number] | null {
  let h = hex.trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(h)) h = h.replace(/./g, (c) => c + c);
  if (!/^[0-9a-f]{6}$/i.test(h)) return null;
  const n = parseInt(h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** A comma/space separated colour list (invalid entries dropped). */
export function parseColors(value: string | null | undefined, max: number): Array<[number, number, number]> {
  return (value ?? '')
    .split(/[\s,]+/)
    .map(hexToRgb)
    .filter((c): c is [number, number, number] => !!c)
    .slice(0, max);
}

/** Bayer threshold matrices by bit interleaving: integers 0..15 / 0..63 (same maths as the shader). */
export function bayer4(x: number, y: number): number {
  const a = x & 3;
  const xy = a ^ (y & 3);
  return ((xy & 1) << 3) | ((a & 1) << 2) | (xy & 2) | ((a & 2) >> 1);
}
export function bayer8(x: number, y: number): number {
  const a = x & 7;
  const xy = a ^ (y & 7);
  return ((xy & 1) << 5) | ((a & 1) << 4) | ((xy & 2) << 2) | ((a & 2) << 1) | ((xy & 4) >> 1) | ((a & 4) >> 2);
}

const STYLE = /* css */ `
:host {
  display: block;
  position: relative;
  width: 100%;
  min-height: var(--ane-size, 260px);
  overflow: hidden;
  isolation: isolate;
  background: var(--_fallback, #1b1035);
}
:host([hidden]) { display: none; }
canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; z-index: 0; image-rendering: pixelated; }
.content { position: relative; z-index: 1; height: 100%; min-height: inherit; }
`;

const MODES = { bayer4: 0, bayer8: 1, noise: 2 } as const;

/**
 * `<ane-dither-gradient>`: a flowing gradient (or an image) rendered through a limited palette with
 * ordered or noise dithering, like a print or an old handheld screen. A lens under the pointer shows
 * the smooth, undithered colours. Put content inside to layer it on top.
 *
 * @attr colors - gradient stops (2-6 hex colours), default a dusk gradient
 * @attr palette - `auto` (the gradient colours) | `sunset` | `paper` | `gameboy` | `mono` | `cga` | `ocean` | any hex list (2-8)
 * @attr pixel - pixel size in CSS px, `1`-`16`, default `3`
 * @attr dither - `bayer8` (default) | `bayer4` | `noise`
 * @attr spread - dither strength, `0`-`2`, default `1`
 * @attr scale - size of the flow features, `0.3`-`4`, default `1`
 * @attr lens - `on` (default) | `off`
 * @attr lens-size - lens radius in CSS px, default `90`
 * @attr src - image to dither instead of the gradient (same-origin or CORS-enabled)
 * @attr quality - render scale `0.4`-`1`, default `1`
 * @attr seed, speed, motion, size (minimum height)
 */
export class DitherGradientElement extends EffectElement {
  static override get observedAttributes(): string[] {
    return [...super.observedAttributes, 'colors', 'palette', 'pixel', 'dither', 'spread', 'scale', 'lens', 'lens-size', 'src', 'quality', 'seed'];
  }

  #canvas: HTMLCanvasElement | null = null;
  #gl: DitherRenderer | null = null;
  #ro: ResizeObserver | null = null;
  #dirty = true;
  #quality = 1;
  #pointer: { x: number; y: number } | null = null;
  #lens = { x: 0, y: 0, s: 0 };
  #image: HTMLImageElement | null = null;
  #frames: number[] = [];
  #lastReal = 0;

  /** Whether the WebGL2 renderer is running (false: a CSS gradient fallback shows). */
  get webgl(): boolean {
    return !!this.#gl;
  }

  /** Seconds of gradient time (frozen under reduced motion). */
  get time(): number {
    return this.reducedMotion ? 9 : this.elapsed / 1000;
  }

  /** Current render scale (device pixels per CSS pixel × quality). */
  get renderScale(): number {
    return this.#quality * Math.min(globalThis.devicePixelRatio || 1, 1.5);
  }

  protected build(root: ShadowRoot): void {
    root.innerHTML = `<style>${STYLE}</style><canvas aria-hidden="true"></canvas><div class="content" part="content"><slot></slot></div>`;
    this.#canvas = root.querySelector('canvas');
    this.#gl = this.#canvas ? DitherRenderer.create(this.#canvas) : null;
    this.#quality = parseNumber(this.getAttribute('quality'), 1, 0.4, 1);
    if (this.#gl?.software) this.#quality = Math.min(this.#quality, 0.5);
    this.addEventListener('pointermove', this.#onMove);
    this.addEventListener('pointerdown', this.#onMove);
    this.addEventListener('pointerleave', () => (this.#pointer = null));
    this.addEventListener('pointercancel', () => (this.#pointer = null));
    this.addEventListener('pointerup', (e) => e.pointerType !== 'mouse' && (this.#pointer = null));
    this.#syncFallback();
    this.#loadImage();
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
    if (name === 'colors') this.#syncFallback();
    if (name === 'src') this.#loadImage();
  }

  /** The gradient stops in use (0..1 RGB). */
  get stops(): Array<[number, number, number]> {
    const c = parseColors(this.getAttribute('colors'), 6);
    return c.length >= 2 ? c : DEFAULT_COLORS.map((h) => hexToRgb(h)!);
  }

  /** The palette in use (0..1 RGB). */
  get palette(): Array<[number, number, number]> {
    const p = (this.getAttribute('palette') ?? 'auto').trim();
    if (p === 'auto' || !p) return this.stops;
    const preset = DITHER_PALETTES[p];
    const list = preset ? preset.map((h) => hexToRgb(h)!) : parseColors(p, 8);
    return list.length >= 2 ? list : this.stops;
  }

  #syncFallback(): void {
    const stops = this.stops.map((c) => `rgb(${c.map((v) => Math.round(v * 255)).join(' ')})`);
    this.style.setProperty('--_fallback', `linear-gradient(135deg, ${stops.join(', ')})`);
  }

  #loadImage(): void {
    const src = this.getAttribute('src');
    this.#image = null;
    this.#gl?.setImage(null);
    if (!src) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (this.getAttribute('src') !== src) return;
      this.#image = img;
      this.#gl?.setImage(img);
    };
    img.src = src;
  }

  #onMove = (e: PointerEvent): void => {
    if (e.pointerType !== 'mouse' && e.type === 'pointermove' && e.buttons === 0) return;
    const r = this.getBoundingClientRect();
    this.#pointer = { x: e.clientX - r.left, y: e.clientY - r.top };
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

  protected tick(deltaMs: number): void {
    const gl = this.#gl;
    if (!gl) return;
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
    if (this.#dirty) this.#layout();
    const canvas = this.#canvas!;
    const r = this.getBoundingClientRect();
    const s = r.width ? canvas.width / r.width : 1;

    // Lens follows the pointer with a little lag and fades in/out.
    const lensOn = this.getAttribute('lens') !== 'off';
    const target = this.#pointer && lensOn ? 1 : 0;
    const L = this.#lens;
    if (this.#pointer) {
      if (L.s < 0.02 || this.reducedMotion) {
        L.x = this.#pointer.x;
        L.y = this.#pointer.y;
      } else {
        L.x = damp(L.x, this.#pointer.x, 16, deltaMs);
        L.y = damp(L.y, this.#pointer.y, 16, deltaMs);
      }
    }
    L.s = this.reducedMotion ? target : damp(L.s, target, 9, deltaMs);

    const palette = this.palette;
    let cover: [number, number, number, number] = [1, 1, 0, 0];
    const img = this.#image;
    if (img && img.naturalWidth) {
      // object-fit: cover in uv space
      const ar = r.width / r.height;
      const ir = img.naturalWidth / img.naturalHeight;
      cover = ar > ir ? [1, ir / ar, 0, (1 - ir / ar) / 2] : [ar / ir, 1, (1 - ar / ir) / 2, 0];
    }
    const mode = MODES[(this.getAttribute('dither') ?? 'bayer8') as keyof typeof MODES] ?? 1;
    gl.render({
      time: this.time,
      pixel: Math.max(1, Math.round(parseNumber(this.getAttribute('pixel'), 3, 1, 16) * s)),
      scale: parseNumber(this.getAttribute('scale'), 1, 0.3, 4) * 1.8,
      seed: (parseNumber(this.getAttribute('seed'), 7) % 97) / 97,
      stops: this.stops.flat(),
      palette: palette.flat(),
      mode: mode as 0 | 1 | 2,
      spread: parseNumber(this.getAttribute('spread'), 1, 0, 2) / Math.max(1, palette.length - 1),
      cover,
      lens: [L.x * s, L.y * s, parseNumber(this.getAttribute('lens-size'), 90, 20, 400) * s * (0.85 + 0.15 * L.s), L.s],
    });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ane-dither-gradient': DitherGradientElement;
  }
}

/** Registers `<ane-dither-gradient>` (or a custom tag name). Safe to call more than once. */
export function defineDitherGradient(tag = 'ane-dither-gradient'): void {
  defineElement(tag, DitherGradientElement);
}
