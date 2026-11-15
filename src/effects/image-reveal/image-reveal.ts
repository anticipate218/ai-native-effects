import { defineElement, EffectElement } from '../../core/effect-element';
import { clamp, damp, hump, parseNumber } from '../../core/math';
import { RevealRenderer } from './image-gl';

export interface RevealCompleteDetail {
  steps: number;
}

/** Step index (0-based, capped at `steps`) and fraction within it for progress `t`. */
export function stepAt(t: number, steps: number): { step: number; frac: number } {
  const n = Math.max(1, Math.round(steps));
  const x = clamp(t, 0, 1) * n;
  const step = Math.min(n, Math.floor(x));
  return { step, frac: step >= n ? 0 : x - step };
}

const STYLE = /* css */ `
:host {
  --_accent: #b48cff;
  display: block;
  position: relative;
  width: var(--ane-size, 100%);
  aspect-ratio: var(--_ratio, 16 / 9);
  overflow: hidden;
  border-radius: var(--ane-reveal-radius, 14px);
  background: #0b0d14;
  color: #f3f4ff;
  contain: layout paint style;
}
:host([hidden]) { display: none; }
canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.hud { position: absolute; inset: 0; pointer-events: none; container-type: inline-size; }
:host(:not([hud])) .hud { display: none; }
.hud::after { content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 34%; background: linear-gradient(transparent, rgba(5, 6, 12, 0.72)); }
.top, .bottom { position: absolute; left: 16px; right: 16px; display: flex; align-items: center; justify-content: space-between; gap: 14px; z-index: 1; }
.top { top: 14px; }
.bottom { bottom: 16px; align-items: flex-end; }
.chip {
  display: inline-flex; align-items: center; gap: 7px; padding: 5px 10px; border-radius: 999px;
  background: rgba(8, 10, 20, 0.55); border: 1px solid rgba(255, 255, 255, 0.12);
  font: 600 clamp(10px, 1.45cqi, 12px)/1 ui-monospace, "SFMono-Regular", "Cascadia Mono", Menlo, Consolas, monospace;
  letter-spacing: 0.04em; color: rgba(243, 244, 255, 0.9); backdrop-filter: blur(6px);
}
.chip i { width: 7px; height: 7px; border-radius: 50%; background: var(--_accent); box-shadow: 0 0 10px var(--_accent); }
:host([data-phase="done"]) .chip i { background: var(--ane-success, #3ddc97); box-shadow: 0 0 10px var(--ane-success, #3ddc97); }
.prompt {
  max-width: 70%;
  font: 500 clamp(12px, 2cqi, 16px)/1.35 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  color: rgba(243, 244, 255, 0.92);
  text-shadow: 0 1px 8px rgba(0, 0, 0, 0.6);
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.prompt:empty { display: none; }
.counter { font: 600 clamp(11px, 1.6cqi, 13px)/1 ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace; color: rgba(243, 244, 255, 0.85); font-variant-numeric: tabular-nums; white-space: nowrap; text-shadow: 0 1px 8px rgba(0, 0, 0, 0.6); }
.bar { position: absolute; left: 0; bottom: 0; height: 2px; width: 100%; transform-origin: 0 50%; transform: scaleX(0); background: linear-gradient(90deg, transparent, var(--_accent)); z-index: 1; }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
`;

