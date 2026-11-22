import { defineElement, EffectElement } from '../../core/effect-element';
import { clamp, damp, parseNumber } from '../../core/math';
import { AsciiRenderer } from './ascii-gl';

/** Glyph ramps from dark to bright. Any other string is used as a custom ramp. */
export const ASCII_RAMPS: Record<string, string> = {
  classic: ' .:-=+*#%@',
  blocks: ' ░▒▓█',
  binary: ' .01',
  dots: ' ·•●',
  lines: ' -=≡',
  katakana: ' ｰｨｸｼﾂﾐﾈﾘｦﾑ',
};

/** The glyph ramp for a `charset` attribute value (presets, or the string itself; always ≥ 2 glyphs). */
export function rampFor(value: string | null): string[] {
  const s = value && (ASCII_RAMPS[value] ?? value);
  const glyphs = Array.from(s || ASCII_RAMPS.classic!);
  return glyphs.length >= 2 ? glyphs : Array.from(ASCII_RAMPS.classic!);
}

/** Cell size in buffer pixels for a glyph size (CSS px) and render scale; monospace cells are ~0.6 wide. */
export function cellSize(glyphPx: number, scale: number): [number, number] {
  return [Math.max(3, Math.round(glyphPx * 0.62 * scale)), Math.max(5, Math.round(glyphPx * 1.12 * scale))];
}

