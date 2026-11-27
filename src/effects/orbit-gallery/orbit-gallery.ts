import { defineElement, EffectElement } from '../../core/effect-element';
import { clamp, parseNumber, springStep } from '../../core/math';

const TAU = Math.PI * 2;

/** Wraps an angle to (-π, π]. */
export function wrapAngle(a: number): number {
  const w = a - TAU * Math.floor((a + Math.PI) / TAU);
  return w === -Math.PI ? Math.PI : w;
}

/** Positive modulo. */
export const mod = (a: number, n: number): number => ((a % n) + n) % n;

export interface Placement {
  /** Angle from the front, radians (-π, π]. */
  angle: number;
  x: number;
  z: number;
  /** Rotation around Y in degrees (cards face outwards by `facing`). */
  rotate: number;
  /** 0 at the front, 1 at the back. */
  depth: number;
  opacity: number;
  /** 1 for the card exactly at the front, falling to 0 one card away. */
  front: number;
}

/** Where card `i` of `n` sits on a ring of `radius` px when the ring is turned to `pos` (in cards). */
export function ringPlacement(i: number, pos: number, n: number, radius: number, facing = 0.8): Placement {
  const angle = wrapAngle(((i - pos) * TAU) / Math.max(1, n));
  const a = Math.abs(angle) / Math.PI;
  const t = clamp((a - 0.5) / 0.24, 0, 1);
  return {
    angle,
    x: Math.sin(angle) * radius,
    z: (Math.cos(angle) - 1) * radius,
    rotate: (angle * facing * 180) / Math.PI,
    depth: (1 - Math.cos(angle)) / 2,
    opacity: 1 - t * t * (3 - 2 * t),
    front: Math.max(0, 1 - Math.abs(angle) / (TAU / Math.max(1, n))) ** 2,
  };
}

/** The card a fling settles on: friction `f` (1/s) lets velocity `v` (cards/s) travel v / f further. */
export function flingTarget(pos: number, velocity: number, friction: number, n: number): number {
  const travel = clamp(velocity / friction, -n, n);
  return Math.round(pos + travel);
}

/** Default ring radius: the cards (plus a gap) laid around the circumference, never tighter than one card. */
export function autoRadius(cardWidth: number, n: number): number {
  return Math.max(cardWidth * 1.1, (cardWidth * 1.38 * Math.max(1, n)) / TAU);
}

const STYLE = /* css */ `
:host {
  --_accent: var(--ane-orbit-accent, #8b7bff);
  display: block;
  position: relative;
  width: 100%; /* cards are absolutely positioned: without this a centring grid parent shrinks the host to 0 */
  height: var(--ane-size, 420px);
  overflow: hidden;
  touch-action: pan-y;
  user-select: none;
  -webkit-user-select: none;
  outline: none;
  contain: layout paint;
}
:host([hidden]) { display: none; }
:host(:focus-visible) { box-shadow: inset 0 0 0 2px var(--_accent); border-radius: 14px; }
.scene { position: absolute; inset: 0; perspective: var(--_persp, 1400px); perspective-origin: 50% var(--_cy, 44%); }
.ring { position: absolute; left: 50%; top: var(--_cy, 44%); width: 0; height: 0; transform-style: preserve-3d; }
.floor {
  position: absolute; left: 50%; top: calc(var(--_cy, 44%) + var(--_floor, 120px)); width: var(--_floorw, 600px); height: 90px;
  transform: translate(-50%, -50%); pointer-events: none;
  background: radial-gradient(closest-side, color-mix(in srgb, var(--_accent) 30%, transparent), transparent);
  filter: blur(8px); opacity: .8;
}
::slotted(*) {
  position: absolute !important;
  left: 0; top: 0;
  width: var(--ane-card-w, 200px);
  box-sizing: border-box;
  margin: 0;
  backface-visibility: hidden;
  transform-origin: 50% 50%;
  will-change: transform, opacity;
  filter: brightness(calc(1 - var(--ane-depth, 0) * var(--_dim, 0.6)));
}
:host([reflect]) ::slotted(*) { -webkit-box-reflect: below 8px linear-gradient(transparent 70%, rgb(0 0 0 / 0.24)); }
:host([data-dragging]) ::slotted(*) { cursor: grabbing; }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
`;

type Mode = 'rest' | 'drag' | 'coast' | 'snap' | 'wheel';

