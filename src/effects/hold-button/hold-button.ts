import { createRandom, clamp, damp, parseNumber } from '../../core/math';
import { defineElement, EffectElement } from '../../core/effect-element';

/**
 * Clip-path polygon for the liquid fill: a vertical front at `p` (0..1 of the width) that ripples
 * with time. Coordinates are percentages, so the polygon is size-independent.
 */
export function waveFront(p: number, t: number, amp = 2.2, steps = 14): string {
  if (p <= 0) return 'polygon(0% 0%, 0% 0%, 0% 100%, 0% 100%)';
  if (p >= 1) return 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)';
  const pts = ['0% 0%'];
  for (let i = 0; i <= steps; i++) {
    const y = i / steps;
    const x = p * 100 + amp * Math.sin(y * Math.PI * 2 + t * 6) * Math.min(1, p * 8) * Math.min(1, (1 - p) * 8);
    pts.push(`${x.toFixed(2)}% ${(y * 100).toFixed(2)}%`);
  }
  pts.push('0% 100%');
  return `polygon(${pts.join(', ')})`;
}

/** Shake amplitude (px) for a progress value: nothing until 60 %, then building towards the end. */
export function anticipation(p: number): number {
  return p < 0.6 ? 0 : ((p - 0.6) / 0.4) ** 2 * 1.6;
}

const STYLE = /* css */ `
:host {
  --_color: var(--ane-hold-color, #ff4d5e);
  --_accent: var(--ane-hold-accent, #2fd39a);
  --_bg: var(--ane-hold-bg, #171a26);
  --_fg: var(--ane-hold-fg, #ffffff);
  --p: 0;
  display: inline-block;
  position: relative;
  vertical-align: middle;
  border-radius: 999px;
  cursor: pointer;
  user-select: none;
  -webkit-user-select: none;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
  outline: none;
}
:host([hidden]) { display: none; }
:host(:focus-visible) .btn { box-shadow: 0 0 0 2px var(--_bg), 0 0 0 4px var(--_color); }
.btn {
  position: relative;
  display: grid;
  place-items: center;
  min-height: var(--ane-size, 48px);
  padding: 0 26px;
  border-radius: inherit;
  overflow: hidden;
  isolation: isolate;
  background: var(--_bg);
  color: var(--_fg);
  font: 600 15px/1 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  letter-spacing: 0.01em;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.10),
    inset 0 0 0 1px color-mix(in srgb, var(--_color) calc(25% + var(--p) * 45%), transparent),
    0 0 calc(var(--p) * 28px) calc(var(--p) * 2px) color-mix(in srgb, var(--_color) calc(var(--p) * 55%), transparent),
    0 8px 22px rgba(0, 0, 0, 0.25);
  will-change: transform;
}
.fill {
  position: absolute;
  inset: 0;
  z-index: -1;
  clip-path: polygon(0% 0%, 0% 0%, 0% 100%, 0% 100%); /* empty until the first frame */
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.22), transparent 55%),
    linear-gradient(90deg, color-mix(in srgb, var(--_color) 75%, #000), var(--_color));
}
.btn.done { --_color: var(--_accent); }
.done .fill { background: linear-gradient(180deg, rgba(255, 255, 255, 0.22), transparent 55%), var(--_accent); }
.label, .ok { grid-area: 1 / 1; display: inline-flex; align-items: center; gap: 8px; white-space: nowrap; }
.ok { opacity: 0; transform: translateY(14px); }
.ok svg { width: 18px; height: 18px; }
.ok path { stroke-dasharray: 24; stroke-dashoffset: 24; }
canvas { position: absolute; left: -60px; top: -60px; width: calc(100% + 120px); height: calc(100% + 120px); pointer-events: none; }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
`;

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  age: number;
  size: number;
  hue: number;
}

/**
 * `<ane-hold-button>`: press and hold to confirm. A liquid fill with a rippling front advances while
 * held (with a squish, a growing glow and a little shake near the end), drains back if released
 * early, and completes with a drawn check mark and a burst. Mouse, touch and keyboard (Space / Enter).
 *
 * @attr duration - hold time in ms, default `1500`
 * @attr color - fill colour, default `#ff4d5e`
 * @attr accent - colour once confirmed, default `#2fd39a`
 * @attr done-text - text shown when confirmed, default `Done`
 * @attr reset-after - ms before it resets after confirming (`0` = stay confirmed), default `2400`
 * @attr haptics - vibrate on completion where supported (`on` default | `off`)
 * @attr disabled - not interactive
 * @attr size, speed, motion
 * @fires ane-hold-start, ane-hold-cancel, ane-hold-complete
 */
export class HoldButtonElement extends EffectElement {
  static override get observedAttributes(): string[] {
    return [...super.observedAttributes, 'duration', 'color', 'accent', 'done-text', 'disabled'];
  }

  #btn: HTMLElement | null = null;
  #fill: HTMLElement | null = null;
  #label: HTMLElement | null = null;
  #ok: HTMLElement | null = null;
  #okText: HTMLElement | null = null;
  #check: SVGPathElement | null = null;
  #canvas: HTMLCanvasElement | null = null;
  #sr: HTMLElement | null = null;
  #holding = false;
  #progress = 0;
  #squish = 0;
  #done = false;
  #doneAt = 0;
  #resetAt = -1e9;
  #sparks: Spark[] = [];
  #rand = createRandom(11);
  #resting = false;
  #pointerId: number | null = null;

