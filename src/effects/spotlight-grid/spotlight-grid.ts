import { defineElement, EffectElement } from '../../core/effect-element';
import { clamp, damp, parseNumber, springStep } from '../../core/math';

/** Distance from a point to the nearest point of a rectangle (0 inside). */
export function distToRect(px: number, py: number, r: { x: number; y: number; w: number; h: number }): number {
  const dx = Math.max(r.x - px, 0, px - (r.x + r.w));
  const dy = Math.max(r.y - py, 0, py - (r.y + r.h));
  return Math.hypot(dx, dy);
}

/**
 * Brightness a light wave adds to a card: a soft band of `width` px around the wave front at radius
 * `radius`, fading out over the wave's `life` (0..1 elapsed).
 */
export function waveAt(radius: number, distance: number, life: number, width = 90): number {
  if (life < 0 || life >= 1) return 0;
  const k = (radius - distance) / width;
  return Math.exp(-k * k) * (1 - life) ** 1.5;
}

const STYLE = /* css */ `
:host {
  --_c: var(--ane-spot-color, #8ab4ff);
  --_a: var(--ane-spot-accent, #c58bff);
  --_r: var(--ane-spot-radius, 340px);
  --_bw: var(--ane-spot-border, 1.5px);
  --_gap: var(--ane-spot-dot-gap, 22px);
  --_sheen: var(--ane-spot-sheen, 0.75);
  --x: -1000px;
  --y: -1000px;
  --i: 0;
  display: block;
  position: relative;
  isolation: isolate;
}
:host([hidden]) { display: none; }
.bg, .frames { position: absolute; inset: 0; pointer-events: none; }
.bg { z-index: -1; overflow: hidden; border-radius: inherit; }
.dots { position: absolute; inset: 0; background-image: radial-gradient(circle, rgba(255, 255, 255, 0.9) 0.9px, transparent 1.4px);
  background-size: var(--_gap) var(--_gap); background-position: calc(var(--_gap) / 2) calc(var(--_gap) / 2); opacity: 0.07; }
.dots.lit { opacity: calc(var(--i) * 0.9);
  background-image: radial-gradient(circle, var(--_a) 1px, transparent 1.6px);
  -webkit-mask-image: radial-gradient(var(--_r) circle at var(--x) var(--y), #000 0%, rgba(0, 0, 0, 0.35) 45%, transparent 75%);
  mask-image: radial-gradient(var(--_r) circle at var(--x) var(--y), #000 0%, rgba(0, 0, 0, 0.35) 45%, transparent 75%); }
.glow { position: absolute; inset: 0; opacity: calc(var(--i) * 0.7);
  background: radial-gradient(calc(var(--_r) * 1.1) circle at var(--x) var(--y), color-mix(in srgb, var(--_c) 32%, transparent), transparent 70%); }
.wave { position: absolute; inset: 0; opacity: var(--wo, 0);
  background: radial-gradient(circle at var(--wx, 50%) var(--wy, 50%), transparent calc(var(--wr, 0px) - 70px),
    color-mix(in srgb, var(--_a) 22%, transparent) calc(var(--wr, 0px) - 6px), transparent calc(var(--wr, 0px) + 2px)); }
.frames { z-index: 2; }
.ring, .fill { position: absolute; border-radius: var(--br, 16px); }
.ring {
  box-sizing: border-box;
  padding: var(--_bw);
  background:
    radial-gradient(var(--_r) circle at calc(var(--x) - var(--cx)) calc(var(--y) - var(--cy)),
      color-mix(in srgb, color-mix(in srgb, #fff 45%, var(--_c)) calc(var(--i) * 100%), transparent),
      color-mix(in srgb, var(--_c) calc(var(--i) * 90%), transparent) 28%,
      color-mix(in srgb, var(--_a) calc(var(--i) * 45%), transparent) 52%, transparent 74%),
    linear-gradient(color-mix(in srgb, var(--_a) calc(var(--pulse, 0) * 100%), transparent), color-mix(in srgb, var(--_c) calc(var(--pulse, 0) * 100%), transparent));
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask: linear-gradient(#000 0 0) content-box exclude, linear-gradient(#000 0 0);
}
.fill {
  background: radial-gradient(calc(var(--_r) * 0.9) circle at calc(var(--x) - var(--cx)) calc(var(--y) - var(--cy)),
    color-mix(in srgb, var(--_c) calc(var(--i) * 32%), transparent), transparent 70%);
  opacity: calc(var(--_sheen) + var(--pulse, 0) * 0.6);
  mix-blend-mode: screen;
}
`;

