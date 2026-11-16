import { defineElement, EffectElement } from '../../core/effect-element';
import { clamp, damp, easeInOutSine, parseNumber } from '../../core/math';
import { buildDisplacementMap, DEFAULT_OPTICS, type LensOptics } from './optics';

export type LensMode = 'read' | 'follow' | 'static';

export interface LensMarkDetail {
  index: number;
  element: Element;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Segment {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** Start time (ms) within the reading plan. */
  start: number;
  duration: number;
  /** Mark revealed when this segment (a dwell) begins. */
  mark?: number;
  /** Lens height while on this segment (line height dependent). */
  lensH: number;
}

const STYLE = /* css */ `
:host {
  --_accent: var(--ane-lens-accent, #7c5cff);
  display: block;
  position: relative;
  isolation: isolate;
}
:host([hidden]) { display: none; }
.content { position: relative; }
.marks { position: absolute; inset: 0; pointer-events: none; z-index: 0; }
.slot { position: relative; z-index: 1; }
.hl {
  position: absolute;
  border-radius: 0.3em;
  background: color-mix(in srgb, var(--_accent) 16%, transparent);
  box-shadow: inset 0 -2px 0 color-mix(in srgb, var(--_accent) 70%, transparent);
  transform-origin: 0 50%;
}
.lens {
  position: absolute;
  left: 0;
  top: 0;
  z-index: 2;
  pointer-events: none;
  box-sizing: border-box;
  opacity: 0;
  will-change: transform, opacity, width, height;
  box-shadow:
    0 14px 34px rgba(8, 10, 24, 0.28),
    0 2px 6px rgba(8, 10, 24, 0.18),
    inset 0 0 0 1px rgba(255, 255, 255, 0.45),
    inset 0 0 0 1.5px rgba(20, 24, 40, 0.10),
    inset 0 2px 1px -1px rgba(255, 255, 255, 0.85),
    inset 0 -3px 6px -2px rgba(20, 24, 40, 0.16),
    inset 0 0 14px rgba(20, 24, 40, 0.06);
  background: linear-gradient(170deg, rgba(255, 255, 255, 0.10), rgba(255, 255, 255, 0) 45%);
}
svg.defs { position: absolute; width: 0; height: 0; overflow: hidden; }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
`;

const HL_IN_MS = 420;
const DWELL_MS = 900;
const JUMP_MS = 380;

let uid = 0;

/**
 * `<ane-glass-lens>`: a liquid-glass lens that refracts the live content it wraps. In
 * `read` mode it shows an AI reading: the lens glides along the text line by line, dwells on
 * the passages it cites and leaves them highlighted. In `follow` mode it tracks the pointer.
 *
 * @attr mode - `read` | `follow` (default) | `static`
 * @attr marks - selector for passages to highlight in read mode, default `mark, [data-lens-mark]`
 * @attr rate - reading speed in px/s, default `320`
 * @attr loop - restart reading after a pause
 * @attr lens-width, lens-height - lens size in px (read mode derives it from the line height)
 * @attr strength - refraction strength 0..1, default `0.5`
 * @attr dispersion - chromatic split 0..1, default `0.4`
 * @attr curvature, bend - lens profile 0..1
 * @attr accent - highlight colour, default `#7c5cff`
 * @attr announce - announce found passages politely
 * @attr speed, motion
 * @fires ane-lens-mark - when a passage is reached in read mode
 * @fires ane-lens-done - when a reading pass ends
 */
export class GlassLensElement extends EffectElement {
  static override get observedAttributes(): string[] {
    return [
      ...super.observedAttributes,
      'mode', 'marks', 'rate', 'loop', 'lens-width', 'lens-height', 'strength', 'dispersion', 'curvature', 'bend', 'accent', 'announce',
    ];
  }

  #id = `ane-glass-${++uid}`;
  #el = {} as {
    content: HTMLElement;
    marks: HTMLElement;
    lens: HTMLElement;
    slot: HTMLSlotElement;
    filter: SVGFilterElement;
    map: SVGFEImageElement;
    disp: SVGFEDisplacementMapElement[];
    live: HTMLElement;
  };
  #canvas: HTMLCanvasElement | null = null;
  #resize: ResizeObserver | null = null;
  #mutations: MutationObserver | null = null;