  /** Current progress, 0..1. */
  get progress(): number {
    return this.#progress;
  }

  /** True once the hold has completed (until it resets). */
  get confirmed(): boolean {
    return this.#done;
  }

  protected build(root: ShadowRoot): void {
    root.innerHTML = `<style>${STYLE}</style>
<div class="btn" part="button">
  <div class="fill" part="fill"></div>
  <span class="label" part="label"><slot>Hold to confirm</slot></span>
  <span class="ok" part="done" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg><span class="ok-text"></span></span>
</div>
<canvas aria-hidden="true"></canvas>
<span class="sr" id="hint">Press and hold to confirm.</span>
<span class="sr" aria-live="assertive" id="live"></span>`;
    const $ = <T extends Element>(s: string): T => root.querySelector<T>(s)!;
    this.#btn = $('.btn');
    this.#fill = $('.fill');
    this.#label = $('.label');
    this.#ok = $('.ok');
    this.#okText = $('.ok-text');
    this.#check = $('.ok path');
    this.#canvas = $('canvas');
    this.#sr = $('#live');
    if (!this.hasAttribute('role')) this.setAttribute('role', 'button');
    if (!this.hasAttribute('aria-description')) this.setAttribute('aria-description', 'Press and hold to confirm');
    this.#syncDisabled();
    this.#syncVars();

    this.addEventListener('pointerdown', (e) => {
      if (e.button > 0 || this.#pointerId !== null) return;
      this.#pointerId = e.pointerId;
      try {
        this.setPointerCapture(e.pointerId);
      } catch {
        // synthetic pointer: fine without capture
      }
      e.preventDefault();
      // Pointer focus should not show the keyboard focus ring.
      this.focus({ preventScroll: true, focusVisible: false } as FocusOptions);
      this.#start();
    });
    const end = (e: PointerEvent): void => {
      if (e.pointerId !== this.#pointerId) return;
      this.#pointerId = null;
      this.#stop();
    };
    this.addEventListener('pointerup', end);
    this.addEventListener('pointercancel', end);
    this.addEventListener('lostpointercapture', end);
    this.addEventListener('contextmenu', (e) => e.preventDefault()); // long-press menu on touch
    this.addEventListener('keydown', (e) => {
      if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
        e.preventDefault();
        this.#start();
      } else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
      }
    });
    this.addEventListener('keyup', (e) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        this.#stop();
      }
    });
    this.addEventListener('blur', () => this.#stop());
  }

  protected override attributeChanged(name: string): void {
    if (name === 'disabled') this.#syncDisabled();
    this.#syncVars();
    this.#resting = false;
  }

  /** Back to the unconfirmed state. */
  reset(): void {
    this.#done = false;
    this.#holding = false;
    this.#resetAt = this.elapsed;
    // Animated: the fill drains away and the label fades back in.
    if (this.reducedMotion) this.#progress = 0;
    this.#resting = false;
    this.#btn?.classList.remove('done');
    if (this.#sr) this.#sr.textContent = '';
  }

  #syncDisabled(): void {
    const off = this.hasAttribute('disabled');
    this.setAttribute('aria-disabled', String(off));
    this.tabIndex = off ? -1 : 0;
    this.style.opacity = off ? '0.5' : '';
    this.style.cursor = off ? 'not-allowed' : '';
    if (off) this.#stop();
  }

  #syncVars(): void {
    for (const [a, p] of [['color', '--ane-hold-color'], ['accent', '--ane-hold-accent']] as const) {
      const v = this.getAttribute(a);
      if (v) this.style.setProperty(p, v);
      else this.style.removeProperty(p);
    }
    if (this.#okText) this.#okText.textContent = this.getAttribute('done-text') ?? 'Done';
  }

  #emit(name: string): void {
    this.dispatchEvent(new CustomEvent(name, { detail: { progress: this.#progress }, bubbles: true, composed: true }));
  }

  #start(): void {
    if (this.hasAttribute('disabled') || this.#done || this.#holding) return;
    this.#holding = true;
    this.#resting = false;
    this.#emit('ane-hold-start');
  }

  #stop(): void {
    if (!this.#holding) return;
    this.#holding = false;
    this.#resting = false;
    if (!this.#done) this.#emit('ane-hold-cancel');
  }

  #complete(): void {
    this.#done = true;
    this.#holding = false;
    this.#doneAt = this.elapsed;
    this.#btn?.classList.add('done');
    if (this.#sr) this.#sr.textContent = this.getAttribute('done-text') ?? 'Done';
    if (!this.reducedMotion) this.#burst();
    if (this.getAttribute('haptics') !== 'off') {
      try {
        navigator.vibrate?.(this.reducedMotion ? 0 : [12, 40, 18]);
      } catch {
        // not supported
      }
    }
    this.#emit('ane-hold-complete');
  }

  #burst(): void {
    const c = this.#canvas;
    if (!c) return;
    const w = c.clientWidth;
    const h = c.clientHeight;
    for (let i = 0; i < 46; i++) {
      const a = this.#rand() * Math.PI * 2;
      const v = 90 + this.#rand() * 260;
      // Emit from the button's outline so the burst reads as the pill "popping".
      const ex = w / 2 + Math.cos(a) * (w / 2 - 60) * 0.95;
      const ey = h / 2 + Math.sin(a) * (h / 2 - 60) * 0.9;
      this.#sparks.push({ x: ex, y: ey, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, life: 0.5 + this.#rand() * 0.6, age: 0, size: 1.5 + this.#rand() * 2.5, hue: this.#rand() });
    }
  }

  protected tick(deltaMs: number): void {
    if (this.#resting && !this.#sparks.length) return;
    const reduced = this.reducedMotion;
    const dt = deltaMs / 1000;
    const duration = parseNumber(this.getAttribute('duration'), 1500, 200, 10000);
    if (this.#done) {
      this.#progress = 1;
      const resetAfter = parseNumber(this.getAttribute('reset-after'), 2400, 0, 60000);
      if (resetAfter > 0 && this.elapsed - this.#doneAt > resetAfter) this.reset();
    } else if (this.#holding) {
      this.#progress = Math.min(1, this.#progress + deltaMs / duration);
      if (this.#progress >= 1) this.#complete();
    } else if (this.#progress > 0) {
      // Drain back faster than it filled.
      this.#progress = Math.max(0, this.#progress - deltaMs / (duration * 0.4));
    }
    const p = this.#progress;
    const pressed = this.#holding ? 1 : 0;
    this.#squish = reduced ? 0 : damp(this.#squish, pressed, 18, deltaMs);
    const doneK = this.#done ? clamp((this.elapsed - this.#doneAt) / 380, 0, 1) : 0;
    const pop = this.#done && !reduced ? Math.sin(doneK * Math.PI) * 0.06 : 0;
    const shake = this.#holding && !reduced ? anticipation(p) * Math.sin(this.elapsed * 0.09) : 0;
    const btn = this.#btn!;
    btn.style.transform = `translateX(${shake.toFixed(2)}px) scale(${(1 - 0.035 * this.#squish + pop).toFixed(4)})`;
    this.style.setProperty('--p', p.toFixed(3));
    this.#fill!.style.clipPath = waveFront(p, reduced ? 0 : this.elapsed / 1000, reduced ? 0 : 2.4);

    // Label out, check in.
    const backK = clamp((this.elapsed - this.#resetAt) / 320, 0, 1);
    const k = reduced ? (this.#done ? 1 : 0) : this.#done ? doneK : 1 - backK;
    const e = 1 - (1 - k) ** 3;
    this.#label!.style.opacity = (1 - e).toFixed(3);
    this.#label!.style.transform = `translateY(${(-14 * e).toFixed(2)}px)`;
    this.#ok!.style.opacity = e.toFixed(3);
    this.#ok!.style.transform = `translateY(${(14 * (1 - e)).toFixed(2)}px)`;
    this.#check!.style.strokeDashoffset = (24 * (1 - (reduced ? k : clamp((k - 0.2) / 0.8, 0, 1)))).toFixed(2);

    this.#drawSparks(dt);
    const still = !this.#holding && (this.#done ? doneK >= 1 && !(parseNumber(this.getAttribute('reset-after'), 2400, 0, 60000) > 0) : p === 0 && backK >= 1) && Math.abs(this.#squish) < 0.002;
    if (still) this.#resting = true;
  }

  #drawSparks(dt: number): void {
    const c = this.#canvas;
    if (!c) return;
    const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
    const w = c.clientWidth;
    const h = c.clientHeight;
    if (!this.#sparks.length) {
      if (c.width) c.width = 0;
      return;
    }
    if (c.width !== Math.round(w * dpr)) {
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
    }
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const accent = getComputedStyle(this).getPropertyValue('--ane-hold-accent').trim() || '#2fd39a';
    const color = getComputedStyle(this).getPropertyValue('--ane-hold-color').trim() || '#ff4d5e';
    this.#sparks = this.#sparks.filter((s) => (s.age += dt) < s.life);
    for (const s of this.#sparks) {
      s.vx *= 0.92;
      s.vy = s.vy * 0.92 + 260 * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      const a = 1 - s.age / s.life;
      ctx.globalAlpha = a;
      ctx.fillStyle = s.hue < 0.6 ? accent : s.hue < 0.85 ? '#ffffff' : color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size * (0.6 + 0.4 * a), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ane-hold-button': HoldButtonElement;
  }
  interface HTMLElementEventMap {
    'ane-hold-start': CustomEvent<{ progress: number }>;
    'ane-hold-cancel': CustomEvent<{ progress: number }>;
    'ane-hold-complete': CustomEvent<{ progress: number }>;
  }
}

/** Registers `<ane-hold-button>` (or a custom tag name). Safe to call more than once. */
export function defineHoldButton(tag = 'ane-hold-button'): void {
  defineElement(tag, HoldButtonElement);
}
