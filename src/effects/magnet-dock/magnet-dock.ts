import { defineElement, EffectElement } from '../../core/effect-element';
import { clamp, damp, parseNumber, springStep } from '../../core/math';

export { springStep };

/** Target scale for an icon at distance `d` (px) from the pointer: cosine² falloff over `range` px. */
export function magnifyAt(d: number, range: number, max: number): number {
  if (!(range > 0)) return 1;
  const k = Math.min(1, Math.abs(d) / range);
  const c = Math.cos((k * Math.PI) / 2);
  return 1 + (max - 1) * c * c;
}

const STYLE = /* css */ `
:host {
  --_size: calc(var(--ane-size, 52px) * var(--_fit, 1));
  --_gap: var(--ane-dock-gap, 10px);
  --_tint: var(--ane-dock-tint, rgba(255, 255, 255, 0.14));
  --_accent: var(--ane-dock-accent, #ffffff);
  display: inline-block;
  position: relative;
  -webkit-tap-highlight-color: transparent;
}
:host([hidden]) { display: none; }
.shelf {
  position: relative;
  display: flex;
  align-items: flex-end;
  gap: var(--_gap);
  padding: calc(var(--_size) * 0.2) calc(var(--_size) * 0.24);
  border-radius: calc(var(--_size) * 0.42);
  box-sizing: border-box;
  height: calc(var(--_size) * 1.4);
  touch-action: pan-y;
}
.glass {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.02) 55%), var(--_tint);
  -webkit-backdrop-filter: blur(18px) saturate(1.6);
  backdrop-filter: blur(18px) saturate(1.6);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.45),
    inset 0 0 0 1px rgba(255, 255, 255, 0.18),
    0 18px 40px rgba(6, 8, 20, 0.35),
    0 2px 6px rgba(6, 8, 20, 0.2);
  pointer-events: none;
}
::slotted(*) {
  position: relative;
  flex: none;
  box-sizing: border-box;
  width: calc(var(--_size) * var(--s, 1));
  height: calc(var(--_size) * var(--s, 1));
  margin: 0;
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  cursor: pointer;
  border-radius: 22%;
  transform: translate(var(--x, 0px), var(--y, 0px)) scale(var(--sx, 1), var(--sy, 1));
  transform-origin: 50% 100%;
  will-change: width, height, transform;
}
::slotted(:focus-visible) { outline: 2px solid var(--_accent); outline-offset: 4px; }
.dots { position: absolute; left: 0; right: 0; bottom: 3px; height: 4px; pointer-events: none; }
.dot {
  position: absolute;
  bottom: 0;
  width: 4px;
  height: 4px;
  margin-left: -2px;
  border-radius: 50%;
  background: var(--_accent);
  box-shadow: 0 0 6px var(--_accent);
  opacity: 0.85;
}
.label {
  position: absolute;
  box-sizing: border-box;
  text-align: center;
  left: 0;
  bottom: 100%;
  margin-bottom: 10px;
  padding: 6px 11px;
  border-radius: 8px;
  background: rgba(14, 16, 28, 0.82);
  -webkit-backdrop-filter: blur(10px);
  backdrop-filter: blur(10px);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.14), 0 8px 22px rgba(0, 0, 0, 0.3);
  color: #fff;
  font: 500 12.5px/1 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  overflow: hidden;
  will-change: transform, opacity, width;
}
.label span { display: inline-block; }
:host([labels="none"]) .label { display: none; }
`;

interface Item {
  el: HTMLElement;
  s: number;
  vs: number;
  x: number;
  vx: number;
  bounceAt: number;
}

const BOUNCE_MS = 720;

/**
 * `<ane-magnet-dock>`: a magnifying dock for any buttons or links. Icons spring towards the
 * pointer and lean in, one shared label glides between them, launches bounce, and keyboard
 * focus and touch scrubbing magnify too.
 *
 * @attr size - icon size (CSS length), default `52px`
 * @attr magnify - maximum scale, `1`-`3`, default `1.85`
 * @attr range - influence radius in icon widths, default `2.6`
 * @attr lean - how far icons lean towards the pointer, `0`-`1`, default `0.35`
 * @attr gap - space between icons (CSS length), default `10px`
 * @attr tint - glass tint (CSS colour)
 * @attr accent - focus ring and activity dots, default `#fff`
 * @attr labels - `auto` (default) | `none`
 * @attr fit - `auto` (default: shrinks icons when the parent is too narrow for the dock and its magnification) | `none`
 * @attr speed, motion
 * @fires ane-dock-launch - when an icon is activated (`detail.item`)
 */
export class MagnetDockElement extends EffectElement {
  static override get observedAttributes(): string[] {
    return [...super.observedAttributes, 'magnify', 'range', 'lean', 'gap', 'tint', 'accent', 'labels', 'fit'];
  }

