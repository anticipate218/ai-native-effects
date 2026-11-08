import { defineElement, EffectElement } from '../../core/effect-element';
import {
  clamp,
  createRandom,
  damp,
  easeInOutSine,
  easeOutBack,
  hump,
  parseNumber,
  r2,
} from '../../core/math';

export const BUDDY_STATES = ['idle', 'thinking', 'waiting', 'success', 'error'] as const;
export type BuddyState = (typeof BUDDY_STATES)[number];

export const DEFAULT_BUDDY_LABELS: Readonly<Record<BuddyState, string>> = {
  idle: 'AI assistant is idle',
  thinking: 'AI assistant is thinking',
  waiting: 'AI assistant is waiting for input',
  success: 'AI assistant finished successfully',
  error: 'AI assistant ran into an error',
};

export interface BuddyStateChangeDetail {
  state: BuddyState;
  previous: BuddyState;
}

export const isBuddyState = (value: unknown): value is BuddyState =>
  typeof value === 'string' && (BUDDY_STATES as readonly string[]).includes(value);

/** Every continuous channel of the character. Each state defines a target pose. */
interface Pose {
  bob: number; // hover amplitude (viewBox units)
  bobRate: number; // hover frequency (Hz)
  sway: number; // head sway amplitude (deg)
  lean: number; // constant head tilt (deg)
  droop: number; // antenna bend (deg, + = drooping)
  lookX: number;
  lookY: number;
  eyeH: number; // eye height scale
  happy: number; // 0..1 blend towards ^ ^ eyes
  squint: number; // 0..1 blend towards > < eyes
  smile: number; // -1 frown .. 1 smile
  mouthW: number;
  mouthX: number;
  blush: number;
  armL: number; // deg, + = raised outwards
  armR: number;
  dial: number; // ear dial spin (deg/s)
  pulse: number; // antenna light pulse (Hz)
}

type PoseKey = keyof Pose;

const POSES: Readonly<Record<BuddyState, Readonly<Pose>>> = {
  idle: { bob: 3, bobRate: 0.5, sway: 1.5, lean: 0, droop: 0, lookX: 0, lookY: 0, eyeH: 1, happy: 0, squint: 0, smile: 0.45, mouthW: 1, mouthX: 0, blush: 0.35, armL: 12, armR: 12, dial: 24, pulse: 0.45 },
  thinking: { bob: 2, bobRate: 0.65, sway: 5, lean: -4, droop: -6, lookX: 4, lookY: -5, eyeH: 0.78, happy: 0, squint: 0, smile: 0, mouthW: 0.55, mouthX: 3, blush: 0.2, armL: 14, armR: 40, dial: 260, pulse: 2.2 },
  waiting: { bob: 2.5, bobRate: 0.5, sway: 2.5, lean: 0, droop: 0, lookX: 0, lookY: 0, eyeH: 0.95, happy: 0, squint: 0, smile: 0.15, mouthW: 0.8, mouthX: 0, blush: 0.25, armL: 16, armR: 16, dial: 50, pulse: 0.8 },
  success: { bob: 3.5, bobRate: 0.9, sway: 3, lean: 0, droop: -8, lookX: 0, lookY: -1, eyeH: 1, happy: 1, squint: 0, smile: 1, mouthW: 1.25, mouthX: 0, blush: 0.85, armL: 125, armR: 125, dial: 120, pulse: 1.4 },
  error: { bob: 1, bobRate: 0.35, sway: 0.8, lean: 7, droop: 24, lookX: 0, lookY: 3, eyeH: 1, happy: 0, squint: 1, smile: -0.8, mouthW: 0.9, mouthX: 0, blush: 0, armL: 4, armR: 4, dial: 0, pulse: 3.5 },
};

const POSE_KEYS = Object.keys(POSES.idle) as PoseKey[];
const BADGES = ['thinking', 'waiting', 'success', 'error'] as const;
/** Visual size of each state badge (the thought cloud needs room for its dots). */
const BADGE_SCALE: Record<(typeof BADGES)[number], number> = { thinking: 1.3, waiting: 1.15, success: 1.1, error: 1.1 };
const TONES = ['accent', 'warning', 'success', 'danger'] as const;
type Tone = (typeof TONES)[number];
const STATE_TONE: Record<BuddyState, Tone> = {
  idle: 'accent',
  thinking: 'accent',
  waiting: 'warning',
  success: 'success',
  error: 'danger',
};
/** Duration of a status-light color change (ms, effect time). */
const TONE_FADE = 350;
const CONFETTI_COUNT = 18;
const CONFETTI_LIFE = 1500;
const BADGE_X = 163;
const BADGE_Y = 30;
const DOT_X = [-6, 3, 12];

interface Particle {
  el: SVGRectElement;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  spin: number;
  life: number;
}

let instanceCount = 0;

const byTone = (nodes: SVGCircleElement[]): Record<Tone, SVGCircleElement> =>
  Object.fromEntries(nodes.map((node) => [node.getAttribute('data-tone'), node])) as Record<Tone, SVGCircleElement>;