/**
 * `<ane-orbit-gallery>`: real DOM cards (images, text, links) on a tilted 3D ring. Drag or fling it:
 * it coasts with inertia and springs onto the nearest card. Click a side card to bring it round,
 * use the arrow keys, or let it autoplay. Cards further round shrink, dim and fade; the back is hidden.
 *
 * @attr card-width - card width in px, default `200`
 * @attr radius - ring radius in px, default: from the card count and width
 * @attr tilt - camera tilt in degrees, `-30`-`30`, default `10`
 * @attr facing - how much cards turn with the ring, `0` (always face you)-`1` (radial), default `0.6`
 * @attr perspective - CSS perspective in px, default `1400`
 * @attr autoplay - ms per card, `0` (default) = off; pauses on hover, focus and drag
 * @attr wheel - `horizontal` (default: trackpad sideways scroll) | `on` (any wheel) | `off`
 * @attr reflect - boolean: a soft floor reflection (Chromium / Safari)
 * @attr accent - colour of the floor glow and focus ring
 * @attr dim - how much cards darken towards the back, `0`-`1`, default `0.6`
 * @attr pop - extra scale of the front card, `0`-`0.5`, default `0.12`
 * @attr size - height (CSS length), default `420px`
 * @attr speed - autoplay time scale; motion - `auto` | `reduce` | `full`
 * @fires ane-orbit-change - `detail.index` when the front card changes
 */
export class OrbitGalleryElement extends EffectElement {
  static override get observedAttributes(): string[] {
    return [...super.observedAttributes, 'card-width', 'radius', 'tilt', 'facing', 'perspective', 'autoplay', 'accent', 'dim', 'pop', 'reflect'];
  }

  #slot: HTMLSlotElement | null = null;
  #ring: HTMLElement | null = null;
  #floor: HTMLElement | null = null;
  #live: HTMLElement | null = null;
  #cards: HTMLElement[] = [];
  /** Cards whose aria-label we generated ("2 of 8"), so it can be renumbered. */
  #autoLabel = new WeakSet<HTMLElement>();
  #pos = 0;
  #vel = 0;
  #target = 0;
  #mode: Mode = 'rest';
  #dirty = true;
  #lastIndex = -1;
  #announced = -1;
  #lastTick = 0;
  #idle = 0;
  #hover = false;
  #focusWithin = false;
  #wheelAt = 0;
  #suppressClick = false;
  #drag: { id: number; x0: number; pos0: number; lastX: number; lastT: number; moved: boolean; card: number } | null = null;