const toRgb = (hex: string, fallback: [number, number, number]): [number, number, number] => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return fallback;
  const n = parseInt(m[1]!, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

const STYLE = /* css */ `
:host {
  display: block;
  position: relative;
  width: 100%;
  min-height: var(--ane-size, 260px);
  overflow: hidden;
  isolation: isolate;
}
:host([hidden]) { display: none; }
canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; z-index: 0; pointer-events: none; }
.content { position: relative; z-index: 1; height: 100%; min-height: inherit; }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
`;

const MAX_WAVES = 4;

/**
 * `<ane-ascii-field>`: a flowing field of ASCII characters rendered on the GPU. Brightness picks the
 * glyph; the field can gather into text (or an image), brightens under the pointer and sends a shock
 * wave on click. Put content inside to layer it on top.
 *
 * @attr charset - `classic` (default) | `blocks` | `binary` | `dots` | `lines` | `katakana` | any glyph ramp (dark → bright)
 * @attr cell - glyph size in CSS px, `6`-`40`, default `13`
 * @attr color, accent - gradient colours (hex), default `#4de2c5` → `#8f7bff`
 * @attr text - text the characters gather into
 * @attr reveal - `0`-`1`, how strongly the text/image shows, default `1`
 * @attr text-y - vertical position of the text, `0`-`1`, default `0.5`
 * @attr src - image used as the mask instead of text (must be same-origin or CORS-enabled)
 * @attr contrast - `0.4`-`2`, default `1`
 * @attr scale - size of the flow features, `0.3`-`4`, default `1`
 * @attr interactive - `on` (default) | `off`
 * @attr quality - render scale `0.4`-`1`, default `1` (steps down automatically on slow devices)
 * @attr seed, speed, motion, size (minimum height)
 */
export class AsciiFieldElement extends EffectElement {
  static override get observedAttributes(): string[] {
    return [...super.observedAttributes, 'charset', 'cell', 'color', 'accent', 'text', 'reveal', 'text-y', 'src', 'contrast', 'scale', 'interactive', 'quality', 'seed'];
  }

  #canvas: HTMLCanvasElement | null = null;
  #sr: HTMLElement | null = null;
  #gl: AsciiRenderer | null = null;
  #ro: ResizeObserver | null = null;
  #dirty = true;
  #maskDirty = true;
  #quality = 1;
  #cell: [number, number] = [8, 14];
  #grid: [number, number] = [1, 1];
  #pointer: { x: number; y: number } | null = null;
  #pointerStrength = 0;
  #pointerPos: [number, number] = [-9999, -9999];
  #waves: Array<[number, number, number]> = [];
  #reveal = 1;
  #tween: { from: number; to: number; t0: number; dur: number; then?: () => void } | null = null;
  #image: HTMLImageElement | null = null;
  #frames: number[] = [];
  #lastReal = 0;

  /** Seconds of field time (frozen under reduced motion). */
  get time(): number {
    return this.reducedMotion ? 12 : this.elapsed / 1000;
  }

  /** Whether the WebGL2 renderer is running (false: the field stays empty, content still shows). */
  get webgl(): boolean {
    return !!this.#gl;
  }

  /** Current render scale (device pixels per CSS pixel × quality). */
  get renderScale(): number {
    return this.#quality * Math.min(globalThis.devicePixelRatio || 1, 1.5);
  }

  protected build(root: ShadowRoot): void {
    root.innerHTML = `<style>${STYLE}</style><canvas aria-hidden="true"></canvas><span class="sr"></span><div class="content" part="content"><slot></slot></div>`;
    this.#canvas = root.querySelector('canvas');
    this.#sr = root.querySelector('.sr');
    this.#gl = this.#canvas ? AsciiRenderer.create(this.#canvas) : null;
    this.#quality = parseNumber(this.getAttribute('quality'), 1, 0.4, 1);
    if (this.#gl?.software) this.#quality = Math.min(this.#quality, 0.5);
    this.#reveal = parseNumber(this.getAttribute('reveal'), 1, 0, 1);
    this.addEventListener('pointermove', this.#onMove);
    this.addEventListener('pointerdown', (e) => {
      this.#onMove(e);
      if (this.#interactive()) {
        const p = this.#local(e);
        this.shockwave(p.x, p.y);
      }
    });
    this.addEventListener('pointerleave', () => (this.#pointer = null));
    this.addEventListener('pointercancel', () => (this.#pointer = null));
    this.#syncLabel();
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
    if (name === 'cell' || name === 'charset') this.#dirty = true;
    if (name === 'quality') {
      this.#quality = parseNumber(this.getAttribute('quality'), 1, 0.4, 1);
      this.#dirty = true;
    }
    if (name === 'text' || name === 'text-y') {
      this.#maskDirty = true;
      this.#syncLabel();
    }
    if (name === 'src') this.#loadImage();
    if (name === 'reveal' && !this.#tween) this.#reveal = parseNumber(this.getAttribute('reveal'), 1, 0, 1);
  }

  /** Sends a shock wave through the field from (x, y) in CSS px relative to the element (default: centre). */
  shockwave(x?: number, y?: number): void {
    if (this.reducedMotion) return;
    const r = this.getBoundingClientRect();
    const s = this.#bufferScale();
    this.#waves.push([(x ?? r.width / 2) * s, (y ?? r.height / 2) * s, this.time]);
    if (this.#waves.length > MAX_WAVES) this.#waves.shift();
  }

  /**
   * Dissolves the current text back into the field, swaps in `text` and gathers the characters into it.
   * Resolves when done. Under reduced motion the text is replaced at once.
   */
  morph(text: string, ms = 1600): Promise<void> {
    return new Promise((resolve) => {
      if (this.reducedMotion || ms <= 0) {
        this.setAttribute('text', text);
        this.#tween = null;
        this.#reveal = 1;
        resolve();
        return;
      }
      const half = this.hasAttribute('text') && this.#reveal > 0.05 ? ms * 0.45 : 0;
      const gather = (): void => {
        this.setAttribute('text', text);
        this.#tween = { from: 0, to: 1, t0: this.elapsed, dur: ms - half, then: resolve };
      };
      if (half) this.#tween = { from: this.#reveal, to: 0, t0: this.elapsed, dur: half, then: gather };
      else {
        this.#reveal = 0;
        gather();
      }
    });
  }

  /** Lets the text dissolve back into the field (the `text` attribute is kept). */
  dissolve(ms = 1200): Promise<void> {
    return new Promise((resolve) => {
      if (this.reducedMotion || ms <= 0) {
        this.#tween = null;
        this.#reveal = 0;
        resolve();
        return;
      }
      this.#tween = { from: this.#reveal, to: 0, t0: this.elapsed, dur: ms, then: resolve };
    });
  }

  #interactive(): boolean {
    return this.getAttribute('interactive') !== 'off';
  }

  #syncLabel(): void {
    if (this.#sr) this.#sr.textContent = this.getAttribute('text') ?? '';
  }

  #loadImage(): void {
    const src = this.getAttribute('src');
    this.#image = null;
    this.#maskDirty = true;
    if (!src) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (this.getAttribute('src') === src) {
        this.#image = img;
        this.#maskDirty = true;
      }
    };
    img.src = src;
  }

  #local(e: PointerEvent): { x: number; y: number } {
    const r = this.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  #onMove = (e: PointerEvent): void => {
    if (!this.#interactive()) return;
    if (e.pointerType !== 'mouse' && e.type === 'pointermove' && e.buttons === 0) return;
    this.#pointer = this.#local(e);
  };

  #bufferScale(): number {
    const c = this.#canvas;
    const r = this.getBoundingClientRect();
    return c && r.width ? c.width / r.width : 1;
  }

  /** Canvas size, glyph atlas and grid (on resize, cell/charset change or quality step). */
  #layout(): void {
    this.#dirty = false;
    this.#maskDirty = true;
    const canvas = this.#canvas;
    const gl = this.#gl;
    if (!canvas || !gl) return;
    const r = this.getBoundingClientRect();
    if (!r.width || !r.height) return;
    let scale = this.renderScale;
    const budget = 1_400_000;
    if (r.width * r.height * scale * scale > budget) scale = Math.sqrt(budget / (r.width * r.height));
    canvas.width = Math.max(1, Math.round(r.width * scale));
    canvas.height = Math.max(1, Math.round(r.height * scale));
    const glyphPx = parseNumber(this.getAttribute('cell'), 13, 6, 40);
    this.#cell = cellSize(glyphPx, scale);
    const [cw, ch] = this.#cell;
    this.#grid = [Math.ceil(canvas.width / cw), Math.ceil(canvas.height / ch)];
    const ramp = rampFor(this.getAttribute('charset'));
    const atlas = document.createElement('canvas');
    atlas.width = cw * ramp.length;
    atlas.height = ch;
    const ctx = atlas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `600 ${Math.round(ch * 0.8)}px ui-monospace, "Cascadia Mono", Consolas, "Courier New", monospace`;
      ramp.forEach((g, i) => ctx.fillText(g, i * cw + cw / 2, ch / 2 + ch * 0.04));
    }
    gl.setAtlas(atlas, this.#cell, ramp.length, this.#grid);
  }

  /** Cell-resolution mask from the text or image, with proportions of the real screen. */
  #buildMask(): void {
    this.#maskDirty = false;
    const gl = this.#gl;
    if (!gl) return;
    const text = this.getAttribute('text');
    const img = this.#image;
    if (!text && !img) {
      gl.setMask(null);
      return;
    }
    const [cols, rows] = this.#grid;
    const [cw, ch] = this.#cell;
    const tw = 640;
    const th = Math.max(1, Math.round((tw * rows * ch) / (cols * cw)));
    const temp = document.createElement('canvas');
    temp.width = tw;
    temp.height = th;
    const t = temp.getContext('2d');
    if (!t) return;
    if (img) {
      const s = Math.max(tw / img.naturalWidth, th / img.naturalHeight);
      t.drawImage(img, (tw - img.naturalWidth * s) / 2, (th - img.naturalHeight * s) / 2, img.naturalWidth * s, img.naturalHeight * s);
      try {
        const data = t.getImageData(0, 0, tw, th);
        const d = data.data;
        for (let i = 0; i < d.length; i += 4) {
          const lum = (0.299 * d[i]! + 0.587 * d[i + 1]! + 0.114 * d[i + 2]!) * (d[i + 3]! / 255);
          d[i] = d[i + 1] = d[i + 2] = 255;
          d[i + 3] = lum;
        }
        t.putImageData(data, 0, 0);
      } catch {
        // Tainted canvas (no CORS): fall back to no mask.
        gl.setMask(null);
        return;
      }
    } else if (text) {
      // Real newlines, or a literal "\n" typed into an attribute.
      const lines = text.split(/\\n|\n/);
      t.fillStyle = '#fff';
      t.textAlign = 'center';
      t.textBaseline = 'middle';
      let size = th * 0.5 / lines.length;
      t.font = `900 ${size}px ui-sans-serif, system-ui, "Segoe UI", Arial, sans-serif`;
      const widest = Math.max(...lines.map((l) => t.measureText(l).width));
      if (widest > tw * 0.88) size *= (tw * 0.88) / widest;
      t.font = `900 ${size}px ui-sans-serif, system-ui, "Segoe UI", Arial, sans-serif`;
      const cy = th * parseNumber(this.getAttribute('text-y'), 0.5, 0, 1);
      lines.forEach((l, i) => t.fillText(l, tw / 2, cy + (i - (lines.length - 1) / 2) * size * 1.02));
    }
    const mask = document.createElement('canvas');
    mask.width = cols;
    mask.height = rows;
    const m = mask.getContext('2d');
    if (!m) return;
    m.imageSmoothingEnabled = true;
    m.drawImage(temp, 0, 0, cols, rows);
    gl.setMask(mask);
  }

  protected tick(deltaMs: number): void {
    const gl = this.#gl;
    if (!gl) return;
    // Adaptive quality: if real frames run long for a while, render fewer pixels.
    const now = performance.now();
    // Gaps longer than 250 ms are pauses (off-screen, background tab), not slow frames.
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
    if (this.#maskDirty) this.#buildMask();

    const s = this.#bufferScale();
    const interactive = this.#interactive();
    const target = this.#pointer && interactive ? 1 : 0;
    this.#pointerStrength = this.reducedMotion ? target : damp(this.#pointerStrength, target, 7, deltaMs);
    if (this.#pointer) {
      const [px, py] = [this.#pointer.x * s, this.#pointer.y * s];
      this.#pointerPos = this.reducedMotion || this.#pointerStrength < 0.02 ? [px, py] : [damp(this.#pointerPos[0], px, 14, deltaMs), damp(this.#pointerPos[1], py, 14, deltaMs)];
    }

    if (this.#tween) {
      const k = clamp((this.elapsed - this.#tween.t0) / Math.max(1, this.#tween.dur), 0, 1);
      const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      this.#reveal = this.#tween.from + (this.#tween.to - this.#tween.from) * e;
      if (k >= 1) {
        const then = this.#tween.then;
        this.#tween = null;
        then?.();
      }
    }

    const time = this.time;
    this.#waves = this.#waves.filter((w) => time - w[2] < 3.2);
    const waves = new Array<number>(MAX_WAVES * 4).fill(0);
    this.#waves.forEach((w, i) => waves.splice(i * 4, 4, w[0], w[1], w[2], 1));
    gl.render({
      time,
      pointer: [this.#pointerPos[0], this.#pointerPos[1], this.#pointerStrength],
      waves,
      colorA: toRgb(this.getAttribute('color') ?? '', [0.3, 0.886, 0.773]),
      colorB: toRgb(this.getAttribute('accent') ?? '', [0.561, 0.482, 1]),
      reveal: this.#reveal,
      contrast: parseNumber(this.getAttribute('contrast'), 1, 0.4, 2),
      scale: parseNumber(this.getAttribute('scale'), 1, 0.3, 4) * 2.2,
      seed: (parseNumber(this.getAttribute('seed'), 7) % 97) / 97,
    });
  }

  protected override motionChanged(): void {
    this.#waves = [];
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ane-ascii-field': AsciiFieldElement;
  }
}

/** Registers `<ane-ascii-field>` (or a custom tag name). Safe to call more than once. */
export function defineAsciiField(tag = 'ane-ascii-field'): void {
  defineElement(tag, AsciiFieldElement);
}