interface Card {
  el: HTMLElement;
  ring: HTMLElement;
  fill: HTMLElement;
  x: number;
  y: number;
  w: number;
  h: number;
  pulse: number;
}

interface Wave {
  x: number;
  y: number;
  t0: number;
  reach: number;
}

const WAVE_SPEED = 1100; // px per second

/**
 * `<ane-spotlight-grid>`: one shared light for a whole wall of cards. The light follows the pointer
 * with a little inertia, lights card borders (including neighbours, across the gaps), reveals a dot
 * grid behind them and sends a light wave through the wall on click. Put your cards inside; style the
 * host as your grid.
 *
 * @attr color - main light colour, default `#8ab4ff`
 * @attr accent - dots, wave and the light's outer tint, default `#c58bff`
 * @attr radius - light radius (CSS length), default `340px`
 * @attr intensity - `0`-`1`, default `1`
 * @attr border - lit border width (CSS length), default `1.5px`
 * @attr sheen - light on the card surfaces, `0`-`1`, default `0.75`
 * @attr dots - `on` (default) | `off`
 * @attr dot-gap - dot grid spacing (CSS length), default `22px`
 * @attr idle - `on` (default: the light drifts when nobody points) | `off`
 * @attr speed, motion
 */
export class SpotlightGridElement extends EffectElement {
  static override get observedAttributes(): string[] {
    return [...super.observedAttributes, 'color', 'accent', 'radius', 'intensity', 'border', 'sheen', 'dots', 'dot-gap', 'idle'];
  }

  #frames: HTMLElement | null = null;
  #slot: HTMLSlotElement | null = null;
  #dotsEl: HTMLElement | null = null;
  #waveEl: HTMLElement | null = null;
  #cards: Card[] = [];
  #dirty = true;
  #w = 0;
  #h = 0;
  #ro: ResizeObserver | null = null;
  #pointer: { x: number; y: number } | null = null;
  #focus: Card | null = null;
  #light = { x: 0, y: 0, vx: 0, vy: 0, i: 0, placed: false };
  #waves: Wave[] = [];
  #resting = false;
  #last = '';

