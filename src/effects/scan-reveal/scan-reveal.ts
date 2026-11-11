import { defineElement, EffectElement } from '../../core/effect-element';
import { clamp, damp, easeInOutSine, parseNumber } from '../../core/math';
import { ScanRenderer, type SceneClasses } from './scan-gl';

export interface ScanClass {
  name: string;
  color: string;
}

export const DEFAULT_CLASSES: readonly ScanClass[] = [
  { name: 'Water', color: '#4cc9f0' },
  { name: 'Urban', color: '#ffb547' },
  { name: 'Forest', color: '#3ddc97' },
];

export type ScanPhase = 'standby' | 'acquiring' | 'analyzing' | 'complete';

export interface ScanCompleteDetail {
  pass: 'acquisition' | 'analysis';
}

/** Parses `classes="Water:#4cc9f0|Urban:#ffb547"`. */
export function parseClasses(raw: string | null): ScanClass[] {
  if (!raw) return [...DEFAULT_CLASSES];
  const out = raw
    .split('|')
    .map((part) => {
      const i = part.lastIndexOf(':');
      return i > 0 ? { name: part.slice(0, i).trim(), color: part.slice(i + 1).trim() } : null;
    })
    .filter((c): c is ScanClass => Boolean(c && c.name && c.color));
  return out.length ? out : [...DEFAULT_CLASSES];
}

/** Phase and overall progress (0..1) from the two passes. */
export function scanStatus(scan: number, analysis: number, hasMask: boolean): { phase: ScanPhase; value: number } {
  if (scan <= 0 && analysis <= 0) return { phase: 'standby', value: 0 };
  if (scan < 1) return { phase: 'acquiring', value: hasMask ? scan / 2 : scan };
  if (hasMask && analysis < 1) return { phase: 'analyzing', value: 0.5 + analysis / 2 };
  return { phase: 'complete', value: 1 };
}

const PHASE_TEXT: Record<ScanPhase, string> = {
  standby: 'Standby',
  acquiring: 'Acquiring',
  analyzing: 'Analyzing',
  complete: 'Complete',
};

const STYLE = /* css */ `
:host {
  --_accent: #5ef2ff;
  display: block;
  position: relative;
  width: var(--ane-size, 100%);
  aspect-ratio: var(--_ratio, 16 / 9);
  overflow: hidden;
  border-radius: var(--ane-scan-radius, 14px);
  background: #05080f;
  color: #eef2ff;
  contain: layout paint style;
}
:host([hidden]) { display: none; }
canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.hud { position: absolute; inset: 0; pointer-events: none; font: 600 clamp(9.5px, 1.35cqi, 12.5px)/1.2 ui-monospace, "SFMono-Regular", "Cascadia Mono", Menlo, Consolas, monospace; letter-spacing: 0.12em; text-transform: uppercase; container-type: inline-size; }
:host(:not([hud])) .hud { display: none; }
.hud::before, .hud::after { content: ""; position: absolute; left: 0; right: 0; height: 22%; pointer-events: none; }
.hud::before { top: 0; background: linear-gradient(rgba(3, 6, 14, 0.62), transparent); }
.hud::after { bottom: 0; background: linear-gradient(transparent, rgba(3, 6, 14, 0.7)); }
.corner { position: absolute; width: 18px; height: 18px; border: 1.5px solid rgba(238, 242, 255, 0.75); z-index: 1; }
.tl { top: 12px; left: 12px; border-right: 0; border-bottom: 0; }
.tr { top: 12px; right: 12px; border-left: 0; border-bottom: 0; }
.bl { bottom: 12px; left: 12px; border-right: 0; border-top: 0; }
.br { bottom: 12px; right: 12px; border-left: 0; border-top: 0; }
.row { position: absolute; left: 40px; right: 40px; display: flex; justify-content: space-between; align-items: center; gap: 12px; z-index: 1; text-shadow: 0 1px 6px rgba(0, 0, 0, 0.6); }
.top { top: 15px; }
.bottom { bottom: 15px; }
.row span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.caption { color: #fff; }
.detail { color: rgba(238, 242, 255, 0.78); }
.status { display: inline-flex; align-items: center; gap: 8px; color: #fff; }
.status i { width: 7px; height: 7px; border-radius: 50%; background: var(--_tone, var(--_accent)); box-shadow: 0 0 10px var(--_tone, var(--_accent)); flex: none; }
.pct { color: rgba(238, 242, 255, 0.8); font-variant-numeric: tabular-nums; }
.legend { display: inline-flex; gap: 12px; opacity: 0; transition: none; }
.legend b { display: inline-flex; align-items: center; gap: 6px; font-weight: 600; color: rgba(238, 242, 255, 0.88); }
.legend b::before { content: ""; width: 9px; height: 9px; border-radius: 2px; background: var(--c); box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.35) inset; }
@container (max-width: 420px) {
  .detail, .legend b:nth-child(n + 3) { display: none; }
}
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
`;

