import { defineElement, EffectElement } from '../../core/effect-element';
import { clamp, damp, parseNumber, springStep } from '../../core/math';
import { buildDisplacementMap, DEFAULT_OPTICS } from '../glass-lens/optics';

/**
 * Liquid stretch of the lens for a horizontal speed (px/s): it grows along the motion and thins
 * slightly across it, like a drop being pulled. Returns [extra width in px, height factor].
 */
export function liquidStretch(speed: number, baseWidth: number, amount: number): [number, number] {
  const s = Math.min(1, Math.abs(speed) / 2600) * amount;
  return [baseWidth * 0.55 * s, 1 - 0.16 * s];
}

/** Index of the tab whose centre is closest to x. */
export function nearestTab(x: number, centres: number[]): number {
  let best = 0;
  centres.forEach((c, i) => {
    if (Math.abs(c - x) < Math.abs(centres[best]! - x)) best = i;
  });
  return best;
}

const STYLE = /* css */ `
:host {
  --_accent: var(--ane-glass-accent, #ffffff);
  --_tint: var(--ane-glass-tint, rgba(255, 255, 255, 0.10));
  --_pad: var(--ane-glass-pad, 6px);
  display: inline-block;
  position: relative;
  max-width: 100%;
  -webkit-tap-highlight-color: transparent;
}
:host([hidden]) { display: none; }
.bar {
  position: relative;
  padding: var(--_pad);
  border-radius: 999px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.14), rgba(255, 255, 255, 0.05));
  -webkit-backdrop-filter: blur(18px) saturate(1.7);
  backdrop-filter: blur(18px) saturate(1.7);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.35), inset 0 0 0 1px rgba(255, 255, 255, 0.16), 0 14px 34px rgba(5, 8, 25, 0.28);
  touch-action: pan-y;
}
.content { position: relative; display: flex; align-items: stretch; gap: var(--ane-glass-gap, 2px); }
::slotted(*) {
  position: relative;
  flex: 1 1 0;
  margin: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  cursor: pointer;
  border-radius: 999px;
  outline-offset: 2px;
}
::slotted([aria-selected="true"]) { color: var(--_accent); }
::slotted(:focus-visible) { outline: 2px solid var(--_accent); }
.lens {
  position: absolute;
  left: 0;
  top: 0;
  border-radius: 999px;
  pointer-events: none;
  background: var(--_tint);
  box-shadow:
    inset 0 1px 1px rgba(255, 255, 255, 0.75),
    inset 0 -1px 1px rgba(255, 255, 255, 0.25),
    inset 0 0 0 1px rgba(255, 255, 255, 0.28),
    inset 0 10px 20px rgba(255, 255, 255, 0.10),
    0 6px 18px rgba(0, 0, 0, 0.22);
  will-change: transform, width;
}
.defs { position: absolute; width: 0; height: 0; overflow: hidden; }
`;

let uid = 0;

/**
 * `<ane-glass-tabs>`: a tab bar whose selected tab sits under a liquid-glass lens. The lens really
 * refracts and magnifies the labels beneath it (with chromatic dispersion), slides on a spring,
 * stretches with its speed like a drop of liquid and can be dragged to scrub between tabs.
 * Put your tab buttons inside.
 *
 * @attr selected - index of the selected tab, default `0`
 * @attr accent - colour of the selected label and focus ring, default `#fff`
 * @attr tint - lens tint (CSS colour), default white at 10%
 * @attr strength - refraction strength, `0`-`1`, default `0.6`
 * @attr dispersion - chromatic dispersion, `0`-`1`, default `0.35`
 * @attr curvature - magnification of the dome, `0`-`1`, default `0.85`
 * @attr stretch - liquid stretch while moving, `0`-`1`, default `0.8`
 * @attr speed, motion
 * @fires ane-tab-change - when the selection changes (`detail.index`, `detail.tab`)
 */
export class GlassTabsElement extends EffectElement {
  static override get observedAttributes(): string[] {
    return [...super.observedAttributes, 'selected', 'accent', 'tint', 'strength', 'dispersion', 'curvature', 'stretch'];
  }