const STYLE = /* css */ `
:host {
  display: inline-block;
  position: relative;
  width: var(--ane-size, 160px);
  aspect-ratio: 1 / 1;
  vertical-align: middle;
  contain: layout style;
  -webkit-tap-highlight-color: transparent;
}
:host([hidden]) { display: none; }
svg {
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
  --_primary: var(--ane-buddy-color, #7c5cff);
  --_accent: var(--ane-buddy-accent, #5ef2ff);
  --_success: var(--ane-success, #3ddc97);
  --_warning: var(--ane-warning, #ffb547);
  --_danger: var(--ane-danger, #ff5d6c);
  --_head-light: var(--_primary);
  --_shell: var(--_primary);
  --_trim: var(--_primary);
}
@supports (color: color-mix(in oklab, red, blue)) {
  svg {
    --_head-light: color-mix(in oklab, var(--_primary) 68%, white);
    --_shell: color-mix(in oklab, var(--_primary) 80%, black);
    --_trim: color-mix(in oklab, var(--_primary) 55%, white);
  }
}
.shadow { fill: var(--_primary); }
.tone-accent { --_tone: var(--_accent); }
.tone-warning { --_tone: var(--_warning); }
.tone-success { --_tone: var(--_success); }
.tone-danger { --_tone: var(--_danger); }
.lamp { fill: var(--_tone); }
.glow-in { stop-color: var(--_tone); stop-opacity: 0.85; }
.glow-out { stop-color: var(--_tone); stop-opacity: 0; }
.lamp-base { fill: #20244a; }
.head-light { stop-color: var(--_head-light); }
.head-base { stop-color: var(--_primary); }
.shell { fill: var(--_shell); }
.arm { fill: var(--_shell); }
.dial-ring { fill: #171b38; stroke: var(--_trim); stroke-width: 3; }
.dial-tick { stroke: var(--_accent); stroke-width: 2.4; stroke-linecap: round; }
.stem { fill: none; stroke: var(--_trim); stroke-width: 3.5; stroke-linecap: round; }
.eye-glow-in { stop-color: var(--_accent); stop-opacity: 0.45; }
.eye-glow-out { stop-color: var(--_accent); stop-opacity: 0; }
.pill { fill: var(--_accent); }
.happy, .squint, .mouth { fill: none; stroke: var(--_accent); stroke-width: 3.6; stroke-linecap: round; stroke-linejoin: round; }
.cheek { fill: #ff7ab6; }
.glare { fill: none; stroke: #fff; stroke-opacity: 0.2; stroke-width: 3.5; stroke-linecap: round; }
.cloud { fill: #fff; stroke: var(--_trim); stroke-width: 1.5; }
.dot { fill: var(--_primary); }
.hg-ring { fill: #12162e; stroke: var(--_warning); stroke-width: 2; }
.hg-frame { fill: none; stroke: #ffe7bf; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.hg-sand { fill: var(--_warning); }
.hg-stream { stroke: var(--_warning); stroke-width: 1.2; }
.ok-ring { fill: var(--_success); }
.ok-check { fill: none; stroke: #fff; stroke-width: 3.4; stroke-linecap: round; stroke-linejoin: round; stroke-dasharray: 22; }
.fail-ring { fill: var(--_danger); }
.fail-mark { stroke: #fff; stroke-width: 3.4; stroke-linecap: round; }
.fail-dot { fill: #fff; }
.spark { stroke: #ffd166; stroke-width: 2.2; stroke-linecap: round; }
.sweat { fill: #8fd8ff; }
.c0 { fill: var(--_primary); }
.c1 { fill: var(--_accent); }
.c2 { fill: var(--_success); }
.c3 { fill: #ffd166; }
.c4 { fill: #ff7ab6; }
.sr {
  position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0;
  overflow: hidden; clip-path: inset(50%); white-space: nowrap; border: 0;
}
`;

/**
 * A status light: one glow + one lamp per tone, cross-faded in JS (not CSS transitions)
 * so color changes follow `speed` and the virtual capture clock.
 */
function lamp(id: string, name: string, cx: number, cy: number, r: number, glowR: number): string {
  return `<g class="${name}-glows">${TONES.map((tone) => `<circle data-tone="${tone}" cx="${cx}" cy="${cy}" r="${glowR}" fill="url(#${id}-glow-${tone})" opacity="0"/>`).join('')}</g>
    <circle class="lamp-base" cx="${cx}" cy="${cy}" r="${r}"/>
    <g class="${name}-lamps">${TONES.map((tone) => `<circle class="lamp tone-${tone}" data-tone="${tone}" cx="${cx}" cy="${cy}" r="${r}" opacity="0"/>`).join('')}</g>`;
}