const toRgb = (ctx: CanvasRenderingContext2D | null, color: string): [number, number, number] => {
  if (!ctx) return [0.37, 0.95, 1];
  ctx.fillStyle = '#000';
  ctx.fillStyle = color;
  const v = String(ctx.fillStyle);
  if (/^#[0-9a-f]{6}$/i.test(v)) return [parseInt(v.slice(1, 3), 16) / 255, parseInt(v.slice(3, 5), 16) / 255, parseInt(v.slice(5, 7), 16) / 255];
  const parts = v.match(/[\d.]+/g);
  return parts && parts.length >= 3 ? [+parts[0]! / 255, +parts[1]! / 255, +parts[2]! / 255] : [0.37, 0.95, 1];
};

/**
 * `<ane-scan-reveal>`: a push-broom satellite scan that reveals imagery, then an inference
 * sweep that lays a segmentation mask over it. Without `src` a procedural farmland scene and
 * its class mask are generated, so it works with no assets at all.
 *
 * @attr src - image URL (CORS-enabled for WebGL; otherwise a 2D fallback is used)
 * @attr mask - class mask image URL (coloured classes on transparent)
 * @attr alt - description of the image for assistive technology
 * @attr progress - acquisition progress `0`-`1`; when present the app drives the scan
 * @attr analysis - inference progress `0`-`1` (used with `progress`)
 * @attr duration - autoplay length of one pass in ms, default `3600`
 * @attr loop - repeat the autoplay sequence
 * @attr hud - show corner brackets, labels, status and legend
 * @attr caption - top-left HUD label
 * @attr detail - top-right HUD label
 * @attr classes - legend and procedural mask colours, e.g. `Water:#4cc9f0|Urban:#ffb547|Forest:#3ddc97`
 * @attr accent - scan line colour, default `#5ef2ff`
 * @attr angle - ground-track tilt in degrees, default `-9`
 * @attr ghost - visibility of the not-yet-acquired preview, `0`-`1`, default `0.18`
 * @attr ratio - aspect ratio (e.g. `16/9`); defaults to the image's
 * @attr seed - procedural scene seed
 * @attr size, speed, motion
 * @fires ane-scan-complete - when a pass finishes (`detail.pass`)
 * @cssprop --ane-size, --ane-scan-radius
 */
export class ScanRevealElement extends EffectElement {
  static override get observedAttributes(): string[] {
    return [
      ...super.observedAttributes,
      'src', 'mask', 'alt', 'progress', 'analysis', 'duration', 'loop', 'hud', 'caption', 'detail',
      'classes', 'accent', 'angle', 'ghost', 'ratio', 'seed',
    ];
  }

  #el = {} as {
    canvas: HTMLCanvasElement;
    caption: HTMLElement;
    detail: HTMLElement;
    status: HTMLElement;
    phase: HTMLElement;
    pct: HTMLElement;
    legend: HTMLElement;
    meter: HTMLElement;
  };
  #gl: ScanRenderer | null = null;
  #ctx: CanvasRenderingContext2D | null = null;
  #color: CanvasRenderingContext2D | null = null;
  #image: HTMLImageElement | HTMLCanvasElement | null = null;
  #resize: ResizeObserver | null = null;
  #dpr = 1;
  #width = 0;
  #height = 0;
  #loadToken = 0;

  #scan = 0;
  #analysis = 0;
  #autoStart = 0;
  #fired = { acquisition: false, analysis: false };
  #dirty = true;
  #lastStatus = '';

  get progress(): number | null {
    const raw = this.getAttribute('progress');
    return raw == null ? null : parseNumber(raw, 0, 0, 1);
  }
  set progress(value: number | null) {
    if (value == null) this.removeAttribute('progress');
    else this.setAttribute('progress', String(clamp(value, 0, 1)));
  }

  get analysis(): number {
    return parseNumber(this.getAttribute('analysis'), 0, 0, 1);
  }
  set analysis(value: number) {
    this.setAttribute('analysis', String(clamp(value, 0, 1)));
  }

  /** Current phase of the reveal. */
  get phase(): ScanPhase {
    return scanStatus(this.#scan, this.#analysis, this.#hasMask()).phase;
  }

  /** Whether WebGL is in use (`false` = 2D fallback). */
  get webgl(): boolean {
    return this.#gl != null;
  }

  protected build(root: ShadowRoot): void {
    root.innerHTML = `<style>${STYLE}</style>
<canvas role="img"></canvas>
<div class="hud" aria-hidden="true">
  <i class="corner tl"></i><i class="corner tr"></i><i class="corner bl"></i><i class="corner br"></i>
  <div class="row top"><span class="caption"></span><span class="detail"></span></div>
  <div class="row bottom"><span class="status"><i></i><b class="phase"></b><span class="pct"></span></span><span class="legend"></span></div>
</div>
<div class="sr" role="progressbar" aria-valuemin="0" aria-valuemax="100"></div>`;
    const $ = <T extends Element>(s: string): T => root.querySelector<T>(s)!;
    this.#el = {
      canvas: $('canvas'),
      caption: $('.caption'),
      detail: $('.detail'),
      status: $('.status'),
      phase: $('.phase'),
      pct: $('.pct'),
      legend: $('.legend'),
      meter: $('[role="progressbar"]'),
    };
    const probe = document.createElement('canvas');
    try {
      this.#color = probe.getContext('2d');
    } catch {
      this.#color = null;
    }
    this.#syncText();
    this.#syncLegend();
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
      case 'mask':
      case 'seed':
        this.#loadSources();
        break;
      case 'classes':
        this.#syncLegend();
        if (!this.getAttribute('src')) this.#loadSources();
        break;
      case 'caption':
      case 'detail':
        this.#syncText();
        break;
      case 'ratio':
        this.#syncRatio();
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

  /** Restarts the autoplay sequence (or the completion events in controlled mode). */
  replay(): void {
    this.#autoStart = this.elapsed;
    this.#fired = { acquisition: false, analysis: false };
    if (this.getAttribute('progress') == null) {
      this.#scan = 0;
      this.#analysis = 0;
    }
    this.#dirty = true;
  }

  // --- setup ---------------------------------------------------------------------

  #initRenderer(): void {
    this.#gl = ScanRenderer.create(this.#el.canvas);
    if (!this.#gl) {
      try {
        this.#ctx = this.#el.canvas.getContext('2d');
      } catch {
        this.#ctx = null;
      }
    }
    this.#loadSources();
  }

  #classes(): ScanClass[] {
    return parseClasses(this.getAttribute('classes'));
  }

  #hasMask(): boolean {
    return this.#gl ? this.#gl.hasMask : false;
  }

  #syncText(): void {
    this.#el.caption.textContent = this.getAttribute('caption') ?? '';
    this.#el.detail.textContent = this.getAttribute('detail') ?? '';
  }

  #syncLegend(): void {
    const legend = this.#el.legend;
    legend.replaceChildren(
      ...this.#classes().map((c) => {
        const b = document.createElement('b');
        b.style.setProperty('--c', c.color);
        b.textContent = c.name;
        return b;
      }),
    );
  }

  #syncRatio(): void {
    const raw = this.getAttribute('ratio');
    let ratio = 16 / 9;
    if (raw) {
      const [a, b] = raw.split(/[/:]/).map(Number);
      ratio = b ? a! / b : a || ratio;
    } else if (this.#image) {
      ratio = this.#image.width / this.#image.height || ratio;
    }
    this.style.setProperty('--_ratio', String(clamp(ratio, 0.25, 6)));
  }

  #syncAccent(): void {
    this.style.setProperty('--_accent', this.getAttribute('accent') || '#5ef2ff');
  }

  #syncAlt(): void {
    this.#el.canvas.setAttribute('aria-label', this.getAttribute('alt') || 'Satellite image');
  }

  async #loadImage(url: string): Promise<HTMLImageElement> {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return img;
  }

  /** Loads `src`/`mask`, or bakes the procedural scene. Later calls win over slower earlier ones. */
  #loadSources(): void {
    const token = ++this.#loadToken;
    const src = this.getAttribute('src');
    const mask = this.getAttribute('mask');
    const gl = this.#gl;
    if (!src) {
      this.#image = null;
      if (gl) {
        const classes = this.#classes();
        const pick = (name: string, i: number): [number, number, number] =>
          toRgb(this.#color, (classes.find((c) => c.name.toLowerCase() === name) ?? classes[i] ?? DEFAULT_CLASSES[i]!).color);
        const ratio = parseFloat(getComputedStyle(this).getPropertyValue('--_ratio')) || 16 / 9;
        const sceneClasses: SceneClasses = { water: pick('water', 0), urban: pick('urban', 1), forest: pick('forest', 2) };
        try {
          gl.bakeScene(Math.round(parseNumber(this.getAttribute('seed'), 7)), 1600, Math.round(1600 / ratio), sceneClasses);
        } catch (error) {
          console.warn('[ai-native-effects] scan-reveal: could not bake the procedural scene.', error);
        }
      }
      this.#syncRatio();
      this.#dirty = true;
      return;
    }
    void (async () => {
      try {
        const image = await this.#loadImage(src);
        if (token !== this.#loadToken) return;
        this.#image = this.#fitTexture(image);
        this.#syncRatio();
        if (this.#gl) {
          try {
            this.#gl.setImage(this.#image);
          } catch {
            // Cross-origin image without CORS: keep showing it through the 2D fallback.
            this.#gl.dispose();
            this.#gl = null;
            const fresh = this.#el.canvas.cloneNode(false) as HTMLCanvasElement;
            this.#el.canvas.replaceWith(fresh);
            this.#el.canvas = fresh;
            this.#ctx = fresh.getContext('2d');
          }
        }
        if (this.#gl) {
          if (mask) {
            const m = this.#fitTexture(await this.#loadImage(mask));
            if (token !== this.#loadToken) return;
            this.#gl.setMask(m, m.width, m.height);
          } else {
            this.#gl.setMask(null);
          }
        }
        this.#fit();
      } catch (error) {
        console.warn(`[ai-native-effects] scan-reveal: could not load ${src}`, error);
      }
    })();
  }

  /** Downscales images larger than the GPU texture limit. */
  #fitTexture(image: HTMLImageElement): HTMLImageElement | HTMLCanvasElement {
    const max = this.#gl ? Math.min(4096, this.#gl.gl.getParameter(this.#gl.gl.MAX_TEXTURE_SIZE) as number) : 4096;
    const w = image.naturalWidth;
    const h = image.naturalHeight;
    if (w <= max && h <= max) return image;
    const k = max / Math.max(w, h);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(w * k);
    canvas.height = Math.round(h * k);
    canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas;
  }

  #fit(): void {
    const rect = this.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    this.#dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
    this.#width = rect.width;
    this.#height = rect.height;
    const canvas = this.#el.canvas;
    canvas.width = Math.max(1, Math.round(rect.width * this.#dpr));
    canvas.height = Math.max(1, Math.round(rect.height * this.#dpr));
    this.#dirty = true;
    this.tick(0);
  }

  // --- frame ---------------------------------------------------------------------

  protected tick(deltaMs: number): void {
    const reduced = this.reducedMotion;
    const controlled = this.getAttribute('progress') != null;
    const hasMask = this.#hasMask();
    const prevScan = this.#scan;
    const prevAnalysis = this.#analysis;

    if (controlled) {
      const targetScan = this.progress ?? 0;
      const targetAnalysis = this.analysis;
      this.#scan = reduced ? targetScan : damp(this.#scan, targetScan, 6, deltaMs);
      this.#analysis = reduced ? targetAnalysis : damp(this.#analysis, targetAnalysis, 6, deltaMs);
      if (Math.abs(this.#scan - targetScan) < 0.0005) this.#scan = targetScan;
      if (Math.abs(this.#analysis - targetAnalysis) < 0.0005) this.#analysis = targetAnalysis;
    } else if (reduced) {
      this.#scan = 1;
      this.#analysis = hasMask ? 1 : 0;
    } else {
      const duration = parseNumber(this.getAttribute('duration'), 3600, 300, 60000);
      const t = this.elapsed - this.#autoStart;
      const gap = 450;
      const second = duration * 0.85;
      this.#scan = easeInOutSine(clamp(t / duration, 0, 1));
      this.#analysis = hasMask ? easeInOutSine(clamp((t - duration - gap) / second, 0, 1)) : 0;
      const total = duration + (hasMask ? gap + second : 0);
      if (this.hasAttribute('loop') && t > total + 2200) this.replay();
    }

    this.#emit(hasMask);
    this.#updateHud(hasMask);

    const moving = this.#scan !== prevScan || this.#analysis !== prevAnalysis;
    const animating = !reduced && ((this.#scan > 0 && this.#scan < 1) || (this.#analysis > 0 && this.#analysis < 1));
    if (this.#dirty || moving || animating) {
      this.#render(reduced);
      this.#dirty = false;
    }
  }

  #emit(hasMask: boolean): void {
    const fire = (pass: 'acquisition' | 'analysis'): void => {
      this.#fired[pass] = true;
      this.dispatchEvent(new CustomEvent<ScanCompleteDetail>('ane-scan-complete', { detail: { pass }, bubbles: true, composed: true }));
    };
    if (this.#scan >= 1 && !this.#fired.acquisition) fire('acquisition');
    if (this.#scan < 1) this.#fired.acquisition = false;
    if (hasMask && this.#analysis >= 1 && !this.#fired.analysis) fire('analysis');
    if (this.#analysis < 1) this.#fired.analysis = false;
  }

  #updateHud(hasMask: boolean): void {
    const { phase, value } = scanStatus(this.#scan, this.#analysis, hasMask);
    const passValue = phase === 'analyzing' ? this.#analysis : phase === 'acquiring' ? this.#scan : 1;
    const pct = Math.round(passValue * 100);
    const key = `${phase}:${pct}:${Math.round(value * 100)}`;
    if (key === this.#lastStatus) return;
    this.#lastStatus = key;
    this.#el.phase.textContent = PHASE_TEXT[phase];
    this.#el.pct.textContent = phase === 'complete' || phase === 'standby' ? '' : `${pct}%`;
    this.#el.status.style.setProperty('--_tone', phase === 'complete' ? '#3ddc97' : '');
    this.#el.legend.style.opacity = hasMask && this.#analysis > 0 ? '1' : '0';
    const meter = this.#el.meter;
    meter.setAttribute('aria-label', this.getAttribute('alt') ? `${this.getAttribute('alt')}: loading` : 'Scan progress');
    meter.setAttribute('aria-valuenow', String(Math.round(value * 100)));
    meter.setAttribute('aria-valuetext', phase === 'complete' || phase === 'standby' ? PHASE_TEXT[phase] : `${PHASE_TEXT[phase]} ${pct}%`);
  }

  #render(reduced: boolean): void {
    if (!this.#width) return;
    const angle = (parseNumber(this.getAttribute('angle'), -9, -45, 45) * Math.PI) / 180;
    if (this.#gl) {
      this.#gl.render({
        scan: this.#scan,
        analysis: this.#analysis,
        angle,
        time: this.elapsed / 1000,
        dpr: this.#dpr,
        ghost: parseNumber(this.getAttribute('ghost'), 0.18, 0, 1),
        fx: reduced ? 0 : 1,
        accent: toRgb(this.#color, this.getAttribute('accent') || '#5ef2ff'),
      });
      return;
    }
    this.#render2d(angle);
  }

  /** Fallback without WebGL (or for cross-origin images): a clean wipe with a sensor line. */
  #render2d(angle: number): void {
    const ctx = this.#ctx;
    if (!ctx) return;
    const w = this.#el.canvas.width;
    const h = this.#el.canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#060a12';
    ctx.fillRect(0, 0, w, h);
    const dir = [Math.sin(angle), Math.cos(angle)] as const;
    const ext = 0.5 * (w * Math.abs(dir[0]) + h * Math.abs(dir[1]));
    const margin = 40 * this.#dpr;
    const line = -ext - margin + (2 * ext + 2 * margin) * this.#scan;
    const cx = w / 2 + dir[0] * line;
    const cy = h / 2 + dir[1] * line;
    const ax = dir[1] * (w + h);
    const ay = -dir[0] * (w + h);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx + ax, cy + ay);
    ctx.lineTo(cx - ax, cy - ay);
    ctx.lineTo(cx - ax - dir[0] * 4 * (w + h), cy - ay - dir[1] * 4 * (w + h));
    ctx.lineTo(cx + ax - dir[0] * 4 * (w + h), cy + ay - dir[1] * 4 * (w + h));
    ctx.closePath();
    ctx.clip();
    if (this.#image) ctx.drawImage(this.#image, 0, 0, w, h);
    else {
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, '#2c4a2a');
      g.addColorStop(1, '#4a5a3a');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.restore();
    if (this.#scan < 1) {
      ctx.strokeStyle = this.getAttribute('accent') || '#5ef2ff';
      ctx.lineWidth = 2 * this.#dpr;
      ctx.beginPath();
      ctx.moveTo(cx + ax, cy + ay);
      ctx.lineTo(cx - ax, cy - ay);
      ctx.stroke();
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ane-scan-reveal': ScanRevealElement;
  }
  interface HTMLElementEventMap {
    'ane-scan-complete': CustomEvent<ScanCompleteDetail>;
  }
}

/** Registers `<ane-scan-reveal>` (or a custom tag name). Safe to call more than once. */
export function defineScanReveal(tag = 'ane-scan-reveal'): void {
  defineElement(tag, ScanRevealElement);
}