  #id = `ane-glass-tabs-${++uid}`;
  #bar: HTMLElement | null = null;
  #content: HTMLElement | null = null;
  #lens: HTMLElement | null = null;
  #slot: HTMLSlotElement | null = null;
  #map: SVGFEImageElement | null = null;
  #disp: SVGFEDisplacementMapElement[] = [];
  #filter: SVGFilterElement | null = null;
  #tabs: HTMLElement[] = [];
  #rects: Array<{ x: number; w: number }> = [];
  #h = 0;
  #dirty = true;
  #x = 0;
  #vx = 0;
  #w = 0;
  #vw = 0;
  #placed = false;
  #drag: { id: number; startX: number; moved: boolean; x: number } | null = null;
  #maps = new Map<string, string>();
  #mapKey = '';
  #ro: ResizeObserver | null = null;
  #resting = false;

  /** Index of the selected tab. */
  get selected(): number {
    // Before the slot has reported its tabs (it does so asynchronously), count the children.
    const n = this.#tabs.length || this.children.length;
    const v = Math.round(parseNumber(this.getAttribute('selected'), 0));
    return n ? clamp(v, 0, n - 1) : 0;
  }
  set selected(i: number) {
    this.setAttribute('selected', String(i));
  }

  /** The slotted tabs, in order. */
  get tabs(): HTMLElement[] {
    return [...this.#tabs];
  }

  protected build(root: ShadowRoot): void {
    root.innerHTML = `<style>${STYLE}</style>
<div class="bar" part="bar">
  <div class="content" part="content"><slot></slot></div>
  <div class="lens" part="lens" aria-hidden="true"></div>
</div>
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
    <feComposite in="rgb" in2="lensMap" operator="in" result="inside"/>
    <feComposite in="SourceGraphic" in2="lensMap" operator="out" result="outside"/>
    <feComposite in="inside" in2="outside" operator="arithmetic" k2="1" k3="1"/>
  </filter>
</svg>`;
    const $ = <T extends Element>(s: string): T => root.querySelector<T>(s)!;
    this.#bar = $('.bar');
    this.#content = $('.content');
    this.#lens = $('.lens');
    this.#slot = $('slot');
    this.#map = $('feImage');
    this.#filter = $('filter');
    this.#disp = [...root.querySelectorAll<SVGFEDisplacementMapElement>('feDisplacementMap')];
    if (!this.hasAttribute('role')) this.setAttribute('role', 'tablist');
    this.#slot.addEventListener('slotchange', () => this.#collect());
    this.addEventListener('click', (e) => {
      if (this.#drag?.moved) return;
      const i = this.#tabs.findIndex((t) => t === e.target || t.contains(e.target as Node));
      if (i >= 0) this.#select(i, true);
    });
    this.addEventListener('keydown', (e) => this.#onKey(e));
    const bar = this.#bar;
    bar.addEventListener('pointerdown', this.#onDown);
    bar.addEventListener('pointermove', this.#onMove);
    bar.addEventListener('pointerup', this.#onUp);
    bar.addEventListener('pointercancel', this.#onUp);
    this.#syncVars();
    this.#collect();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (!this.#ro && typeof ResizeObserver === 'function') {
      this.#ro = new ResizeObserver(() => this.#invalidate());
      this.#ro.observe(this);
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#ro?.disconnect();
    this.#ro = null;
  }

  protected override attributeChanged(name: string): void {
    this.#syncVars();
    if (name === 'selected') this.#syncTabs();
    if (['strength', 'dispersion', 'curvature'].includes(name)) this.#mapKey = '';
    if (name === 'curvature') this.#maps.clear();
    this.#resting = false;
  }

  protected override motionChanged(): void {
    this.#resting = false;
  }

  #syncVars(): void {
    for (const [attr, prop] of [['accent', '--ane-glass-accent'], ['tint', '--ane-glass-tint']] as const) {
      const v = this.getAttribute(attr);
      if (v) this.style.setProperty(prop, v);
      else this.style.removeProperty(prop);
    }
  }

  #invalidate(): void {
    this.#dirty = true;
    this.#resting = false;
  }

  #collect(): void {
    this.#tabs = (this.#slot?.assignedElements({ flatten: true }) ?? []) as HTMLElement[];
    this.#tabs.forEach((t) => t.setAttribute('role', 'tab'));
    this.#syncTabs();
    this.#invalidate();
  }

  #syncTabs(): void {
    const sel = this.selected;
    this.#tabs.forEach((t, i) => {
      t.setAttribute('aria-selected', String(i === sel));
      t.setAttribute('tabindex', i === sel ? '0' : '-1');
    });
    this.#resting = false;
  }

  #select(i: number, user: boolean, focus = false): void {
    const n = this.#tabs.length;
    if (!n) return;
    i = clamp(i, 0, n - 1);
    const changed = i !== this.selected;
    this.setAttribute('selected', String(i));
    if (focus) this.#tabs[i]!.focus();
    if (changed && user) {
      this.dispatchEvent(new CustomEvent('ane-tab-change', { detail: { index: i, tab: this.#tabs[i] }, bubbles: true, composed: true }));
    }
  }

  #onKey(e: KeyboardEvent): void {
    const n = this.#tabs.length;
    const cur = this.#tabs.findIndex((t) => t === document.activeElement || t.contains(document.activeElement));
    if (cur < 0 || !n) return;
    const next = { ArrowRight: cur + 1, ArrowDown: cur + 1, ArrowLeft: cur - 1, ArrowUp: cur - 1, Home: 0, End: n - 1 }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    this.#select((next + n) % n, true, true); // selection follows focus
  }

  #local(e: PointerEvent): number {
    return e.clientX - (this.#content?.getBoundingClientRect().left ?? 0);
  }

  #onDown = (e: PointerEvent): void => {
    if (e.button > 0) return;
    this.#drag = { id: e.pointerId, startX: e.clientX, moved: false, x: this.#local(e) };
  };

  #onMove = (e: PointerEvent): void => {
    const d = this.#drag;
    if (!d || d.id !== e.pointerId) return;
    if (!d.moved && Math.abs(e.clientX - d.startX) > 6) {
      d.moved = true;
      try {
        this.#bar?.setPointerCapture?.(e.pointerId);
      } catch {
        // synthetic or already-released pointer: dragging still works without capture
      }
    }
    if (d.moved) {
      d.x = this.#local(e);
      this.#resting = false;
    }
  };

  #onUp = (e: PointerEvent): void => {
    const d = this.#drag;
    if (!d || d.id !== e.pointerId) return;
    if (d.moved) {
      const centres = this.#rects.map((r) => r.x + r.w / 2);
      if (centres.length) this.#select(nearestTab(d.x, centres), true);
      // Swallow the click that follows a drag.
      setTimeout(() => (this.#drag = null), 0);
    } else {
      this.#drag = null;
    }
    this.#resting = false;
  };

  #measure(): void {
    this.#dirty = false;
    const c = this.#content;
    if (!c) return;
    const box = c.getBoundingClientRect();
    this.#h = box.height;
    this.#rects = this.#tabs.map((t) => {
      const r = t.getBoundingClientRect();
      return { x: r.left - box.left, w: r.width };
    });
  }

  /** Displacement map for a lens of this size (cached as a PNG data URL). */
  #mapFor(w: number, h: number): string {
    const key = `${w}x${h}`;
    let url = this.#maps.get(key);
    if (url !== undefined) return url;
    url = '';
    try {
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const img = ctx.createImageData(w, h);
        const curvature = parseNumber(this.getAttribute('curvature'), 0.85, 0, 1);
        buildDisplacementMap({ width: w, height: h, radius: h / 2 }, { ...DEFAULT_OPTICS, curvature, bend: 0.5, bendWidth: 0.34, specular: 0 }, img.data);
        ctx.putImageData(img, 0, 0);
        url = canvas.toDataURL('image/png');
      }
    } catch {
      url = '';
    }
    this.#maps.set(key, url);
    return url;
  }

  protected tick(deltaMs: number): void {
    if (this.#dirty) this.#measure();
    if (this.#resting || !this.#rects.length || !this.#h) return;
    const reduced = this.reducedMotion;
    const sel = this.#rects[this.selected]!;
    const drag = this.#drag?.moved ? this.#drag : null;
    const first = this.#rects[0]!;
    const last = this.#rects[this.#rects.length - 1]!;
    let tx = sel.x + sel.w / 2;
    let tw = sel.w;
    if (drag) {
      tx = clamp(drag.x, first.x + first.w / 2, last.x + last.w / 2);
      const i = nearestTab(tx, this.#rects.map((r) => r.x + r.w / 2));
      tw = this.#rects[i]!.w;
    }
    if (!this.#placed || reduced) {
      this.#x = tx;
      this.#w = tw;
      this.#vx = this.#vw = 0;
      this.#placed = true;
    } else {
      [this.#x, this.#vx] = springStep(this.#x, this.#vx, tx, deltaMs, drag ? 900 : 260, drag ? 55 : 22);
      [this.#w, this.#vw] = springStep(this.#w, this.#vw, tw, deltaMs, 300, 24);
    }
    const amount = reduced ? 0 : parseNumber(this.getAttribute('stretch'), 0.8, 0, 1);
    const [extra, hk] = liquidStretch(this.#vx, this.#w, amount);
    const w = Math.max(this.#h * 1.15, this.#w + extra);
    const h = this.#h * hk;
    // Keep the glass inside the bar (the end tabs would otherwise push it past the rounded ends).
    const span = last.x + last.w - first.x;
    const cx = w >= span ? first.x + span / 2 : clamp(this.#x, first.x + w / 2, last.x + last.w - w / 2);
    const left = cx - w / 2;
    const top = (this.#h - h) / 2;
    const pad = this.#content!.offsetLeft;
    const lens = this.#lens!;
    lens.style.width = `${w.toFixed(1)}px`;
    lens.style.height = `${h.toFixed(1)}px`;
    lens.style.transform = `translate(${(left + pad).toFixed(1)}px, ${(top + this.#content!.offsetTop).toFixed(1)}px)`;

    // Refraction: a map built at the tab's resting size, stretched with the lens.
    const bw = Math.max(8, Math.round(tw));
    const bh = Math.max(8, Math.round(this.#h));
    const key = `${bw}x${bh}`;
    const map = this.#map!;
    if (key !== this.#mapKey) {
      this.#mapKey = key;
      const url = this.#mapFor(bw, bh);
      if (url) map.setAttribute('href', url);
      const strength = parseNumber(this.getAttribute('strength'), 0.6, 0, 1);
      const disp = parseNumber(this.getAttribute('dispersion'), 0.35, 0, 1);
      const scale = strength * bh;
      const spread = 0.35 * disp;
      const [r, g, b] = this.#disp;
      r?.setAttribute('scale', String(scale * (1 + spread)));
      g?.setAttribute('scale', String(scale));
      b?.setAttribute('scale', String(scale * (1 - spread)));
      const f = this.#filter!;
      f.setAttribute('x', '0');
      f.setAttribute('y', '0');
      f.setAttribute('width', String(Math.ceil(this.#content!.scrollWidth)));
      f.setAttribute('height', String(Math.ceil(this.#h)));
      if (url && !this.#content!.style.filter) this.#content!.style.filter = `url(#${this.#id})`;
    }
    map.setAttribute('x', left.toFixed(1));
    map.setAttribute('y', top.toFixed(1));
    map.setAttribute('width', w.toFixed(1));
    map.setAttribute('height', h.toFixed(1));

    const moving = Math.abs(this.#x - tx) > 0.2 || Math.abs(this.#vx) > 1 || Math.abs(this.#w - tw) > 0.2 || Math.abs(this.#vw) > 1;
    if (!moving && !drag) this.#resting = true;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ane-glass-tabs': GlassTabsElement;
  }
  interface HTMLElementEventMap {
    'ane-tab-change': CustomEvent<{ index: number; tab: HTMLElement }>;
  }
}

/** Registers `<ane-glass-tabs>` (or a custom tag name). Safe to call more than once. */
export function defineGlassTabs(tag = 'ane-glass-tabs'): void {
  defineElement(tag, GlassTabsElement);
}