  // Lens state (CSS px, relative to the host).
  #x = 0;
  #y = 0;
  #w = 160;
  #h = 160;
  #tx = 0;
  #ty = 0;
  #visible = 0;
  #targetVisible = 0;
  #shapeKey = '';

  // Read mode.
  #plan: Segment[] = [];
  #planLength = 0;
  #marks: Element[] = [];
  #markRects: Rect[] = [];
  #hl: HTMLElement[] = [];
  #revealed: number[] = [];
  #readStart = 0;
  #reading = false;
  #done = false;
  #planDirty = true;

  // Follow mode.
  #pointer: { x: number; y: number } | null = null;
  /** 0..1 swell while dwelling on a found passage. */
  #swell = 0;

  /** Elements highlighted so far in the current reading pass. */
  get found(): Element[] {
    return this.#marks.filter((_, i) => this.#revealed[i] != null);
  }

  get mode(): LensMode {
    const m = this.getAttribute('mode');
    return m === 'read' || m === 'static' ? m : 'follow';
  }

  protected build(root: ShadowRoot): void {
    root.innerHTML = `<style>${STYLE}</style>
<div class="content" part="content">
  <div class="marks" aria-hidden="true"></div>
  <div class="slot"><slot></slot></div>
</div>
<div class="lens" part="lens" aria-hidden="true"></div>
<svg class="defs" aria-hidden="true" focusable="false">
  <filter id="${this.#id}" filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
    <feFlood flood-color="rgb(128,128,0)" flood-opacity="1" result="neutral"/>
    <feImage result="lensMap" preserveAspectRatio="none"/>
    <feComposite in="lensMap" in2="neutral" operator="over" result="map"/>
    <feDisplacementMap in="SourceGraphic" in2="map" xChannelSelector="R" yChannelSelector="G" result="dR"/>
    <feDisplacementMap in="SourceGraphic" in2="map" xChannelSelector="R" yChannelSelector="G" result="dG"/>
    <feDisplacementMap in="SourceGraphic" in2="map" xChannelSelector="R" yChannelSelector="G" result="dB"/>
    <!-- Isolate each channel at full opacity, recombine, then restore the real alpha (from the G pass). -->
    <feColorMatrix in="dR" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0 1" result="r"/>
    <feColorMatrix in="dG" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 0 1" result="g"/>
    <feColorMatrix in="dB" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 0 1" result="b"/>
    <feComposite in="r" in2="g" operator="arithmetic" k2="1" k3="1" result="rg"/>
    <feComposite in="rg" in2="b" operator="arithmetic" k2="1" k3="1" result="rgbOpaque"/>
    <feComposite in="rgbOpaque" in2="dG" operator="in" result="rgb"/>
    <!-- Refraction only inside the lens shape; everything else passes through untouched. -->
    <feComposite in="rgb" in2="lensMap" operator="in" result="inside"/>
    <feComposite in="SourceGraphic" in2="lensMap" operator="out" result="outside"/>
    <feComposite in="inside" in2="outside" operator="arithmetic" k2="1" k3="1" result="glass"/>
    <feColorMatrix in="lensMap" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0.9 0 0" result="spec"/>
    <feComposite in="spec" in2="glass" operator="over"/>
  </filter>
</svg>
<span class="sr" aria-live="polite"></span>`;
    const $ = <T extends Element>(s: string): T => root.querySelector<T>(s)!;
    this.#el = {
      content: $('.content'),
      marks: $('.marks'),
      lens: $('.lens'),
      slot: $('slot'),
      filter: $('filter'),
      map: $('feImage'),
      disp: [...root.querySelectorAll<SVGFEDisplacementMapElement>('feDisplacementMap')],
      live: $('.sr'),
    };
    this.#el.slot.addEventListener('slotchange', () => this.#invalidate());
    this.addEventListener('pointermove', this.#onPointer);
    this.addEventListener('pointerdown', this.#onPointer);
    this.addEventListener('pointerleave', (event) => {
      // A tap places the lens on touch screens; it stays until the next tap.
      if (event.pointerType !== 'touch') this.#pointer = null;
    });
    this.#syncAccent();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (!this.#resize && typeof ResizeObserver === 'function') {
      this.#resize = new ResizeObserver(() => this.#invalidate());
      this.#resize.observe(this);
    }
    if (!this.#mutations && typeof MutationObserver === 'function') {
      this.#mutations = new MutationObserver(() => this.#invalidate());
      this.#mutations.observe(this, { childList: true, subtree: true, characterData: true });
    }
    if (this.mode === 'read') this.read();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#resize?.disconnect();
    this.#resize = null;
    this.#mutations?.disconnect();
    this.#mutations = null;
  }