  protected build(root: ShadowRoot): void {
    root.innerHTML = `<style>${STYLE}</style><div class="bg" part="background" aria-hidden="true"><div class="glow"></div><div class="dots"></div><div class="dots lit"></div><div class="wave"></div></div><slot></slot><div class="frames" aria-hidden="true"></div>`;
    this.#frames = root.querySelector('.frames');
    this.#slot = root.querySelector('slot');
    this.#dotsEl = root.querySelector('.bg');
    this.#waveEl = root.querySelector('.wave');
    this.#slot!.addEventListener('slotchange', () => this.#collect());
    this.addEventListener('pointermove', this.#onMove);
    this.addEventListener('pointerdown', (e) => {
      this.#onMove(e);
      const p = this.#local(e);
      this.pulse(p.x, p.y);
    });
    this.addEventListener('pointerleave', this.#onLeave);
    this.addEventListener('pointercancel', this.#onLeave);
    this.addEventListener('pointerup', (e) => e.pointerType !== 'mouse' && this.#onLeave());
    this.addEventListener('focusin', (e) => {
      this.#focus = this.#cards.find((c) => c.el === e.target || c.el.contains(e.target as Node)) ?? null;
      this.#wake();
    });
    this.addEventListener('focusout', () => {
      this.#focus = null;
      this.#wake();
    });
    this.#sync();
    this.#collect();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (!this.#ro && typeof ResizeObserver === 'function') {
      this.#ro = new ResizeObserver(() => {
        this.#dirty = true;
        this.#wake();
      });
      this.#ro.observe(this);
      for (const c of this.#cards) this.#ro.observe(c.el);
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#ro?.disconnect();
    this.#ro = null;
  }

  protected override attributeChanged(): void {
    this.#sync();
    this.#wake();
  }

  protected override motionChanged(): void {
    this.#wake();
  }

  /** Sends a light wave through the wall from (x, y) in the element's coordinates (default: centre). */
  pulse(x?: number, y?: number): void {
    if (this.reducedMotion) return;
    this.#measure();
    const px = x ?? this.#w / 2;
    const py = y ?? this.#h / 2;
    const reach = Math.max(Math.hypot(px, py), Math.hypot(this.#w - px, py), Math.hypot(px, this.#h - py), Math.hypot(this.#w - px, this.#h - py)) + 120;
    this.#waves.push({ x: px, y: py, t0: this.elapsed, reach });
    if (this.#waves.length > 4) this.#waves.shift();
    this.#wake();
  }

  /** The slotted cards, in order. */
  get cards(): HTMLElement[] {
    return this.#cards.map((c) => c.el);
  }

  #sync(): void {
    const set = (attr: string, prop: string): void => {
      const v = this.getAttribute(attr);
      if (v) this.style.setProperty(prop, v);
      else this.style.removeProperty(prop);
    };
    set('color', '--ane-spot-color');
    set('accent', '--ane-spot-accent');
    set('radius', '--ane-spot-radius');
    set('border', '--ane-spot-border');
    set('dot-gap', '--ane-spot-dot-gap');
    const sheen = this.getAttribute('sheen');
    if (sheen != null) this.style.setProperty('--ane-spot-sheen', String(parseNumber(sheen, 0.75, 0, 1)));
    else this.style.removeProperty('--ane-spot-sheen');
    if (this.#dotsEl) this.#dotsEl.style.display = this.getAttribute('dots') === 'off' ? 'none' : '';
  }

  #collect(): void {
    const els = (this.#slot?.assignedElements({ flatten: true }) ?? []) as HTMLElement[];
    this.#frames!.replaceChildren();
    this.#cards = els.map((el) => {
      const ring = document.createElement('div');
      ring.className = 'ring';
      const fill = document.createElement('div');
      fill.className = 'fill';
      this.#frames!.append(fill, ring);
      this.#ro?.observe(el);
      return { el, ring, fill, x: 0, y: 0, w: 0, h: 0, pulse: 0 };
    });
    this.#dirty = true;
    this.#wake();
  }

  /** Card rectangles relative to the host (only when something moved or resized). */
  #measure(): void {
    if (!this.#dirty) return;
    this.#dirty = false;
    const host = this.getBoundingClientRect();
    this.#w = host.width;
    this.#h = host.height;
    for (const c of this.#cards) {
      const r = c.el.getBoundingClientRect();
      c.x = r.left - host.left;
      c.y = r.top - host.top;
      c.w = r.width;
      c.h = r.height;
      const st = c.ring.style;
      const radius = getComputedStyle(c.el).borderRadius || '16px';
      for (const node of [c.ring, c.fill]) {
        const s = node.style;
        s.left = `${c.x}px`;
        s.top = `${c.y}px`;
        s.width = `${c.w}px`;
        s.height = `${c.h}px`;
        s.setProperty('--cx', `${c.x}px`);
        s.setProperty('--cy', `${c.y}px`);
        s.setProperty('--br', radius);
      }
      void st;
    }
    if (!this.#light.placed && this.#w) {
      this.#light.x = this.#w * 0.5;
      this.#light.y = this.#h * 0.35;
      this.#light.placed = true;
    }
  }

  #local(e: PointerEvent): { x: number; y: number } {
    const r = this.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  #onMove = (e: PointerEvent): void => {
    if (e.pointerType !== 'mouse' && e.type === 'pointermove' && e.buttons === 0) return;
    this.#pointer = this.#local(e);
    this.#wake();
  };

  #onLeave = (): void => {
    this.#pointer = null;
    this.#wake();
  };

  #wake(): void {
    this.#resting = false;
  }

  protected tick(deltaMs: number): void {
    const idle = this.getAttribute('idle') !== 'off';
    const reduced = this.reducedMotion;
    const drifting = idle && !reduced && !this.#pointer && !this.#focus;
    if (this.#resting && !drifting && !this.#dirty) return;
    this.#measure();
    if (!this.#w) return;

    // Target: pointer, then keyboard focus, then the idle drift.
    let tx: number;
    let ty: number;
    let ti = 0;
    const strength = parseNumber(this.getAttribute('intensity'), 1, 0, 1);
    if (this.#pointer) {
      ({ x: tx, y: ty } = this.#pointer);
      ti = strength;
    } else if (this.#focus) {
      tx = this.#focus.x + this.#focus.w / 2;
      ty = this.#focus.y + this.#focus.h / 2;
      ti = strength;
    } else if (drifting) {
      const t = this.elapsed / 1000;
      tx = this.#w * (0.5 + 0.4 * Math.sin(t * 0.37));
      ty = this.#h * (0.5 + 0.36 * Math.sin(t * 0.53 + 1));
      ti = strength * 0.75;
    } else {
      tx = this.#light.x;
      ty = this.#light.y;
      ti = reduced && idle ? strength * 0.5 : 0;
    }

    const L = this.#light;
    let moving = false;
    if (reduced) {
      L.x = tx;
      L.y = ty;
      L.vx = L.vy = 0;
      L.i = ti;
    } else {
      [L.x, L.vx] = springStep(L.x, L.vx, tx, deltaMs, 140, 20);
      [L.y, L.vy] = springStep(L.y, L.vy, ty, deltaMs, 140, 20);
      L.i = damp(L.i, ti, 6, deltaMs);
      moving = Math.abs(L.x - tx) + Math.abs(L.y - ty) > 0.3 || Math.abs(L.vx) + Math.abs(L.vy) > 0.3 || Math.abs(L.i - ti) > 0.004;
    }

    const css = `${L.x.toFixed(1)}|${L.y.toFixed(1)}|${L.i.toFixed(3)}`;
    if (css !== this.#last) {
      this.#last = css;
      this.style.setProperty('--x', `${L.x.toFixed(1)}px`);
      this.style.setProperty('--y', `${L.y.toFixed(1)}px`);
      this.style.setProperty('--i', clamp(L.i, 0, 1).toFixed(3));
    }

    // Light waves: brighten each card as the front passes it.
    const now = this.elapsed;
    this.#waves = this.#waves.filter((w) => (now - w.t0) / 1000 < w.reach / WAVE_SPEED + 0.2);
    for (const c of this.#cards) {
      let p = 0;
      for (const w of this.#waves) {
        const age = (now - w.t0) / 1000;
        p = Math.max(p, waveAt(age * WAVE_SPEED, distToRect(w.x, w.y, c), age / (w.reach / WAVE_SPEED + 0.2)));
      }
      if (Math.abs(p - c.pulse) > 0.002 || (p === 0 && c.pulse !== 0)) {
        c.pulse = p;
        c.ring.style.setProperty('--pulse', p.toFixed(3));
        c.fill.style.setProperty('--pulse', p.toFixed(3));
      }
    }
    const wave = this.#waves.at(-1);
    if (this.#waveEl) {
      if (wave) {
        const age = (now - wave.t0) / 1000;
        const life = age / (wave.reach / WAVE_SPEED + 0.2);
        const s = this.#waveEl.style;
        s.setProperty('--wx', `${wave.x.toFixed(1)}px`);
        s.setProperty('--wy', `${wave.y.toFixed(1)}px`);
        s.setProperty('--wr', `${(age * WAVE_SPEED).toFixed(1)}px`);
        s.setProperty('--wo', ((1 - life) ** 1.2).toFixed(3));
      } else this.#waveEl.style.setProperty('--wo', '0');
    }
    if (!moving && !this.#waves.length) this.#resting = true;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ane-spotlight-grid': SpotlightGridElement;
  }
}

/** Registers `<ane-spotlight-grid>` (or a custom tag name). Safe to call more than once. */
export function defineSpotlightGrid(tag = 'ane-spotlight-grid'): void {
  defineElement(tag, SpotlightGridElement);
}