function template(id: string): string {
  const confetti = Array.from(
    { length: CONFETTI_COUNT },
    (_, i) => `<rect class="confetti c${i % 5}" x="-2" y="-3.5" width="4" height="7" rx="1" visibility="hidden"/>`,
  ).join('');
  const sparks = [-150, -110, -70, -30]
    .map((angle) => `<line class="spark" x1="${r2(Math.cos((angle * Math.PI) / 180) * 10)}" y1="${r2(Math.sin((angle * Math.PI) / 180) * 10)}" x2="${r2(Math.cos((angle * Math.PI) / 180) * 16)}" y2="${r2(Math.sin((angle * Math.PI) / 180) * 16)}" opacity="0"/>`)
    .join('');
  return /* html */ `
<style>${STYLE}</style>
<svg viewBox="0 0 200 200" role="img" data-state="idle">
  <defs>
    <linearGradient id="${id}-head" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" class="head-light"/><stop offset="1" class="head-base"/>
    </linearGradient>
    <linearGradient id="${id}-visor" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#1d2250"/><stop offset="1" stop-color="#080b1c"/>
    </linearGradient>
    ${TONES.map((tone) => `<radialGradient id="${id}-glow-${tone}" class="tone-${tone}"><stop offset="0" class="glow-in"/><stop offset="1" class="glow-out"/></radialGradient>`).join('')}
    <radialGradient id="${id}-eyes"><stop offset="0" class="eye-glow-in"/><stop offset="1" class="eye-glow-out"/></radialGradient>
  </defs>
  <ellipse part="shadow" class="shadow" cx="100" cy="180" rx="34" ry="6" opacity="0.3"/>
  <g class="badge" data-badge="thinking" visibility="hidden">
    <circle class="cloud" cx="-16" cy="15" r="2.4"/>
    <circle class="cloud" cx="-9" cy="7.5" r="3.6"/>
    <path class="cloud" d="M-14 9 H14 A9 9 0 0 0 16 -8 A11 11 0 0 0 -4 -14 A9 9 0 0 0 -19 -6 A8 8 0 0 0 -14 9 Z" transform="translate(4 -2)"/>
    <circle class="dot" cx="-6" cy="-1" r="3"/><circle class="dot" cx="3" cy="-1" r="3"/><circle class="dot" cx="12" cy="-1" r="3"/>
  </g>
  <g class="badge" data-badge="waiting" visibility="hidden">
    <circle class="hg-ring" r="15"/>
    <g class="hourglass">
      <path class="hg-sand hg-top"/><path class="hg-sand hg-bottom"/>
      <line class="hg-stream" x1="0" y1="0" x2="0" y2="8"/>
      <path class="hg-frame" d="M-6 -9 L6 -9 L0 0 L6 9 L-6 9 L0 0 Z"/>
      <path class="hg-frame" d="M-8 -9.5 H8 M-8 9.5 H8"/>
    </g>
  </g>
  <g class="badge" data-badge="success" visibility="hidden">
    <circle class="ok-ring" r="14"/>
    <path class="ok-check" d="M-6.5 0.5 L-2 5 L6.5 -4.5" stroke-dashoffset="22"/>
  </g>
  <g class="badge" data-badge="error" visibility="hidden">
    <circle class="fail-ring" r="14"/>
    <g class="fail-glyph"><line class="fail-mark" x1="0" y1="-6.5" x2="0" y2="2.4"/><circle class="fail-dot" cy="6.8" r="1.9"/></g>
  </g>
  <g class="char">
    <g class="arm-l" transform="translate(73 124)"><rect class="arm" x="-5" y="-2" width="10" height="24" rx="5"/></g>
    <g class="arm-r" transform="translate(127 124)"><rect class="arm" x="-5" y="-2" width="10" height="24" rx="5"/></g>
    <rect class="shell" x="73" y="112" width="54" height="42" rx="17"/>
    ${lamp(id, 'core', 100, 139, 4.8, 12)}
    <g class="head">
      <g class="antenna">
        <path class="stem" d="M100 40 V23"/>
        ${lamp(id, 'bulb', 100, 17, 6.5, 16)}
        <g class="sparks" transform="translate(100 17)">${sparks}</g>
      </g>
      <g class="dial" transform="translate(50 80)"><circle class="dial-ring" r="9"/><line class="dial-tick" x1="0" y1="0" x2="0" y2="-5.5"/></g>
      <g class="dial" transform="translate(150 80)"><circle class="dial-ring" r="9"/><line class="dial-tick" x1="0" y1="0" x2="0" y2="-5.5"/></g>
      <rect class="skull" x="50" y="38" width="100" height="82" rx="34" fill="url(#${id}-head)"/>
      <rect class="visor" x="61" y="52" width="78" height="54" rx="22" fill="url(#${id}-visor)"/>
      <ellipse class="eye-glow" cx="100" cy="78" rx="34" ry="19" fill="url(#${id}-eyes)"/>
      <path class="glare" d="M70 64 Q74 58 85 57"/>
      <g class="eye" data-side="l">
        <rect class="pill" x="-6" y="-10" width="12" height="20" rx="6"/>
        <path class="happy" d="M-7 3 Q0 -6 7 3" opacity="0"/>
        <path class="squint" d="M-6 -6 L5 0 L-6 6" opacity="0"/>
      </g>
      <g class="eye" data-side="r">
        <rect class="pill" x="-6" y="-10" width="12" height="20" rx="6"/>
        <path class="happy" d="M-7 3 Q0 -6 7 3" opacity="0"/>
        <path class="squint" d="M6 -6 L-5 0 L6 6" opacity="0"/>
      </g>
      <ellipse class="cheek" cx="77" cy="93" rx="6" ry="3.4" opacity="0"/>
      <ellipse class="cheek" cx="123" cy="93" rx="6" ry="3.4" opacity="0"/>
      <path class="mouth" d="M-6 0 Q0 3 6 0"/>
      <path class="sweat" d="M0 -5 C2.6 -1.2 3.6 1.4 3.6 2.6 A3.6 3.6 0 0 1 -3.6 2.6 C-3.6 1.4 -2.6 -1.2 0 -5 Z" opacity="0"/>
    </g>
  </g>
  <g class="confetti-layer">${confetti}</g>
</svg>
<span class="sr" aria-live="polite" aria-atomic="true"></span>`;
}