const toRgb = (ctx: CanvasRenderingContext2D | null, color: string): [number, number, number] => {
  const fallback: [number, number, number] = [0.7, 0.55, 1];
  if (!ctx) return fallback;
  ctx.fillStyle = '#000';
  ctx.fillStyle = color;
  const v = String(ctx.fillStyle);
  if (/^#[0-9a-f]{6}$/i.test(v)) return [parseInt(v.slice(1, 3), 16) / 255, parseInt(v.slice(3, 5), 16) / 255, parseInt(v.slice(5, 7), 16) / 255];
  const parts = v.match(/[\d.]+/g);
  return parts && parts.length >= 3 ? [+parts[0]! / 255, +parts[1]! / 255, +parts[2]! / 255] : fallback;
};

const FLASH_MS = 700;

/**
 * `<ane-image-reveal>`: a diffusion-style reveal for image models. Noise is removed step by
 * step while the picture emerges coarse to fine, out of latent blocks, like a real sampler.
 *
 * @attr src - image URL (CORS-enabled for WebGL); default: a procedural aerial scene
 * @attr alt - description of the image
 * @attr progress - `0`-`1`; when present the app drives the reveal, otherwise it autoplays
 * @attr steps - sampler steps shown in the counter, default `30`
 * @attr duration - autoplay length in ms, default `4200`
 * @attr loop - repeat the autoplay
 * @attr hud - show the step counter, seed and prompt
 * @attr caption - the prompt shown in the HUD
 * @attr seed - noise seed (and procedural scene seed), default `7`
 * @attr latent - latent block size in CSS px, default `8`
 * @attr noise - `color` (default) | `mono`
 * @attr accent - accent colour, default `#b48cff`
 * @attr ratio - aspect ratio, e.g. `16/9`; defaults to the image's
 * @attr size, speed, motion
 * @fires ane-reveal-complete - when the reveal reaches the final step
 */
export class ImageRevealElement extends EffectElement {
  static override get observedAttributes(): string[] {
    return [
      ...super.observedAttributes,
      'src', 'alt', 'progress', 'steps', 'duration', 'loop', 'hud', 'caption', 'seed', 'latent', 'noise', 'accent', 'ratio',
    ];
  }

  #el = {} as { canvas: HTMLCanvasElement; prompt: HTMLElement; counter: HTMLElement; seed: HTMLElement; status: HTMLElement; bar: HTMLElement; meter: HTMLElement };
  #gl: RevealRenderer | null = null;
  #ctx: CanvasRenderingContext2D | null = null;
  #probe: CanvasRenderingContext2D | null = null;
  #image: HTMLImageElement | null = null;
  #resize: ResizeObserver | null = null;
  #dpr = 1;
  #width = 0;
  #loadToken = 0;

  #t = 0;
  #autoStart = 0;
  #doneAt = -Infinity;
  #completed = false;
  #dirty = true;
  #lastKey = '';

  get progress(): number | null {
    const raw = this.getAttribute('progress');
    return raw == null ? null : parseNumber(raw, 0, 0, 1);
  }
  set progress(value: number | null) {
    if (value == null) this.removeAttribute('progress');
    else this.setAttribute('progress', String(clamp(value, 0, 1)));
  }

  get steps(): number {
    return Math.round(parseNumber(this.getAttribute('steps'), 30, 1, 1000));
  }

  /** Current sampler step (0..steps). */
  get step(): number {
    return stepAt(this.#t, this.steps).step;
  }

  get webgl(): boolean {
    return this.#gl != null;
  }

  protected build(root: ShadowRoot): void {
    root.innerHTML = `<style>${STYLE}</style>
<canvas role="img"></canvas>
<div class="hud" aria-hidden="true">
  <div class="top"><span class="chip"><i></i><span class="status"></span></span><span class="chip seed"></span></div>
  <div class="bottom"><span class="prompt"></span><span class="counter"></span></div>
  <i class="bar"></i>
</div>
<div class="sr" role="progressbar" aria-valuemin="0"></div>`;
    const $ = <T extends Element>(s: string): T => root.querySelector<T>(s)!;
    this.#el = {
      canvas: $('canvas'),
      prompt: $('.prompt'),
      counter: $('.counter'),
      seed: $('.seed'),
      status: $('.status'),
      bar: $('.bar'),
      meter: $('[role="progressbar"]'),
    };
    try {
      this.#probe = document.createElement('canvas').getContext('2d');
    } catch {
      this.#probe = null;
    }
    this.#syncText();
    this.#syncRatio();
    this.#syncAccent();
    this.#syncAlt();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (!this.#gl && !this.#ctx) this.#initRenderer();
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
    if (this.#gl) {
      this.#gl.dispose();
      this.#gl = null;
      const fresh = this.#el.canvas.cloneNode(false) as HTMLCanvasElement;
      this.#el.canvas.replaceWith(fresh);
      this.#el.canvas = fresh;
    }
    this.#ctx = null;
  }

  protected override attributeChanged(name: string): void {
    switch (name) {
      case 'src':
        this.#load();
        break;
      case 'seed':
        if (!this.getAttribute('src')) this.#load();
        this.#syncText();
        break;
      case 'caption':
        this.#syncText();
        break;
      case 'ratio':
        this.#syncRatio();
        if (!this.getAttribute('src')) this.#load();
        break;
      case 'accent':
        this.#syncAccent();
        break;
      case 'alt':
        this.#syncAlt();
        break;
      case 'progress':
        if (this.getAttribute('progress') == null) this.replay();
        break;
    }
    this.#dirty = true;
    this.tick(0);
  }

  protected override motionChanged(): void {
    this.#dirty = true;
    this.tick(0);
  }

  /** Restarts the autoplay (and re-arms `ane-reveal-complete`). */
  replay(): void {
    this.#autoStart = this.elapsed;
    this.#completed = false;
    this.#doneAt = -Infinity;
    if (this.getAttribute('progress') == null) this.#t = 0;
    this.#dirty = true;
  }

  // --- setup ---------------------------------------------------------------------

  #seed(): number {
    return Math.round(parseNumber(this.getAttribute('seed'), 7, 0, 1e9));
  }

  #initRenderer(): void {
    this.#gl = RevealRenderer.create(this.#el.canvas);
    if (!this.#gl) {
      try {
        this.#ctx = this.#el.canvas.getContext('2d');
      } catch {
        this.#ctx = null;
      }
    }
    this.#load();
  }

  #syncText(): void {
    this.#el.prompt.textContent = this.getAttribute('caption') ?? '';
    this.#el.seed.textContent = `seed ${this.#seed()}`;
    this.#lastKey = '';
  }

  #ratio(): number {
    const raw = this.getAttribute('ratio');
    if (raw) {
      const [a, b] = raw.split(/[/:]/).map(Number);
      const r = b ? a! / b : a!;
      if (r > 0) return clamp(r, 0.25, 6);
    }
    if (this.#image) return clamp(this.#image.naturalWidth / this.#image.naturalHeight || 16 / 9, 0.25, 6);
    return 16 / 9;
  }

  #syncRatio(): void {
    this.style.setProperty('--_ratio', String(this.#ratio()));
  }

  #syncAccent(): void {
    this.style.setProperty('--_accent', this.getAttribute('accent') || '#b48cff');
  }

  #syncAlt(): void {
    this.#el.canvas.setAttribute('aria-label', this.getAttribute('alt') || 'Generated image');
  }

  #load(): void {
    const token = ++this.#loadToken;
    const src = this.getAttribute('src');
    if (!src) {
      this.#image = null;
      this.#syncRatio();
      if (this.#gl) {
        try {
          this.#gl.bakeScene(this.#seed(), 1280, Math.round(1280 / this.#ratio()));
        } catch (error) {
          console.warn('[ai-native-effects] image-reveal: could not bake the procedural scene.', error);
        }
      }
      this.#dirty = true;
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.src = src;
    void img
      .decode()
      .then(() => {
        if (token !== this.#loadToken) return;
        this.#image = img;
        this.#syncRatio();
        if (this.#gl) {
          try {
            this.#gl.setImage(img, img.naturalWidth, img.naturalHeight);
          } catch {
            // Cross-origin without CORS: fall back to a plain 2D fade.
            this.#gl.dispose();
            this.#gl = null;
            const fresh = this.#el.canvas.cloneNode(false) as HTMLCanvasElement;
            this.#el.canvas.replaceWith(fresh);
            this.#el.canvas = fresh;
            this.#ctx = fresh.getContext('2d');
            this.#syncAlt();
          }
        }
        this.#fit();
      })
      .catch((error) => console.warn(`[ai-native-effects] image-reveal: could not load ${src}`, error));
  }

  #fit(): void {
    const rect = this.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    this.#dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
    this.#width = rect.width;
    this.#el.canvas.width = Math.max(1, Math.round(rect.width * this.#dpr));
    this.#el.canvas.height = Math.max(1, Math.round(rect.height * this.#dpr));
    this.#dirty = true;
    this.tick(0);
  }

  // --- frame ---------------------------------------------------------------------

  protected tick(deltaMs: number): void {
    const reduced = this.reducedMotion;
    const target = this.progress;
    const prev = this.#t;

    if (target != null) {
      this.#t = reduced ? target : damp(this.#t, target, 7, deltaMs);
      if (Math.abs(this.#t - target) < 0.0005) this.#t = target;
    } else if (reduced) {
      this.#t = 1;
    } else {
      const duration = parseNumber(this.getAttribute('duration'), 4200, 300, 120000);
      const age = this.elapsed - this.#autoStart;
      this.#t = clamp(age / duration, 0, 1);
      if (this.hasAttribute('loop') && age > duration + 2400) this.replay();
    }

    if (this.#t >= 1 && !this.#completed) {
      this.#completed = true;
      this.#doneAt = this.elapsed;
      this.dispatchEvent(new CustomEvent<RevealCompleteDetail>('ane-reveal-complete', { detail: { steps: this.steps }, bubbles: true, composed: true }));
    }
    if (this.#t < 1 && this.#completed) this.#completed = false;

    const flash = reduced ? 0 : hump(clamp((this.elapsed - this.#doneAt) / FLASH_MS, 0, 1));
    this.#updateHud();
    if (this.#dirty || this.#t !== prev || (this.#t > 0 && this.#t < 1) || flash > 0) {
      this.#render(flash, reduced);
      this.#dirty = false;
    }
  }

  #updateHud(): void {
    const steps = this.steps;
    const { step } = stepAt(this.#t, steps);
    const phase = this.#t >= 1 ? 'done' : this.#t > 0 ? 'denoising' : 'queued';
    const key = `${phase}:${step}:${steps}`;
    if (key === this.#lastKey) {
      this.#el.bar.style.transform = `scaleX(${this.#t.toFixed(4)})`;
      return;
    }
    this.#lastKey = key;
    this.dataset.phase = phase;
    this.#el.status.textContent = phase === 'done' ? 'Done' : phase === 'denoising' ? 'Denoising' : 'Queued';
    this.#el.counter.textContent = `Step ${String(step).padStart(String(steps).length, '0')} / ${steps}`;
    this.#el.bar.style.transform = `scaleX(${this.#t.toFixed(4)})`;
    const meter = this.#el.meter;
    meter.setAttribute('aria-label', 'Image generation');
    meter.setAttribute('aria-valuemax', String(steps));
    meter.setAttribute('aria-valuenow', String(step));
    meter.setAttribute('aria-valuetext', phase === 'done' ? 'Complete' : `Step ${step} of ${steps}`);
  }

  #render(flash: number, reduced: boolean): void {
    if (!this.#width) return;
    const { step, frac } = stepAt(this.#t, this.steps);
    if (this.#gl) {
      this.#gl.render({
        t: this.#t,
        step: reduced ? 0 : step,
        stepFrac: reduced ? 0 : frac,
        seed: this.#seed(),
        latent: parseNumber(this.getAttribute('latent'), 8, 1, 64) * this.#dpr,
        mono: this.getAttribute('noise') === 'mono',
        flash,
        compare: -1,
        accent: toRgb(this.#probe, this.getAttribute('accent') || '#b48cff'),
      });
      return;
    }
    const ctx = this.#ctx;
    if (!ctx) return;
    const { width: w, height: h } = this.#el.canvas;
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#7d7f8a';
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = this.#t;
    if (this.#image) ctx.drawImage(this.#image, 0, 0, w, h);
    else {
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, '#2c4a2a');
      g.addColorStop(1, '#6a6a48');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.globalAlpha = 1;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ane-image-reveal': ImageRevealElement;
  }
  interface HTMLElementEventMap {
    'ane-reveal-complete': CustomEvent<RevealCompleteDetail>;
  }
}

/** Registers `<ane-image-reveal>` (or a custom tag name). Safe to call more than once. */
export function defineImageReveal(tag = 'ane-image-reveal'): void {
  defineElement(tag, ImageRevealElement);
}