  #shelf: HTMLElement | null = null;
  #label: HTMLElement | null = null;
  #labelText: HTMLElement | null = null;
  #dots: HTMLElement | null = null;
  #slot: HTMLSlotElement | null = null;
  #items: Item[] = [];
  #pointer: number | null = null;
  #focusIndex = -1;
  #label$ = { x: 0, vx: 0, y: 0, w: 0, o: 0, fade: 1, text: '', tw: 0 };
  #resting = true;
  #mutations: MutationObserver | null = null;
  #resize: ResizeObserver | null = null;
  #fit = 1;

  protected build(root: ShadowRoot): void {
    root.innerHTML = `<style>${STYLE}</style><div class="shelf" part="shelf"><div class="glass" part="glass"></div><slot></slot><div class="dots"></div></div><div class="label" aria-hidden="true"><span></span></div>`;
    this.#shelf = root.querySelector('.shelf');
    this.#label = root.querySelector('.label');
    this.#labelText = root.querySelector('.label span');
    this.#dots = root.querySelector('.dots');
    this.#slot = root.querySelector('slot');
    this.#slot!.addEventListener('slotchange', () => this.#collect());
    if (!this.hasAttribute('role')) this.setAttribute('role', 'toolbar');
    if (!this.hasAttribute('aria-orientation')) this.setAttribute('aria-orientation', 'horizontal');

    const shelf = this.#shelf!;
    shelf.addEventListener('pointermove', (e) => this.#onPointer(e));
    shelf.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch') shelf.setPointerCapture?.(e.pointerId);
      this.#onPointer(e);
    });
    shelf.addEventListener('pointerleave', () => this.#setPointer(null));
    shelf.addEventListener('pointerup', (e) => {
      if (e.pointerType === 'touch') this.#setPointer(null);
    });
    shelf.addEventListener('pointercancel', () => this.#setPointer(null));
    this.addEventListener('focusin', (e) => {
      const i = this.#items.findIndex((it) => it.el === e.target || it.el.contains(e.target as Node));
      if (i >= 0) {
        this.#focusIndex = i;
        this.#rove(i);
        this.#wake();
      }
    });
    this.addEventListener('focusout', () => {
      this.#focusIndex = -1;
      this.#wake();
    });
    this.addEventListener('keydown', (e) => this.#onKey(e));
    this.addEventListener('click', (e) => {
      const item = this.#items.find((it) => it.el === e.target || it.el.contains(e.target as Node));
      if (item) this.launch(item.el);
    });
    this.#syncVars();
    this.#collect();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (!this.#mutations && typeof MutationObserver === 'function') {
      // Activity dots follow `data-active` on the items.
      this.#mutations = new MutationObserver(() => this.#syncDots());
      this.#mutations.observe(this, { attributes: true, subtree: true, attributeFilter: ['data-active'] });
    }
    if (!this.#resize && typeof ResizeObserver === 'function' && this.parentElement) {
      this.#resize = new ResizeObserver(() => this.#refit());
      this.#resize.observe(this.parentElement);
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#mutations?.disconnect();
    this.#mutations = null;
    this.#resize?.disconnect();
    this.#resize = null;
  }

  protected override attributeChanged(): void {
    this.#syncVars();
    this.#refit();
    this.#wake();
  }

  protected override motionChanged(): void {
    this.#wake();
  }

  /** Plays the launch bounce on an item (also fired by clicks). */
  launch(el: Element): void {
    const item = this.#items.find((it) => it.el === el);
    if (!item) return;
    if (!this.reducedMotion) item.bounceAt = this.elapsed;
    this.dispatchEvent(new CustomEvent('ane-dock-launch', { detail: { item: el }, bubbles: true, composed: true }));
    this.#wake();
  }

  /** The slotted items, in order. */
  get items(): HTMLElement[] {
    return this.#items.map((it) => it.el);
  }

  #syncVars(): void {
    const set = (attr: string, prop: string): void => {
      const v = this.getAttribute(attr);
      if (v) this.style.setProperty(prop, v);
      else this.style.removeProperty(prop);
    };
    set('gap', '--ane-dock-gap');
    set('tint', '--ane-dock-tint');
    set('accent', '--ane-dock-accent');
  }

  /**
   * Shrinks icons when the parent cannot hold the resting dock plus room for magnification,
   * so a dock never forces horizontal scrolling on a phone.
   */
  #refit(): void {
    const parent = this.parentElement;
    const shelf = this.#shelf;
    const first = this.#items[0];
    if (!parent || !shelf || !first) return;
    let fit = 1;
    if (this.getAttribute('fit') !== 'none') {
      const cs = getComputedStyle(parent);
      const avail = parent.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
      const size = first.el.offsetWidth / (first.s || 1) / this.#fit;
      const gap = parseFloat(getComputedStyle(shelf).columnGap) || 0;
      const n = this.#items.length;
      const max = parseNumber(this.getAttribute('magnify'), 1.85, 1, 3);
      const need = n * size + (n - 1) * gap + size * 0.48 + (max - 1) * size * 1.3;
      if (avail > 0 && size > 0 && need > avail) fit = Math.max(0.45, (avail - (n - 1) * gap) / (need - (n - 1) * gap));
    }
    if (Math.abs(fit - this.#fit) < 0.005) return;
    this.#fit = fit;
    if (fit === 1) this.style.removeProperty('--_fit');
    else this.style.setProperty('--_fit', fit.toFixed(3));
    this.#wake();
  }

  #collect(): void {
    const els = (this.#slot?.assignedElements({ flatten: true }) ?? []) as HTMLElement[];
    this.#items = els.map((el) => this.#items.find((it) => it.el === el) ?? { el, s: 1, vs: 0, x: 0, vx: 0, bounceAt: -Infinity });
    const current = this.#items.findIndex((it) => it.el.getAttribute('tabindex') === '0');
    this.#rove(Math.max(0, current));
    this.#syncDots();
    this.#refit();
    this.#wake();
  }

  /** Toolbar pattern: one tab stop, arrow keys move between items. */
  #rove(index: number): void {
    this.#items.forEach((it, i) => it.el.setAttribute('tabindex', i === index ? '0' : '-1'));
  }

  #syncDots(): void {
    const dots = this.#dots;
    if (!dots) return;
    dots.replaceChildren(
      ...this.#items.map((it) => {
        const d = document.createElement('i');
        d.className = 'dot';
        d.hidden = !it.el.hasAttribute('data-active');
        return d;
      }),
    );
    this.#wake();
  }

  #onPointer(e: PointerEvent): void {
    if (e.pointerType === 'touch' && e.type === 'pointermove' && e.buttons === 0) return;
    // Kept in viewport coordinates: the shelf itself widens as icons grow.
    this.#setPointer(e.clientX);
  }

  #setPointer(x: number | null): void {
    this.#pointer = x;
    this.#wake();
  }

  #onKey(e: KeyboardEvent): void {
    const n = this.#items.length;
    if (!n) return;
    const current = this.#items.findIndex((it) => it.el === document.activeElement || it.el.contains(document.activeElement));
    let next = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (current + 1 + n) % n;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (current - 1 + n) % n;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = n - 1;
    if (next < 0) return;
    e.preventDefault();
    this.#items[next]!.el.focus();
  }

  #wake(): void {
    this.#resting = false;
  }

  #labelFor(el: HTMLElement): string {
    return el.getAttribute('aria-label') || el.getAttribute('title') || el.dataset.label || el.textContent?.trim() || '';
  }

  protected tick(deltaMs: number): void {
    if (this.#resting || !this.#shelf || !this.#items.length) return;
    const reduced = this.reducedMotion;
    const size = this.#items[0]!.el.offsetWidth / (this.#items[0]!.s || 1) || 52;
    const max = clamp(parseNumber(this.getAttribute('magnify'), 1.85, 1, 3), 1, 3);
    const range = parseNumber(this.getAttribute('range'), 2.6, 0.5, 8) * size;
    const lean = parseNumber(this.getAttribute('lean'), 0.35, 0, 1);
    const shelfBox = this.#shelf.getBoundingClientRect();

    // Read all centres first (one layout), then write. Centres exclude the lean offset.
    const halves: number[] = [];
    const centres = this.#items.map((it) => {
      const r = it.el.getBoundingClientRect();
      halves.push(r.width / 2);
      return r.left - shelfBox.left + r.width / 2 - it.x;
    });

    // Focus behaves like a pointer resting on the focused icon.
    let px = this.#pointer == null ? null : this.#pointer - shelfBox.left;
    let hovered = -1;
    if (px == null && this.#focusIndex >= 0) px = centres[this.#focusIndex] ?? null;
    if (px != null) {
      let best = Infinity;
      centres.forEach((c, i) => {
        const d = Math.abs(c - px!);
        if (d < best) {
          best = d;
          hovered = i;
        }
      });
      if (this.#focusIndex < 0 && best > (halves[hovered] ?? 0) + size * 0.12) hovered = -1;
    }

    let moving = false;
    this.#items.forEach((it, i) => {
      const d = px == null ? Infinity : px - centres[i]!;
      let target = px == null ? 1 : magnifyAt(d, range, max);
      let lx = px == null ? 0 : (clamp(d, -range, range) * lean * 0.4 * (target - 1)) / Math.max(0.01, max - 1);
      if (reduced) {
        target = i === hovered ? Math.min(max, 1.3) : 1;
        lx = 0;
        it.s = target;
        it.vs = 0;
        it.x = 0;
        it.vx = 0;
      } else {
        [it.s, it.vs] = springStep(it.s, it.vs, target, deltaMs);
        [it.x, it.vx] = springStep(it.x, it.vx, lx, deltaMs, 260, 22);
      }
      // Launch bounce: two hops with squash and stretch.
      let y = 0;
      let sx = 1;
      let sy = 1;
      const bt = (this.elapsed - it.bounceAt) / BOUNCE_MS;
      if (bt >= 0 && bt < 1) {
        const hop = bt < 0.6 ? Math.sin((bt / 0.6) * Math.PI) : 0.35 * Math.sin(((bt - 0.6) / 0.4) * Math.PI);
        y = -hop * size * 0.55;
        const land = Math.max(0, 1 - Math.abs(bt - 0.6) / 0.06) * 0.12;
        sx = 1 + land - hop * 0.04;
        sy = 1 - land + hop * 0.06;
        moving = true;
      }
      const st = it.el.style;
      st.setProperty('--s', it.s.toFixed(4));
      st.setProperty('--x', `${it.x.toFixed(2)}px`);
      st.setProperty('--y', `${y.toFixed(2)}px`);
      st.setProperty('--sx', sx.toFixed(3));
      st.setProperty('--sy', sy.toFixed(3));
      if (Math.abs(it.s - target) > 0.0005 || Math.abs(it.vs) > 0.001 || Math.abs(it.x - lx) > 0.05 || Math.abs(it.vx) > 0.05) moving = true;
    });

    // Activity dots sit under each icon.
    const dots = this.#dots?.children;
    if (dots) {
      this.#items.forEach((it, i) => {
        const dot = dots[i] as HTMLElement | undefined;
        if (dot) dot.style.left = `${(centres[i]! + it.x).toFixed(1)}px`;
      });
    }

    moving = this.#updateLabel(hovered, centres, shelfBox.width, size, deltaMs, reduced) || moving;
    if (!moving) this.#resting = true;
  }

  /** Glides the shared label over the hovered icon. Returns true while it is still moving. */
  #updateLabel(hovered: number, centres: number[], width: number, size: number, deltaMs: number, reduced: boolean): boolean {
    const label = this.#label;
    const text = this.#labelText;
    if (!label || !text || this.getAttribute('labels') === 'none') return false;
    const L = this.#label$;
    const item = this.#items[hovered];
    const targetOpacity = item ? 1 : 0;
    if (item) {
      const t = this.#labelFor(item.el);
      if (t !== L.text) {
        L.text = t;
        text.textContent = t;
        L.tw = text.offsetWidth + 22; // padding
        if (L.o < 0.05) {
          L.x = centres[hovered]! + item.x;
          L.w = L.tw;
        } else if (!reduced) {
          L.fade = 0; // the new text fades in while the pill glides
        }
      }
      // Ride just above the (magnified) icon.
      L.y = -(item.s - 1) * size;
    }
    const tx = item ? centres[hovered]! + item.x : L.x;
    if (reduced) {
      L.x = tx;
      L.w = L.tw;
      L.o = targetOpacity;
    } else {
      [L.x, L.vx] = springStep(L.x, L.vx, tx, deltaMs, 300, 26);
      L.w = damp(L.w, L.tw, 18, deltaMs);
      L.o = damp(L.o, targetOpacity, 16, deltaMs);
    }
    L.fade = reduced ? 1 : damp(L.fade, 1, 22, deltaMs);
    if (L.fade > 0.995) L.fade = 1;
    text.style.opacity = L.fade.toFixed(3);
    text.style.filter = L.fade < 1 ? `blur(${((1 - L.fade) * 3).toFixed(2)}px)` : '';
    const left = clamp(L.x - L.w / 2, -20, width - L.w + 20);
    label.style.width = `${L.w.toFixed(1)}px`;
    label.style.transform = `translate(${left.toFixed(1)}px, ${(L.y + (1 - L.o) * 6).toFixed(1)}px)`;
    label.style.opacity = L.o.toFixed(3);
    return Math.abs(L.x - tx) > 0.2 || Math.abs(L.vx) > 0.2 || Math.abs(L.o - targetOpacity) > 0.01 || Math.abs(L.w - L.tw) > 0.3 || L.fade < 1;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ane-magnet-dock': MagnetDockElement;
  }
  interface HTMLElementEventMap {
    'ane-dock-launch': CustomEvent<{ item: Element }>;
  }
}

/** Registers `<ane-magnet-dock>` (or a custom tag name). Safe to call more than once. */
export function defineMagnetDock(tag = 'ane-magnet-dock'): void {
  defineElement(tag, MagnetDockElement);
}