  protected override attributeChanged(name: string): void {
    if (name === 'accent') this.#syncAccent();
    if (name === 'mode') {
      this.#el.content.style.filter = '';
      if (this.mode === 'read') this.read();
      else this.#reading = false;
    }
    if (name === 'marks' || name === 'rate') this.#invalidate();
    this.#shapeKey = '';
    this.tick(0);
  }

  // --- public API ----------------------------------------------------------------

  /** Starts (or restarts) a reading pass over the content. */
  read(): void {
    this.#reading = true;
    this.#done = false;
    this.#readStart = this.elapsed;
    this.#planDirty = true;
    this.#revealed = [];
    for (const hl of this.#hl) hl.style.opacity = '0';
  }

  /** Stops reading and hides the lens (highlights stay). */
  stop(): void {
    this.#reading = false;
    this.#targetVisible = 0;
  }

  /** Moves the lens over an element of the content (static mode, or a one-off glance). */
  focusOn(target: Element): void {
    const r = this.#rel(target.getBoundingClientRect());
    this.#tx = r.x + r.w / 2;
    this.#ty = r.y + r.h / 2;
    this.#targetVisible = 1;
  }

  // --- internals -----------------------------------------------------------------

  #onPointer = (event: PointerEvent): void => {
    if (this.mode !== 'follow') return;
    const box = this.getBoundingClientRect();
    this.#pointer = { x: event.clientX - box.left, y: event.clientY - box.top };
  };