  /** The cards (slotted children). */
  get cards(): HTMLElement[] {
    // slotchange is asynchronous: if children were added since, collect them now.
    if (this.#cards.length !== this.children.length) this.#collect();
    return this.#cards;
  }

  /** Index of the card at the front. */
  get index(): number {
    const n = this.cards.length;
    return n ? mod(Math.round(this.#pos), n) : 0;
  }
  set index(i: number) {
    this.goTo(i);
  }

  /** Ring rotation in cards (continuous; for tests and custom UI). */
  get position(): number {
    return this.#pos;
  }

  /** Whether the ring is still moving. */
  get moving(): boolean {
    return this.#mode !== 'rest';
  }

  get #cardWidth(): number {
    return parseNumber(this.getAttribute('card-width'), 200, 60, 800);
  }

  /** Ring radius in px. */
  get radius(): number {
    const auto = autoRadius(this.#cardWidth, this.cards.length);
    return parseNumber(this.getAttribute('radius'), auto, 40, 4000);
  }

  /** Turns the ring the short way round to card `i`. */
  goTo(i: number): void {
    const n = this.cards.length;
    if (!n) return;
    const delta = wrapAngle(((mod(Math.round(i), n) - this.#pos) * TAU) / n) * (n / TAU);
    this.#target = Math.round(this.#pos + delta);
    this.#idle = 0;
    if (this.reducedMotion) {
      this.#pos = this.#target;
      this.#vel = 0;
      this.#mode = 'rest';
      this.#dirty = true;
      this.#render();
    } else this.#mode = 'snap';
  }

  next(): void {
    this.goTo(Math.round(this.#mode === 'snap' ? this.#target : this.#pos) + 1);
  }

  prev(): void {
    this.goTo(Math.round(this.#mode === 'snap' ? this.#target : this.#pos) - 1);
  }

  protected build(root: ShadowRoot): void {
    root.innerHTML = `<style>${STYLE}</style><div class="scene"><div class="floor" part="floor"></div><div class="ring" part="ring"><slot></slot></div></div><div class="sr" aria-live="polite"></div>`;
    this.#slot = root.querySelector('slot');
    this.#ring = root.querySelector('.ring');
    this.#floor = root.querySelector('.floor');
    this.#live = root.querySelector('.sr');
    if (!this.hasAttribute('role')) this.setAttribute('role', 'region');
    this.setAttribute('aria-roledescription', 'carousel');
    if (!this.hasAttribute('aria-label') && !this.hasAttribute('aria-labelledby')) this.setAttribute('aria-label', 'Gallery');
    if (!this.hasAttribute('tabindex')) this.tabIndex = 0;
    this.#slot?.addEventListener('slotchange', () => this.#collect());
    this.#collect();
    this.addEventListener('pointerdown', this.#onDown);
    this.addEventListener('pointermove', this.#onMove);
    this.addEventListener('pointerup', this.#onUp);
    this.addEventListener('pointercancel', this.#onUp);
    this.addEventListener('pointerenter', () => (this.#hover = true));
    this.addEventListener('pointerleave', () => (this.#hover = false));
    this.addEventListener('click', this.#onClick, true);
    this.addEventListener('dragstart', (e) => e.preventDefault());
    this.addEventListener('wheel', this.#onWheel, { passive: false });
    this.addEventListener('keydown', this.#onKey);
    this.addEventListener('focusin', this.#onFocusIn);
    this.addEventListener('focusout', () => (this.#focusWithin = this.matches(':focus-within')));
    this.#applyVars();
  }

  protected override attributeChanged(): void {
    this.#applyVars();
    this.#dirty = true;
  }

  protected override motionChanged(): void {
    if (this.reducedMotion && this.#mode !== 'drag') {
      this.#pos = Math.round(this.#mode === 'snap' ? this.#target : this.#pos);
      this.#vel = 0;
      this.#mode = 'rest';
    }
    this.#dirty = true;
  }

  #applyVars(): void {
    this.style.setProperty('--ane-card-w', `${this.#cardWidth}px`);
    this.style.setProperty('--_persp', `${parseNumber(this.getAttribute('perspective'), 1400, 300, 6000)}px`);
    this.style.setProperty('--_dim', String(parseNumber(this.getAttribute('dim'), 0.6, 0, 1)));
    const accent = this.getAttribute('accent');
    if (accent) this.style.setProperty('--ane-orbit-accent', accent);
    else this.style.removeProperty('--ane-orbit-accent');
  }

  #collect(): void {
    const assigned = this.#slot?.assignedElements() as HTMLElement[] | undefined;
    this.#cards = assigned?.length ? assigned : ([...this.children] as HTMLElement[]);
    const n = this.#cards.length;
    this.#cards.forEach((card, i) => {
      card.setAttribute('aria-roledescription', 'slide');
      if (!card.hasAttribute('role')) card.setAttribute('role', 'group');
      if (this.#autoLabel.has(card) || (!card.hasAttribute('aria-label') && !card.hasAttribute('aria-labelledby'))) {
        card.setAttribute('aria-label', `${i + 1} of ${n}`);
        this.#autoLabel.add(card);
      }
      card.draggable = false;
    });
    this.#dirty = true;
  }

  #label(card: HTMLElement, i: number): string {
    const n = this.cards.length;
    const own = this.#autoLabel.has(card) ? '' : card.getAttribute('aria-label');
    const title =
      own ||
      card.querySelector('[data-title], h1, h2, h3, h4, figcaption')?.textContent?.trim() ||
      card.textContent?.trim().slice(0, 80) ||
      '';
    return `${i + 1} of ${n}${title ? `: ${title}` : ''}`;
  }

  #cardOf(e: Event): number {
    for (const node of e.composedPath()) {
      const k = this.#cards.indexOf(node as HTMLElement);
      if (k >= 0) return k;
    }
    return -1;
  }

  get #pxPerCard(): number {
    return Math.max(40, (this.radius * TAU) / Math.max(1, this.cards.length));
  }

  #onDown = (e: PointerEvent): void => {
    this.#suppressClick = false;
    if (e.button !== 0 || !this.cards.length) return;
    this.#drag = { id: e.pointerId, x0: e.clientX, pos0: this.#pos, lastX: e.clientX, lastT: performance.now(), moved: false, card: this.#cardOf(e) };
    this.#vel = 0;
    this.#idle = 0;
  };

  #onMove = (e: PointerEvent): void => {
    const d = this.#drag;
    if (!d || e.pointerId !== d.id) return;
    const dx = e.clientX - d.x0;
    if (!d.moved) {
      if (Math.abs(dx) < 6) return;
      d.moved = true;
      this.#mode = 'drag';
      this.toggleAttribute('data-dragging', true);
      try {
        this.setPointerCapture(e.pointerId);
      } catch {
        /* synthetic or already released pointer */
      }
    }
    const now = performance.now();
    const dt = Math.max(1, now - d.lastT);
    const inst = (-(e.clientX - d.lastX) / this.#pxPerCard / dt) * 1000;
    this.#vel = this.#vel * 0.6 + inst * 0.4;
    d.lastX = e.clientX;
    d.lastT = now;
    this.#pos = d.pos0 - dx / this.#pxPerCard;
    this.#dirty = true;
  };

  #onUp = (e: PointerEvent): void => {
    const d = this.#drag;
    if (!d || e.pointerId !== d.id) return;
    this.#drag = null;
    this.toggleAttribute('data-dragging', false);
    if (d.moved) {
      this.#suppressClick = true;
      if (performance.now() - d.lastT > 90) this.#vel = 0;
      this.#vel = clamp(this.#vel, -14, 14); // cards per second: a hard flick, not a teleport
      if (this.reducedMotion) {
        this.#pos = Math.round(this.#pos);
        this.#vel = 0;
        this.#mode = 'rest';
        this.#dirty = true;
      } else this.#mode = Math.abs(this.#vel) > 1.2 ? 'coast' : 'snap';
      this.#target = Math.round(this.#pos);
      return;
    }
    // A press without a drag on a side card brings it round (and keeps its link from firing).
    const k = d.card;
    if (k >= 0 && k !== this.index) {
      this.#suppressClick = true;
      this.goTo(k);
    }
  };

  #onClick = (e: MouseEvent): void => {
    if (!this.#suppressClick) return;
    this.#suppressClick = false;
    e.preventDefault();
    e.stopPropagation();
  };

  #onWheel = (e: WheelEvent): void => {
    const mode = this.getAttribute('wheel') ?? 'horizontal';
    if (mode === 'off' || !this.cards.length) return;
    const horizontal = Math.abs(e.deltaX) > Math.abs(e.deltaY);
    const delta = horizontal ? e.deltaX : mode === 'on' ? e.deltaY : 0;
    if (!delta) return;
    e.preventDefault();
    const scale = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
    this.#pos += (delta * scale) / this.#pxPerCard;
    this.#vel = 0;
    this.#mode = 'wheel';
    this.#wheelAt = performance.now();
    this.#idle = 0;
    this.#dirty = true;
  };

  #onKey = (e: KeyboardEvent): void => {
    const t = e.target as HTMLElement;
    if (t !== this && !this.#cards.includes(t)) return;
    const n = this.cards.length;
    if (!n) return;
    const map: Record<string, () => void> = {
      ArrowRight: () => this.next(),
      ArrowDown: () => this.next(),
      ArrowLeft: () => this.prev(),
      ArrowUp: () => this.prev(),
      Home: () => this.goTo(0),
      End: () => this.goTo(n - 1),
    };
    const fn = map[e.key];
    if (!fn) return;
    e.preventDefault();
    fn();
  };

  #onFocusIn = (e: FocusEvent): void => {
    this.#focusWithin = true;
    const k = this.#cardOf(e);
    if (k >= 0 && k !== this.index && e.target !== this) this.goTo(k);
  };

  protected tick(_deltaMs: number): void {
    // Interaction runs in real time; `speed` only scales the autoplay interval (via deltaMs).
    const now = performance.now();
    const dt = this.#lastTick ? Math.min(64, Math.max(0, now - this.#lastTick)) : 16;
    this.#lastTick = now;
    const n = this.cards.length;
    if (!n) return;

    if (this.#mode === 'coast') {
      const friction = 3.2;
      this.#vel *= Math.exp((-friction * dt) / 1000);
      this.#pos += (this.#vel * dt) / 1000;
      if (Math.abs(this.#vel) < 1.6) {
        this.#target = flingTarget(this.#pos, this.#vel, friction, n);
        this.#mode = 'snap';
      }
      this.#dirty = true;
    } else if (this.#mode === 'wheel') {
      if (now - this.#wheelAt > 160) {
        this.#target = Math.round(this.#pos);
        this.#mode = 'snap';
      }
      this.#dirty = true;
    }
    if (this.#mode === 'snap') {
      [this.#pos, this.#vel] = springStep(this.#pos, this.#vel, this.#target, dt, 110, 19);
      if (Math.abs(this.#pos - this.#target) < 0.0015 && Math.abs(this.#vel) < 0.01) {
        this.#pos = this.#target;
        this.#vel = 0;
        this.#mode = 'rest';
      }
      this.#dirty = true;
    }

    // Autoplay: one card every `autoplay` ms while nobody is interacting.
    const autoplay = parseNumber(this.getAttribute('autoplay'), 0, 0, 60000);
    if (autoplay > 0 && !this.reducedMotion && this.#mode === 'rest' && !this.#hover && !this.#focusWithin && !this.#drag) {
      this.#idle += _deltaMs;
      if (this.#idle >= autoplay) {
        this.#idle = 0;
        this.next();
      }
    } else if (this.#mode !== 'rest') this.#idle = 0;

    if (this.#dirty) this.#render();
  }

  #render(): void {
    this.#dirty = false;
    const cards = this.cards;
    const n = cards.length;
    if (!n || !this.#ring) return;
    const R = this.radius;
    const facing = parseNumber(this.getAttribute('facing'), 0.6, 0, 1);
    const tilt = parseNumber(this.getAttribute('tilt'), 10, -30, 30);
    const lean = this.reducedMotion ? 0 : clamp(-this.#vel * 2.2, -12, 12);
    const pop = parseNumber(this.getAttribute('pop'), 0.12, 0, 0.5);
    this.#ring.style.transformOrigin = `0 0 ${-R}px`;
    // Tilt around the ring centre, then lift it back so the front card stays at --_cy.
    const rad = (tilt * Math.PI) / 180;
    this.#ring.style.transform = `translate3d(0, ${(-R * Math.sin(rad)).toFixed(2)}px, ${(R * (1 - Math.cos(rad))).toFixed(2)}px) rotateX(${-tilt}deg)`;
    if (this.#floor) {
      this.style.setProperty('--_floorw', `${Math.round(R * 2 + this.#cardWidth)}px`);
      this.style.setProperty('--_floor', `${Math.round(this.#cardWidth * 0.75)}px`);
    }
    const front = this.index;
    cards.forEach((card, i) => {
      const p = ringPlacement(i, this.#pos, n, R, facing);
      const turn = p.rotate + lean;
      // Cards seen nearly edge-on fade out too (a sliver of a card is just noise).
      const opacity = p.opacity * clamp((78 - Math.abs(turn)) / 14, 0, 1);
      card.style.transform = `translate(-50%, -50%) translate3d(${p.x.toFixed(2)}px, 0, ${p.z.toFixed(2)}px) rotateY(${turn.toFixed(2)}deg) scale(${(1 + pop * p.front).toFixed(4)})`;
      card.style.opacity = opacity.toFixed(3);
      card.style.visibility = opacity < 0.01 ? 'hidden' : '';
      card.style.pointerEvents = opacity < 0.3 ? 'none' : '';
      card.style.setProperty('--ane-depth', p.depth.toFixed(3));
      card.toggleAttribute('data-current', i === front);
    });
    if (front !== this.#lastIndex) {
      const first = this.#lastIndex < 0;
      this.#lastIndex = front;
      if (!first) this.dispatchEvent(new CustomEvent('ane-orbit-change', { detail: { index: front }, bubbles: true, composed: true }));
    }
    if (this.#mode === 'rest' && front !== this.#announced && this.#live) {
      const first = this.#announced < 0;
      this.#announced = front;
      if (!first) this.#live.textContent = this.#label(cards[front]!, front);
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ane-orbit-gallery': OrbitGalleryElement;
  }
  interface HTMLElementEventMap {
    'ane-orbit-change': CustomEvent<{ index: number }>;
  }
}

/** Registers `<ane-orbit-gallery>` (or a custom tag name). Safe to call more than once. */
export function defineOrbitGallery(tag = 'ane-orbit-gallery'): void {
  defineElement(tag, OrbitGalleryElement);
}