/**
 * `<ane-thinking-buddy>`: a small robot that turns agent status into body language.
 *
 * @attr state - `idle` | `thinking` | `waiting` | `success` | `error`
 * @attr color - body color (any CSS color)
 * @attr accent - eye and glow color (any CSS color)
 * @attr size - CSS length for width/height, default `160px`
 * @attr speed - animation time scale, `0`-`5`, default `1`
 * @attr motion - `auto` (follow OS setting) | `reduce` | `full`
 * @attr interactive - eyes follow the pointer; tap/click for a happy bounce
 * @attr announce - announce state changes to screen readers (polite live region)
 * @attr label - accessible label override (otherwise derived from state)
 * @attr seed - integer seed for blink/glance/confetti randomness
 *
 * @fires ane-statechange - `detail: { state, previous }`
 * @cssprop --ane-size, --ane-buddy-color, --ane-buddy-accent, --ane-success, --ane-warning, --ane-danger
 */
export class ThinkingBuddyElement extends EffectElement {
  static readonly states = BUDDY_STATES;

  static override get observedAttributes(): string[] {
    return [...super.observedAttributes, 'state', 'color', 'accent', 'label', 'interactive', 'announce', 'seed'];
  }

  #id = `ane-tb-${++instanceCount}`;
  #state: BuddyState = 'idle';
  #stateTime = 1e6;
  #pose: Pose = { ...POSES.idle };
  #look = { x: 0, y: 0 };
  #badges: Record<(typeof BADGES)[number], number> = { thinking: 0, waiting: 0, success: 0, error: 0 };
  #random = createRandom(7);
  #nextBlink = 1600;
  #blinkAt = Number.NEGATIVE_INFINITY;
  #nextGlance = 2600;
  #glanceUntil = 0;
  #glance = { x: 0, y: 0 };
  #dialAngle = 0;
  #boopAt = Number.NEGATIVE_INFINITY;
  #pointer: { x: number; y: number } | null = null;
  #particles: Particle[] = [];
  #labels: Partial<Record<BuddyState, string>> = {};
  #listening = false;
  #toneFrom: Tone = 'accent';
  #toneTo: Tone = 'accent';
  #toneMix = 1;
  #el: {
    svg: SVGSVGElement;
    live: HTMLElement;
    char: SVGGElement;
    head: SVGGElement;
    antenna: SVGGElement;
    shadow: SVGEllipseElement;
    armL: SVGGElement;
    armR: SVGGElement;
    dialTicks: SVGLineElement[];
    eyes: SVGGElement[];
    pills: SVGRectElement[];
    happy: SVGPathElement[];
    squint: SVGPathElement[];
    cheeks: SVGEllipseElement[];
    mouth: SVGPathElement;
    bulbLamps: SVGGElement;
    bulbGlows: Record<Tone, SVGCircleElement>;
    coreGlows: Record<Tone, SVGCircleElement>;
    lamps: Record<Tone, SVGCircleElement[]>;
    eyeGlow: SVGEllipseElement;
    sparks: SVGLineElement[];
    sweat: SVGPathElement;
    badges: Record<(typeof BADGES)[number], SVGGElement>;
    dots: SVGCircleElement[];
    hourglass: SVGGElement;
    sandTop: SVGPathElement;
    sandBottom: SVGPathElement;
    stream: SVGLineElement;
    check: SVGPathElement;
    failGlyph: SVGGElement;
  } | null = null;

  /** Current state. Setting it reflects to the `state` attribute. */
  get state(): BuddyState {
    return this.#state;
  }
  set state(value: BuddyState) {
    this.setAttribute('state', value);
  }

  /** Per-state accessible labels, e.g. for localisation. Merged over the English defaults. */
  get labels(): Readonly<Record<BuddyState, string>> {
    return { ...DEFAULT_BUDDY_LABELS, ...this.#labels };
  }
  set labels(value: Partial<Record<BuddyState, string>>) {
    this.#labels = { ...value };
    this.#syncLabel();
  }

  /** Replays the entry animation of the current state (jump + confetti, shake, ...). */
  replay(): void {
    this.#stateTime = 0;
    if (this.#state === 'success') this.#burst();
  }

  /** A playful squash-and-stretch bounce; also triggered by tapping when `interactive`. */
  boop(): void {
    this.#boopAt = this.elapsed;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.#syncListeners();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#syncListeners();
  }

  protected build(root: ShadowRoot): void {
    root.innerHTML = template(this.#id);
    const q = <T extends Element>(selector: string): T => root.querySelector(selector) as T;
    const qa = <T extends Element>(selector: string): T[] => Array.from(root.querySelectorAll(selector)) as T[];
    this.#el = {
      svg: q('svg'),
      live: q('.sr'),
      char: q('.char'),
      head: q('.head'),
      antenna: q('.antenna'),
      shadow: q('.shadow'),
      armL: q('.arm-l'),
      armR: q('.arm-r'),
      dialTicks: qa('.dial-tick'),
      eyes: qa('.eye'),
      pills: qa('.pill'),
      happy: qa('.happy'),
      squint: qa('.squint'),
      cheeks: qa('.cheek'),
      mouth: q('.mouth'),
      bulbLamps: q('.bulb-lamps'),
      bulbGlows: byTone(qa('.bulb-glows > circle')),
      coreGlows: byTone(qa('.core-glows > circle')),
      lamps: {
        accent: qa('.lamp.tone-accent'),
        warning: qa('.lamp.tone-warning'),
        success: qa('.lamp.tone-success'),
        danger: qa('.lamp.tone-danger'),
      },
      eyeGlow: q('.eye-glow'),
      sparks: qa('.spark'),
      sweat: q('.sweat'),
      badges: {
        thinking: q('[data-badge="thinking"]'),
        waiting: q('[data-badge="waiting"]'),
        success: q('[data-badge="success"]'),
        error: q('[data-badge="error"]'),
      },
      dots: qa('.dot'),
      hourglass: q('.hourglass'),
      sandTop: q('.hg-top'),
      sandBottom: q('.hg-bottom'),
      stream: q('.hg-stream'),
      check: q('.ok-check'),
      failGlyph: q('.fail-glyph'),
    };
    this.#particles = qa<SVGRectElement>('.confetti').map((el) => ({ el, x: 0, y: 0, vx: 0, vy: 0, rot: 0, spin: 0, life: CONFETTI_LIFE }));

    this.#random = createRandom(parseNumber(this.getAttribute('seed'), 7));
    const initial = this.getAttribute('state');
    this.#state = isBuddyState(initial) ? initial : 'idle';
    this.#pose = { ...POSES[this.#state] };
    for (const badge of BADGES) this.#badges[badge] = badge === this.#state ? 1 : 0;
    this.#toneFrom = this.#toneTo = STATE_TONE[this.#state];
    this.#raiseTone(this.#toneTo);
    this.#el.svg.setAttribute('data-state', this.#state);
    this.#syncColor('color', this.getAttribute('color'));
    this.#syncColor('accent', this.getAttribute('accent'));
    this.#syncLabel();
    this.tick(0);
  }

  protected override attributeChanged(name: string, _old: string | null, value: string | null): void {
    switch (name) {
      case 'state':
        this.#setState(isBuddyState(value) ? value : 'idle');
        break;
      case 'color':
      case 'accent':
        this.#syncColor(name, value);
        break;
      case 'label':
        this.#syncLabel();
        break;
      case 'interactive':
        this.#syncListeners();
        break;
      case 'seed':
        this.#random = createRandom(parseNumber(value, 7));
        break;
    }
  }

  protected override motionChanged(): void {
    this.tick(0);
  }

  #setState(next: BuddyState): void {
    if (next === this.#state || !this.#el) return;
    const previous = this.#state;
    this.#state = next;
    this.#stateTime = 0;
    this.#el.svg.setAttribute('data-state', next);
    const tone = STATE_TONE[next];
    if (tone !== this.#toneTo) {
      this.#toneFrom = this.#toneMix >= 0.5 ? this.#toneTo : this.#toneFrom;
      this.#toneTo = tone;
      this.#toneMix = this.#toneFrom === tone ? 1 : 0;
      this.#raiseTone(tone);
    }
    this.#syncLabel();
    if (next === 'success') this.#burst();
    if (this.hasAttribute('announce')) this.#el.live.textContent = this.#labelFor(next);
    this.dispatchEvent(
      new CustomEvent<BuddyStateChangeDetail>('ane-statechange', {
        detail: { state: next, previous },
        bubbles: true,
        composed: true,
      }),
    );
  }

  /** Moves a tone's lamps to the top of their stack so they fade in over the previous tone. */
  #raiseTone(tone: Tone): void {
    for (const lamp of this.#el?.lamps[tone] ?? []) lamp.parentNode?.appendChild(lamp);
  }

  #labelFor(state: BuddyState): string {
    return this.getAttribute('label') || this.#labels[state] || DEFAULT_BUDDY_LABELS[state];
  }

  #syncLabel(): void {
    this.#el?.svg.setAttribute('aria-label', this.#labelFor(this.#state));
  }

  #syncColor(name: 'color' | 'accent', value: string | null): void {
    const prop = name === 'color' ? '--ane-buddy-color' : '--ane-buddy-accent';
    if (!this.#el) return;
    if (value) this.#el.svg.style.setProperty(prop, value);
    else this.#el.svg.style.removeProperty(prop);
  }

  #syncListeners(): void {
    const want = this.isConnected && this.hasAttribute('interactive');
    if (want === this.#listening) return;
    this.#listening = want;
    if (want) {
      window.addEventListener('pointermove', this.#onPointerMove, { passive: true });
      document.documentElement.addEventListener('pointerleave', this.#onPointerLeave);
      this.addEventListener('pointerdown', this.#onPointerDown);
    } else {
      window.removeEventListener('pointermove', this.#onPointerMove);
      document.documentElement.removeEventListener('pointerleave', this.#onPointerLeave);
      this.removeEventListener('pointerdown', this.#onPointerDown);
      this.#pointer = null;
    }
  }

  #onPointerMove = (event: PointerEvent): void => {
    const rect = this.getBoundingClientRect();
    if (!rect.width) return;
    const x = (event.clientX - (rect.left + rect.width / 2)) / (rect.width * 0.9);
    const y = (event.clientY - (rect.top + rect.height * 0.4)) / (rect.height * 0.9);
    this.#pointer = { x: clamp(x, -1, 1), y: clamp(y, -1, 1) };
  };

  #onPointerLeave = (): void => {
    this.#pointer = null;
  };

  #onPointerDown = (): void => {
    this.boop();
  };

  /** Launches the success confetti from the top of the head. */
  #burst(): void {
    if (this.reducedMotion) return;
    const rand = this.#random;
    for (const p of this.#particles) {
      const angle = ((-165 + rand() * 150) * Math.PI) / 180;
      const speed = 140 + rand() * 130;
      p.x = 100 + (rand() - 0.5) * 24;
      p.y = 58;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.rot = rand() * 360;
      p.spin = (rand() - 0.5) * 720;
      p.life = 0;
    }
  }

  protected tick(dt: number): void {
    const el = this.#el;
    if (!el) return;
    const reduced = this.reducedMotion;
    const motion = reduced ? 0 : 1;
    const state = this.#state;
    const t = this.elapsed;
    const seconds = t / 1000;
    const rand = this.#random;
    this.#stateTime += dt;
    const T = this.#stateTime;

    // 1. Ease every pose channel toward the active state's target pose.
    const target = POSES[state];
    const pose = this.#pose;
    for (const key of POSE_KEYS) pose[key] = reduced ? target[key] : damp(pose[key], target[key], 7, dt);

    // 2. Gaze: idle glances, waiting checks the hourglass, thinking drifts, pointer wins.
    let lookX = target.lookX;
    let lookY = target.lookY;
    if (state === 'idle') {
      if (t >= this.#nextGlance) {
        this.#glance = { x: (rand() * 2 - 1) * 4, y: (rand() * 2 - 1) * 3 };
        this.#glanceUntil = t + 900;
        this.#nextGlance = t + 3200 + rand() * 3000;
      }
      if (t < this.#glanceUntil) ({ x: lookX, y: lookY } = this.#glance);
    } else if (state === 'waiting') {
      const phase = T % 2600;
      if (phase > 1400 && phase < 2200) {
        lookX = 4.5;
        lookY = -4;
      }
    } else if (state === 'thinking') {
      lookX += Math.sin(seconds * 1.7) * 1.4 * motion;
      lookY += Math.cos(seconds * 1.1) * 0.8 * motion;
    }
    if (this.#pointer && (state === 'idle' || state === 'waiting' || state === 'success')) {
      lookX = this.#pointer.x * 5;
      lookY = this.#pointer.y * 4;
    }
    this.#look.x = damp(this.#look.x, lookX, 12, dt);
    this.#look.y = damp(this.#look.y, lookY, 12, dt);

    // 3. Blinking (occasional double blink).
    if (t >= this.#nextBlink) {
      this.#blinkAt = t;
      this.#nextBlink = t + (rand() < 0.18 ? 260 : 2400 + rand() * 2600);
    }
    const sinceBlink = t - this.#blinkAt;
    let blink = 1;
    if (sinceBlink < 70) blink = 1 - (sinceBlink / 70) * 0.9;
    else if (sinceBlink < 160) blink = 0.1 + ((sinceBlink - 70) / 90) * 0.9;

    // 4. Body: hover, sway and the one-shot entry reactions.
    let dx = 0;
    let dy = -Math.sin(seconds * Math.PI * 2 * pose.bobRate) * pose.bob * motion;
    let sx = 1;
    let sy = 1;
    let headTilt = pose.lean + Math.sin(seconds * Math.PI * pose.bobRate + 0.6) * pose.sway * motion;
    if (motion && state === 'success') {
      if (T < 90) {
        sy -= 0.08 * (T / 90);
        sx += 0.06 * (T / 90);
      } else if (T < 610) {
        const k = (T - 90) / 520;
        dy -= 28 * hump(k);
        sy += 0.05 * hump(k);
        sx -= 0.03 * hump(k);
      } else if (T < 800) {
        const k = (T - 610) / 190;
        sy -= 0.1 * hump(k);
        sx += 0.08 * hump(k);
      }
    }
    if (motion && state === 'error' && T < 1200) {
      const decay = Math.exp(-T / 320);
      dx += Math.sin(T * 0.06) * 7 * decay;
      headTilt += Math.sin(T * 0.06 + 1) * 6 * decay;
    }
    const sinceBoop = t - this.#boopAt;
    let joy = 0;
    if (sinceBoop >= 0 && sinceBoop < 520) {
      const k = sinceBoop / 520;
      joy = 1 - k;
      if (motion) {
        const squash = hump(Math.min(1, k * 2));
        sy -= 0.12 * squash;
        sx += 0.09 * squash;
        dy -= 8 * hump(k);
      }
    }
    el.char.setAttribute(
      'transform',
      `translate(${r2(dx)} ${r2(dy)}) translate(100 154) scale(${r2(sx * 1000) / 1000} ${r2(sy * 1000) / 1000}) translate(-100 -154)`,
    );
    el.head.setAttribute('transform', `rotate(${r2(headTilt)} 100 118)`);

    const lift = Math.max(0, -dy);
    el.shadow.setAttribute('rx', String(r2(34 - lift * 0.35)));
    el.shadow.setAttribute('opacity', String(r2(clamp(0.3 - lift * 0.006, 0.08, 0.3))));

    // 5. Limbs, antenna and ear dials.
    let armL = pose.armL;
    let armR = pose.armR;
    if (motion) {
      if (state === 'success') {
        armL += Math.sin(seconds * 12) * 10;
        armR += Math.sin(seconds * 12 + Math.PI) * 10;
      } else if (state === 'thinking') {
        armR += Math.sin(seconds * 5) * 5;
      } else if (state === 'waiting') {
        armL += Math.max(0, Math.sin(seconds * 6)) * 9;
      }
    }
    el.armL.setAttribute('transform', `translate(73 124) rotate(${r2(armL)})`);
    el.armR.setAttribute('transform', `translate(127 124) rotate(${r2(-armR)})`);

    const antennaSway = pose.droop + (Math.sin(seconds * 2.1) * 3 - dx * 0.8) * motion;
    el.antenna.setAttribute('transform', `rotate(${r2(antennaSway)} 100 40)`);

    this.#dialAngle = (this.#dialAngle + (pose.dial * dt * motion) / 1000) % 360;
    for (const tick of el.dialTicks) tick.setAttribute('transform', `rotate(${r2(this.#dialAngle)})`);

    let glow = reduced ? 0.8 : 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(seconds * Math.PI * 2 * pose.pulse));
    if (motion && state === 'error' && T < 900) glow = Math.sin(T * 0.045) > -0.3 ? 1 : 0.3;
    this.#toneMix = reduced ? 1 : Math.min(1, this.#toneMix + dt / TONE_FADE);
    for (const tone of TONES) {
      const incoming = tone === this.#toneTo;
      const outgoing = !incoming && tone === this.#toneFrom;
      const weight = incoming ? this.#toneMix : outgoing ? 1 - this.#toneMix : 0;
      // The outgoing lamp stays opaque underneath while the incoming one fades in on top.
      const lampOpacity = incoming ? this.#toneMix : outgoing ? 1 : 0;
      for (const node of el.lamps[tone]) node.setAttribute('opacity', String(r2(lampOpacity)));
      el.bulbGlows[tone].setAttribute('opacity', String(r2(weight * glow)));
      el.coreGlows[tone].setAttribute('opacity', String(r2(weight * (0.4 + glow * 0.5))));
    }
    el.bulbLamps.setAttribute('opacity', String(r2(0.75 + glow * 0.25)));

    // 6. Face: eyes, mouth, cheeks.
    const happy = Math.max(pose.happy, joy);
    const squint = pose.squint * (1 - joy);
    const pillOpacity = (1 - happy) * (1 - squint);
    const eyeScale = Math.max(0.08, pose.eyeH * blink);
    const eyeXs = [86, 114];
    el.eyes.forEach((eye, i) => {
      eye.setAttribute('transform', `translate(${r2((eyeXs[i] ?? 100) + this.#look.x)} ${r2(78 + this.#look.y)})`);
    });
    for (const pill of el.pills) {
      pill.setAttribute('transform', `scale(1 ${r2(eyeScale)})`);
      pill.setAttribute('opacity', String(r2(pillOpacity)));
    }
    for (const path of el.happy) path.setAttribute('opacity', String(r2(happy)));
    for (const path of el.squint) path.setAttribute('opacity', String(r2(squint)));
    el.eyeGlow.setAttribute('opacity', String(r2(0.5 + 0.5 * eyeScale * pillOpacity)));
    for (const cheek of el.cheeks) cheek.setAttribute('opacity', String(r2(Math.max(pose.blush, joy) * 0.6)));

    const mouthWidth = 6.5 * pose.mouthW;
    const curve = Math.max(pose.smile, joy) * 7;
    el.mouth.setAttribute('d', `M${r2(-mouthWidth)} 0 Q0 ${r2(curve)} ${r2(mouthWidth)} 0`);
    el.mouth.setAttribute('transform', `translate(${r2(100 + pose.mouthX + this.#look.x * 0.4)} ${r2(95 + this.#look.y * 0.3)})`);

    // 7. Error extras: antenna sparks and a sweat drop.
    el.sparks.forEach((spark, i) => {
      const on = motion && state === 'error' && T < 1000 && Math.sin(T * 0.09 + i * 1.7) > 0;
      spark.setAttribute('opacity', on ? String(r2(1 - T / 1000)) : '0');
    });
    if (state === 'error' && T > 250) {
      const cycle = reduced ? 0.3 : (T % 2000) / 2000;
      el.sweat.setAttribute('transform', `translate(62 ${r2(52 + cycle * 9)})`);
      el.sweat.setAttribute('opacity', String(r2(reduced ? 0.9 : (1 - cycle) * 0.95)));
    } else {
      el.sweat.setAttribute('opacity', '0');
    }

    // 8. State badge (thought cloud, hourglass, check, alert).
    for (const badge of BADGES) {
      const goal = badge === state ? 1 : 0;
      const value = reduced ? goal : damp(this.#badges[badge], goal, 12, dt);
      this.#badges[badge] = value;
      const node = el.badges[badge];
      if (value < 0.01) {
        node.setAttribute('visibility', 'hidden');
        continue;
      }
      node.setAttribute('visibility', 'visible');
      const scale = BADGE_SCALE[badge] * (reduced ? 1 : Math.max(0, easeOutBack(clamp(value, 0, 1))));
      const floatY = badge === 'thinking' ? Math.sin(seconds * 2) * 1.5 * motion : 0;
      node.setAttribute('transform', `translate(${BADGE_X} ${r2(BADGE_Y + floatY)}) scale(${r2(scale)})`);
      node.setAttribute('opacity', String(r2(clamp(value * 1.4, 0, 1))));
    }
    if (state === 'thinking' || this.#badges.thinking > 0.01) {
      el.dots.forEach((dot, i) => {
        const wave = reduced ? 0.6 : Math.max(0, Math.sin(seconds * Math.PI * 2 * 1.1 - i * 0.9));
        dot.setAttribute('opacity', String(r2(0.35 + 0.65 * wave)));
        const cx = DOT_X[i] ?? 0;
        dot.setAttribute('transform', `translate(${cx} -1) scale(${r2(0.7 + 0.45 * wave)}) translate(${-cx} 1)`);
      });
    }
    if (state === 'waiting' || this.#badges.waiting > 0.01) this.#drawHourglass(reduced ? 0.5 : (T % 2200) / 2200, reduced);
    if (state === 'success' || this.#badges.success > 0.01) {
      const draw = reduced ? 1 : clamp((T - 120) / 280, 0, 1);
      el.check.setAttribute('stroke-dashoffset', String(r2(22 * (1 - draw))));
    }
    if (state === 'error' || this.#badges.error > 0.01) {
      const wiggle = motion ? Math.sin(T * 0.05) * 12 * Math.exp(-T / 500) : 0;
      el.failGlyph.setAttribute('transform', `rotate(${r2(wiggle)})`);
    }

    // 9. Confetti physics.
    for (const p of this.#particles) {
      if (p.life >= CONFETTI_LIFE) continue;
      p.life += dt;
      if (p.life >= CONFETTI_LIFE || reduced) {
        p.life = CONFETTI_LIFE;
        p.el.setAttribute('visibility', 'hidden');
        continue;
      }
      const step = dt / 1000;
      p.vy += 520 * step;
      p.vx *= 1 - 0.6 * step;
      p.x += p.vx * step;
      p.y += p.vy * step;
      p.rot += p.spin * step;
      p.el.setAttribute('visibility', 'visible');
      p.el.setAttribute('transform', `translate(${r2(p.x)} ${r2(p.y)}) rotate(${r2(p.rot)})`);
      p.el.setAttribute('opacity', String(r2(1 - clamp((p.life - 1000) / 500, 0, 1))));
    }
  }

  /** Hourglass: sand drains for 77% of the cycle, then the glass flips. */
  #drawHourglass(phase: number, reduced: boolean): void {
    const el = this.#el;
    if (!el) return;
    const drain = 0.77;
    const remaining = phase < drain ? 1 - phase / drain : 0;
    const flip = phase < drain ? 0 : easeInOutSine((phase - drain) / (1 - drain));
    const k = Math.sqrt(remaining);
    el.sandTop.setAttribute('d', `M${r2(-6 * k)} ${r2(-9 * k)} L${r2(6 * k)} ${r2(-9 * k)} L0 0 Z`);
    el.sandBottom.setAttribute('d', `M-6 9 L6 9 L${r2(6 * k)} ${r2(9 * k)} L${r2(-6 * k)} ${r2(9 * k)} Z`);
    el.stream.setAttribute('opacity', remaining > 0.02 && !reduced ? '1' : '0');
    el.stream.setAttribute('y2', String(r2(9 * k + 0.5)));
    el.hourglass.setAttribute('transform', `rotate(${r2(flip * 180)})`);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ane-thinking-buddy': ThinkingBuddyElement;
  }
  interface HTMLElementEventMap {
    'ane-statechange': CustomEvent<BuddyStateChangeDetail>;
  }
}

/** Registers `<ane-thinking-buddy>` (or a custom tag name). Safe to call more than once. */
export function defineThinkingBuddy(tag = 'ane-thinking-buddy'): void {
  defineElement(tag, ThinkingBuddyElement);
}