  #syncAccent(): void {
    const accent = this.getAttribute('accent');
    if (accent) this.style.setProperty('--ane-lens-accent', accent);
    else this.style.removeProperty('--ane-lens-accent');
  }

  #invalidate(): void {
    this.#planDirty = true;
  }

  /** Offset of the filtered content box from the host (the host's padding). */
  #contentOffset(): { x: number; y: number } {
    const box = this.getBoundingClientRect();
    const c = this.#el.content.getBoundingClientRect();
    return { x: c.left - box.left, y: c.top - box.top };
  }

  #rel(r: DOMRect): Rect {
    const box = this.getBoundingClientRect();
    return { x: r.left - box.left, y: r.top - box.top, w: r.width, h: r.height };
  }

  /** Text line boxes of the slotted content, merged per line, in reading order. */
  #lines(): Rect[] {
    const rects: Rect[] = [];
    for (const node of this.#el.slot.assignedNodes({ flatten: true })) {
      const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
      let current: Node | null = node.nodeType === Node.TEXT_NODE ? node : walker.nextNode();
      while (current) {
        if (current.textContent && current.textContent.trim()) {
          const range = document.createRange();
          range.selectNodeContents(current);
          for (const r of range.getClientRects()) if (r.width > 1 && r.height > 1) rects.push(this.#rel(r));
        }
        current = walker.nextNode();
      }
    }
    rects.sort((a, b) => a.y + a.h / 2 - (b.y + b.h / 2) || a.x - b.x);
    const lines: Rect[] = [];
    for (const r of rects) {
      const last = lines[lines.length - 1];
      if (last && Math.abs(last.y + last.h / 2 - (r.y + r.h / 2)) < Math.min(last.h, r.h) * 0.5) {
        const x1 = Math.max(last.x + last.w, r.x + r.w);
        last.x = Math.min(last.x, r.x);
        last.w = x1 - last.x;
        last.y = Math.min(last.y, r.y);
        last.h = Math.max(last.h, r.h);
      } else {
        lines.push({ ...r });
      }
    }
    return lines;
  }

  #buildPlan(): void {
    this.#planDirty = false;
    const selector = this.getAttribute('marks') || 'mark, [data-lens-mark]';
    this.#marks = [];
    for (const node of this.#el.slot.assignedElements({ flatten: true })) {
      if (node.matches(selector)) this.#marks.push(node);
      this.#marks.push(...node.querySelectorAll(selector));
    }
    // A citation may wrap across lines: plan the dwell on its first line fragment, otherwise
    // the centre of its bounding box falls between lines and no line claims it.
    this.#markRects = this.#marks.map((m) => {
      const range = document.createRange();
      range.selectNodeContents(m);
      const first = [...range.getClientRects()].find((r) => r.width > 1);
      return this.#rel(first ?? m.getBoundingClientRect());
    });
    // Highlight rectangles (one per line fragment of each mark).
    this.#el.marks.replaceChildren();
    const off = this.#contentOffset();
    this.#hl = this.#marks.map((m) => {
      const group = document.createElement('div');
      const range = document.createRange();
      range.selectNodeContents(m);
      for (const r of range.getClientRects()) {
        const rr = this.#rel(r);
        const hl = document.createElement('i');
        hl.className = 'hl';
        hl.style.cssText = `left:${rr.x - off.x - 2}px;top:${rr.y - off.y}px;width:${rr.w + 4}px;height:${rr.h}px`;
        group.append(hl);
      }
      group.style.opacity = '0';
      this.#el.marks.append(group);
      return group;
    });

    // Reading path: sweep each line; dwell when the lens centre reaches a mark on it.
    const rate = parseNumber(this.getAttribute('rate'), 320, 40, 4000);
    const lines = this.#lines();
    const plan: Segment[] = [];
    let t = 0;
    let px: number | null = null;
    let py = 0;
    for (const line of lines) {
      const cy = line.y + line.h / 2;
      const lensH = line.h * 2.5;
      if (px !== null) {
        plan.push({ x0: px, y0: py, x1: line.x, y1: cy, start: t, duration: JUMP_MS, lensH });
        t += JUMP_MS;
      }
      const onLine = this.#markRects
        .map((r, i) => ({ r, i }))
        .filter(({ r }) => Math.abs(r.y + r.h / 2 - cy) < line.h * 0.6)
        .sort((a, b) => a.r.x - b.r.x);
      let x = line.x;
      for (const { r, i } of onLine) {
        const mx = clamp(r.x + r.w / 2, line.x, line.x + line.w);
        if (mx > x) {
          const d = ((mx - x) / rate) * 1000;
          plan.push({ x0: x, y0: cy, x1: mx, y1: cy, start: t, duration: d, lensH });
          t += d;
          x = mx;
        }
        if (!plan.some((s) => s.mark === i)) {
          plan.push({ x0: x, y0: cy, x1: x, y1: cy, start: t, duration: DWELL_MS, mark: i, lensH });
          t += DWELL_MS;
        }
      }
      const end = line.x + line.w;
      const d = ((end - x) / rate) * 1000;
      plan.push({ x0: x, y0: cy, x1: end, y1: cy, start: t, duration: d, lensH });
      t += d;
      px = end;
      py = cy;
    }
    this.#plan = plan;
    this.#planLength = t;
  }

  #lensSize(): { w: number; h: number } {
    const lw = parseNumber(this.getAttribute('lens-width'), 0, 0, 2000);
    const lh = parseNumber(this.getAttribute('lens-height'), 0, 0, 2000);
    if (this.mode === 'read') {
      const seg = this.#plan.find((s) => s.start + s.duration >= this.elapsed - this.#readStart) ?? this.#plan[0];
      const h = lh || Math.round(clamp(seg?.lensH ?? 52, 36, 140));
      return { w: lw || Math.round(h * 2.1), h };
    }
    const h = lh || 150;
    return { w: lw || h, h };
  }

  #optics(): LensOptics {
    return {
      ...DEFAULT_OPTICS,
      curvature: parseNumber(this.getAttribute('curvature'), DEFAULT_OPTICS.curvature, 0, 1),
      bend: parseNumber(this.getAttribute('bend'), DEFAULT_OPTICS.bend, 0, 1),
    };
  }

  /** Regenerates the displacement map when the lens shape changes. */
  #syncShape(w: number, h: number): void {
    const optics = this.#optics();
    const key = `${w}x${h}:${optics.curvature}:${optics.bend}`;
    if (key === this.#shapeKey) return;
    this.#shapeKey = key;
    const radius = Math.min(w, h) / 2;
    this.#el.lens.style.width = `${w}px`;
    this.#el.lens.style.height = `${h}px`;
    this.#el.lens.style.borderRadius = `${radius}px`;
    try {
      this.#canvas ??= document.createElement('canvas');
      this.#canvas.width = w;
      this.#canvas.height = h;
      const ctx = this.#canvas.getContext('2d');
      if (!ctx) return;
      const image = ctx.createImageData(w, h);
      buildDisplacementMap({ width: w, height: h, radius }, optics, image.data);
      ctx.putImageData(image, 0, 0);
      const map = this.#el.map;
      map.setAttribute('href', this.#canvas.toDataURL('image/png'));
      map.setAttribute('width', String(w));
      map.setAttribute('height', String(h));
      const strength = parseNumber(this.getAttribute('strength'), 0.5, 0, 1);
      const dispersion = parseNumber(this.getAttribute('dispersion'), 0.4, 0, 1);
      const scale = strength * Math.min(w, h);
      const spread = 0.3 * dispersion;
      const [r, g, b] = this.#el.disp;
      r!.setAttribute('scale', String(scale * (1 + spread)));
      g!.setAttribute('scale', String(scale));
      b!.setAttribute('scale', String(scale * (1 - spread)));
    } catch {
      // No canvas (tests, SSR-like environments): the lens frame still renders.
    }
  }

  protected tick(deltaMs: number): void {
    if (!this.#el.content) return;
    const reduced = this.reducedMotion;
    const mode = this.mode;
    const box = this.getBoundingClientRect();
    if (this.#planDirty && box.width) this.#buildPlan();

    if (mode === 'read' && this.#reading) {
      this.#tickRead(reduced);
    } else if (mode === 'follow') {
      if (this.#pointer) {
        this.#tx = this.#pointer.x;
        this.#ty = this.#pointer.y;
        this.#targetVisible = 1;
      } else {
        this.#targetVisible = 0;
      }
    } else if (mode === 'static' && this.#targetVisible === 0 && box.width) {
      this.#tx = box.width / 2;
      this.#ty = box.height / 2;
      this.#targetVisible = 1;
    }

    const glide = (a: number, b: number): number => (reduced ? b : damp(a, b, mode === 'read' ? 14 : 16, deltaMs));
    if (this.#visible < 0.01 && this.#targetVisible > 0) {
      this.#x = this.#tx;
      this.#y = this.#ty;
    }
    this.#x = glide(this.#x, this.#tx);
    this.#y = glide(this.#y, this.#ty);
    this.#visible = reduced ? this.#targetVisible : damp(this.#visible, this.#targetVisible, 10, deltaMs);

    const { w, h } = this.#lensSize();
    this.#syncShape(w, h);
    const left = this.#x - w / 2;
    const top = this.#y - h / 2;
    const lens = this.#el.lens;
    const scale = (0.86 + 0.14 * this.#visible) * (1 + 0.07 * (reduced ? 0 : this.#swell));
    lens.style.transform = `translate(${left.toFixed(1)}px, ${top.toFixed(1)}px) scale(${scale.toFixed(3)})`;
    lens.style.opacity = this.#visible.toFixed(3);

    // The refraction lives in the SVG filter on the content; place its map under the lens.
    const on = this.#visible > 0.02 && box.width > 0;
    const filter = this.#el.filter;
    if (on) {
      filter.setAttribute('x', '0');
      filter.setAttribute('y', '0');
      const cbox = this.#el.content.getBoundingClientRect();
      const off = { x: cbox.left - box.left, y: cbox.top - box.top };
      filter.setAttribute('width', String(Math.ceil(cbox.width)));
      filter.setAttribute('height', String(Math.ceil(cbox.height)));
      const k = (0.86 + 0.14 * this.#visible) * (1 + 0.07 * (reduced ? 0 : this.#swell));
      const mw = w * k;
      const mh = h * k;
      this.#el.map.setAttribute('x', (this.#x - off.x - mw / 2).toFixed(1));
      this.#el.map.setAttribute('y', (this.#y - off.y - mh / 2).toFixed(1));
      this.#el.map.setAttribute('width', mw.toFixed(1));
      this.#el.map.setAttribute('height', mh.toFixed(1));
      if (!this.#el.content.style.filter) this.#el.content.style.filter = `url(#${this.#id})`;
    } else if (this.#el.content.style.filter) {
      this.#el.content.style.filter = '';
    }

    // Highlights fade and grow in from the left once revealed.
    this.#hl.forEach((group, i) => {
      const at = this.#revealed[i];
      if (at == null) return;
      const k = reduced ? 1 : clamp((this.elapsed - at) / HL_IN_MS, 0, 1);
      group.style.opacity = String(k);
      for (const hl of group.children) (hl as HTMLElement).style.transform = `scaleX(${(0.2 + 0.8 * easeInOutSine(k)).toFixed(3)})`;
    });
  }

  #tickRead(reduced: boolean): void {
    if (!this.#plan.length) {
      this.#targetVisible = 0;
      return;
    }
    const t = this.elapsed - this.#readStart;
    if (reduced) {
      // No gliding: reveal marks one after another; the lens rests on the latest.
      const i = Math.min(this.#marks.length - 1, Math.floor(t / DWELL_MS));
      for (let k = 0; k <= i; k++) this.#reveal(k);
      const r = this.#markRects[Math.max(0, i)];
      if (r) {
        this.#tx = r.x + r.w / 2;
        this.#ty = r.y + r.h / 2;
        this.#targetVisible = 1;
      }
      if (t > Math.max(1, this.#marks.length) * DWELL_MS) this.#finish(t);
      return;
    }
    const seg = this.#plan.find((s) => t < s.start + s.duration);
    if (!seg) {
      this.#finish(t);
      return;
    }
    const k = seg.duration ? clamp((t - seg.start) / seg.duration, 0, 1) : 1;
    this.#swell = seg.mark != null ? Math.sin(Math.PI * k) : 0;
    const e = seg.mark != null || seg.x0 === seg.x1 ? k : easeInOutSine(k);
    this.#tx = seg.x0 + (seg.x1 - seg.x0) * e;
    this.#ty = seg.y0 + (seg.y1 - seg.y0) * e;
    this.#targetVisible = 1;
    if (seg.mark != null) this.#reveal(seg.mark);
  }

  #reveal(i: number): void {
    if (this.#revealed[i] != null || !this.#marks[i]) return;
    this.#revealed[i] = this.elapsed;
    this.dispatchEvent(new CustomEvent<LensMarkDetail>('ane-lens-mark', { detail: { index: i, element: this.#marks[i]! }, bubbles: true, composed: true }));
    if (this.hasAttribute('announce')) this.#el.live.textContent = `Found: ${this.#marks[i]!.textContent?.trim().slice(0, 120) ?? ''}`;
  }

  #finish(t: number): void {
    if (!this.#done) {
      this.#done = true;
      this.#targetVisible = 0;
      this.dispatchEvent(new CustomEvent('ane-lens-done', { detail: { found: this.found.length }, bubbles: true, composed: true }));
    }
    if (this.hasAttribute('loop') && t > this.#planLength + 2600) this.read();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ane-glass-lens': GlassLensElement;
  }
  interface HTMLElementEventMap {
    'ane-lens-mark': CustomEvent<LensMarkDetail>;
    'ane-lens-done': CustomEvent<{ found: number }>;
  }
}

/** Registers `<ane-glass-lens>` (or a custom tag name). Safe to call more than once. */
export function defineGlassLens(tag = 'ane-glass-lens'): void {
  defineElement(tag, GlassLensElement);
}
