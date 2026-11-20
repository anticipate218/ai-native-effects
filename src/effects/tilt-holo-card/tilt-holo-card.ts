import { defineElement, EffectElement } from '../../core/effect-element';
import { clamp, createRandom, damp, parseNumber, springStep } from '../../core/math';

export type FoilPattern = 'lines' | 'sparkle' | 'scales' | 'none';
const PATTERNS: readonly FoilPattern[] = ['lines', 'sparkle', 'scales', 'none'];

/** Pixel size of one foil tile. */
const TILE = 160;

/**
 * Draws one tile of a foil pattern as white-on-transparent alpha, ready to be used as a CSS mask.
 * Deterministic for a given seed, so recordings are reproducible.
 */
export function drawFoil(ctx: CanvasRenderingContext2D, pattern: FoilPattern, seed: number, size = TILE): void {
  ctx.clearRect(0, 0, size, size);
  const random = createRandom(seed);
  if (pattern === 'lines') {
    // Fine diagonal grooves with uneven brightness, like brushed holographic film.
    ctx.lineWidth = 1.4;
    for (let i = -size; i < size * 2; i += 4) {
      ctx.strokeStyle = `rgba(255,255,255,${(0.35 + random() * 0.65).toFixed(3)})`;
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + size, size); // 45° and exactly one tile across, so the tile repeats seamlessly
      ctx.stroke();
    }
  } else if (pattern === 'sparkle') {
    // Glitter: many soft dots plus a few four-point glints, wrapped at the tile edges.
    const dot = (x: number, y: number, r: number, a: number): void => {
      for (const ox of [-size, 0, size]) {
        for (const oy of [-size, 0, size]) {
          const g = ctx.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
          g.addColorStop(0, `rgba(255,255,255,${a.toFixed(3)})`);
          g.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = g;
          ctx.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
        }
      }
    };
    for (let i = 0; i < 150; i++) dot(random() * size, random() * size, 1 + random() * 2.6, 0.4 + random() * 0.6);
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 9; i++) {
      const x = random() * size;
      const y = random() * size;
      const r = 4 + random() * 6;
      ctx.beginPath();
      ctx.moveTo(x, y - r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.quadraticCurveTo(x, y, x, y + r);
      ctx.quadraticCurveTo(x, y, x - r, y);
      ctx.quadraticCurveTo(x, y, x, y - r);
      ctx.fill();
    }
  } else if (pattern === 'scales') {
    // Overlapping fish scales: each arc is bright at its rim and fades towards its centre.
    const r = size / 8;
    for (let row = -1; row <= 8; row++) {
      for (let col = -1; col <= 8; col++) {
        const x = col * r * 2 + (row % 2 ? r : 0);
        const y = row * r;
        const g = ctx.createRadialGradient(x, y, r * 0.2, x, y, r);
        g.addColorStop(0, 'rgba(255,255,255,0.05)');
        g.addColorStop(0.82, `rgba(255,255,255,${(0.45 + random() * 0.4).toFixed(3)})`);
        g.addColorStop(1, 'rgba(255,255,255,0.95)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI);
        ctx.fill();
      }
    }
  }
}

const foilCache = new Map<string, string>();

/** Data URL of a foil tile (cached), or '' when canvas is unavailable or the pattern is `none`. */
function foilUrl(pattern: FoilPattern, seed: number): string {
  if (pattern === 'none') return '';
  const key = `${pattern}:${seed}`;
  const hit = foilCache.get(key);
  if (hit !== undefined) return hit;
  let url = '';
  try {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = TILE;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      drawFoil(ctx, pattern, seed);
      url = canvas.toDataURL('image/png');
    }
  } catch {
    url = '';
  }
  foilCache.set(key, url);
  return url;
}

/**
 * Tilt for a pointer at normalised position (`nx`, `ny`) in -1..1 (right / down positive):
 * the side under the pointer dips away. Returns [rotateX, rotateY] in degrees.
 */
export function tiltFor(nx: number, ny: number, max: number): [number, number] {
  return [-clamp(ny, -1, 1) * max, clamp(nx, -1, 1) * max];
}

const STYLE = /* css */ `
:host {
  --_radius: var(--ane-holo-radius, 18px);
  --_bg: var(--ane-holo-bg, #15121f);
  --rx: 0;
  --ry: 0;
  --px: 50;
  --py: 50;
  --hue: 0;
  --lit: 0;
  display: inline-block;
  position: relative;
  width: var(--ane-size, 300px);
  max-width: 100%;
  vertical-align: middle;
  touch-action: pan-y;
  -webkit-tap-highlight-color: transparent;
}
:host([hidden]) { display: none; }
.stage { position: relative; perspective: var(--_persp, 800px); }
.shadow {
  position: absolute;
  inset: 10% 9% -2%;
  border-radius: var(--_radius);
  background: rgba(4, 2, 16, 0.6);
  filter: blur(22px);
  transform: translate(calc(var(--ry) * -1.1px), calc(var(--rx) * 1.1px + 16px)) scale(calc(0.96 + var(--lit) * 0.03));
  opacity: calc(0.75 + var(--lit) * 0.2);
  pointer-events: none;
}
.card {
  --_rainbow: repeating-linear-gradient(
      calc(110deg + var(--ry) * 2deg),
      hsl(calc(var(--hue) * 1deg) 95% 66%) 0%,
      hsl(calc(var(--hue) * 1deg + 60deg) 95% 64%) 7%,
      hsl(calc(var(--hue) * 1deg + 130deg) 95% 62%) 14%,
      hsl(calc(var(--hue) * 1deg + 200deg) 95% 66%) 21%,
      hsl(calc(var(--hue) * 1deg + 270deg) 95% 68%) 28%,
      hsl(calc(var(--hue) * 1deg + 360deg) 95% 66%) 35%
    );
  position: relative;
  border-radius: var(--_radius);
  overflow: hidden;
  isolation: isolate;
  aspect-ratio: var(--_ratio, auto);
  background: var(--_bg);
  transform: rotateX(calc(var(--rx) * 1deg)) rotateY(calc(var(--ry) * 1deg)) scale(calc(1 + var(--lit) * 0.025));
  will-change: transform;
}
::slotted(*) { display: block; }
.foil, .sheen, .glare, .rim { position: absolute; inset: 0; border-radius: inherit; pointer-events: none; }
.foil, .sheen {
  background-image: var(--_rainbow);
  background-size: 260% 260%;
  background-position: calc(var(--px) * 1%) calc(var(--py) * 1%);
}
.foil {
  mix-blend-mode: var(--_blend, color-dodge);
  opacity: calc(var(--_foil, 0.85) * (0.45 + var(--lit) * 0.55));
  -webkit-mask-image: var(--_pattern, linear-gradient(#000, #000)), radial-gradient(farthest-corner circle at calc(var(--px) * 1%) calc(var(--py) * 1%), #000 8%, rgba(0, 0, 0, 0.45) 45%, rgba(0, 0, 0, 0.12) 100%);
  mask-image: var(--_pattern, linear-gradient(#000, #000)), radial-gradient(farthest-corner circle at calc(var(--px) * 1%) calc(var(--py) * 1%), #000 8%, rgba(0, 0, 0, 0.45) 45%, rgba(0, 0, 0, 0.12) 100%);
  -webkit-mask-size: var(--_tile, 160px) var(--_tile, 160px), 100% 100%;
  mask-size: var(--_tile, 160px) var(--_tile, 160px), 100% 100%;
  -webkit-mask-repeat: repeat, no-repeat;
  mask-repeat: repeat, no-repeat;
  -webkit-mask-composite: source-in;
  mask-composite: intersect;
  filter: saturate(1.15) contrast(1.1);
}
/* A broad iridescent band under the light, independent of the foil pattern. */
.sheen {
  mix-blend-mode: overlay;
  opacity: calc(var(--_sheen, 0.55) * (0.3 + var(--lit) * 0.7));
  -webkit-mask-image: radial-gradient(farthest-corner circle at calc(var(--px) * 1%) calc(var(--py) * 1%), #000 0%, rgba(0, 0, 0, 0.5) 40%, transparent 85%);
  mask-image: radial-gradient(farthest-corner circle at calc(var(--px) * 1%) calc(var(--py) * 1%), #000 0%, rgba(0, 0, 0, 0.5) 40%, transparent 85%);
}
.glare {
  background: radial-gradient(farthest-corner circle at calc(var(--px) * 1%) calc(var(--py) * 1%), rgba(255, 255, 255, 0.85) 0%, rgba(255, 255, 255, 0.28) 22%, rgba(255, 255, 255, 0) 48%, rgba(0, 0, 0, 0.35) 100%);
  mix-blend-mode: overlay;
  opacity: calc(var(--_glare, 0.8) * (0.2 + var(--lit) * 0.8));
}
.rim {
  padding: 1.25px;
  background: conic-gradient(from calc(var(--hue) * 1deg + var(--ry) * 4deg), #ff8fd8, #ffe28a, #8affc1, #7cc4ff, #c49bff, #ff8fd8);
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask: linear-gradient(#000 0 0) content-box exclude, linear-gradient(#000 0 0);
  opacity: calc(0.35 + var(--lit) * 0.45);
}
`;

/**
 * `<ane-tilt-holo-card>`: a card that tilts towards the pointer with a holographic foil,
 * a moving glare and an iridescent rim. Put any content inside.
 *
 * @attr tilt - maximum tilt in degrees, `0`-`35`, default `16`
 * @attr foil - `lines` | `sparkle` (default) | `scales` | `none`
 * @attr foil-strength - `0`-`1`, default `0.85`
 * @attr glare - `0`-`1`, default `0.8`
 * @attr sheen - broad iridescent band, `0`-`1`, default `0.55`
 * @attr blend - foil blend mode: `color-dodge` (default) | `screen` | `overlay` | `soft-light` | `hard-light`
 * @attr hue - base hue offset in degrees, default `0`
 * @attr radius - corner radius (CSS length), default `18px`
 * @attr ratio - aspect ratio of the card, e.g. `5/7`; default: from content
 * @attr perspective - CSS length, default `800px`
 * @attr idle - `on` (default: a slow sway when nobody is touching it) | `off`
 * @attr gyro - tilt with device orientation on phones (opt-in)
 * @attr seed - foil pattern seed
 * @attr size - card width (CSS length), default `300px`
 * @attr speed, motion
 */
export class TiltHoloCardElement extends EffectElement {
  static override get observedAttributes(): string[] {
    return [...super.observedAttributes, 'tilt', 'foil', 'foil-strength', 'glare', 'sheen', 'blend', 'hue', 'radius', 'ratio', 'perspective', 'idle', 'gyro', 'seed'];
  }

  #s = { rx: 0, vrx: 0, ry: 0, vry: 0, px: 50, vpx: 0, py: 50, vpy: 0, lit: 0 };
  #pointer: { nx: number; ny: number } | null = null;
  #gyro: { nx: number; ny: number } | null = null;
  #focused = false;
  #resting = false;
  #last = '';

  protected build(root: ShadowRoot): void {
    root.innerHTML = `<style>${STYLE}</style><div class="stage" part="stage"><div class="shadow" part="shadow"></div><div class="card" part="card"><slot></slot><div class="sheen" part="sheen"></div><div class="foil" part="foil"></div><div class="glare" part="glare"></div><div class="rim"></div></div></div>`;
    this.addEventListener('pointerenter', this.#onPointer);
    this.addEventListener('pointermove', this.#onPointer);
    this.addEventListener('pointerdown', this.#onPointer);
    this.addEventListener('pointerleave', this.#onLeave);
    this.addEventListener('pointercancel', this.#onLeave);
    this.addEventListener('pointerup', (e) => {
      if (e.pointerType !== 'mouse') this.#onLeave();
      this.#askGyroPermission();
    });
    this.addEventListener('focusin', () => {
      this.#focused = true;
      this.#wake();
    });
    this.addEventListener('focusout', () => {
      this.#focused = false;
      this.#wake();
    });
    this.#sync();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.#syncGyro();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener('deviceorientation', this.#onOrientation);
  }

  protected override attributeChanged(name: string): void {
    this.#sync();
    if (name === 'gyro') this.#syncGyro();
    this.#wake();
  }

  protected override motionChanged(): void {
    this.#wake();
  }

  /** Current tilt in degrees, `[rotateX, rotateY]` (read-only; useful for tests and syncing UI). */
  get tiltAngles(): [number, number] {
    return [this.#s.rx, this.#s.ry];
  }

  #sync(): void {
    const set = (prop: string, value: string | null): void => {
      if (value == null || value === '') this.style.removeProperty(prop);
      else this.style.setProperty(prop, value);
    };
    const pattern = (PATTERNS as readonly string[]).includes(this.getAttribute('foil') ?? '') ? (this.getAttribute('foil') as FoilPattern) : 'sparkle';
    const url = foilUrl(pattern, Math.round(parseNumber(this.getAttribute('seed'), 7)));
    // `none` (or no canvas): the foil covers the whole card, still shaped by the spotlight.
    set('--_pattern', url ? `url("${url}")` : null);
    set('--_foil', String(parseNumber(this.getAttribute('foil-strength'), 0.85, 0, 1)));
    set('--_sheen', String(parseNumber(this.getAttribute('sheen'), 0.55, 0, 1)));
    set('--_glare', String(parseNumber(this.getAttribute('glare'), 0.8, 0, 1)));
    const blend = this.getAttribute('blend');
    set('--_blend', blend && ['color-dodge', 'screen', 'overlay', 'soft-light', 'hard-light', 'plus-lighter'].includes(blend) ? blend : null);
    set('--ane-holo-radius', this.getAttribute('radius'));
    set('--_ratio', this.getAttribute('ratio'));
    set('--_persp', this.getAttribute('perspective'));
  }

  #syncGyro(): void {
    window.removeEventListener('deviceorientation', this.#onOrientation);
    this.#gyro = null;
    if (this.hasAttribute('gyro') && this.isConnected) window.addEventListener('deviceorientation', this.#onOrientation);
  }

  #askGyroPermission(): void {
    // iOS only grants orientation events after a user gesture.
    const DOE = (globalThis as { DeviceOrientationEvent?: { requestPermission?: () => Promise<string> } }).DeviceOrientationEvent;
    if (this.hasAttribute('gyro') && typeof DOE?.requestPermission === 'function') DOE.requestPermission().catch(() => {});
  }

  #onOrientation = (e: DeviceOrientationEvent): void => {
    if (e.gamma == null || e.beta == null) return;
    // Phone held at about 45°: that is "flat" for the card.
    this.#gyro = { nx: clamp(e.gamma / 30, -1, 1), ny: clamp((e.beta - 45) / 30, -1, 1) };
    this.#wake();
  };

  #onPointer = (e: PointerEvent): void => {
    if (e.pointerType !== 'mouse' && e.type === 'pointermove' && e.buttons === 0) return;
    const r = this.getBoundingClientRect();
    if (!r.width || !r.height) return;
    this.#pointer = { nx: ((e.clientX - r.left) / r.width) * 2 - 1, ny: ((e.clientY - r.top) / r.height) * 2 - 1 };
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
    // Idle sway never rests; everything else stops writing once settled.
    if (this.#resting && (reduced || !idle || this.#pointer || this.#gyro || this.#focused)) return;
    const max = parseNumber(this.getAttribute('tilt'), 16, 0, 35);
    const hueBase = parseNumber(this.getAttribute('hue'), 0, -720, 720);

    let source = this.#pointer ?? this.#gyro;
    if (!source && this.#focused) source = { nx: 0.45, ny: -0.35 };
    let lit = source ? 1 : 0.35;
    let nx: number;
    let ny: number;
    if (source) {
      nx = source.nx;
      ny = source.ny;
    } else if (idle && !reduced) {
      const t = this.elapsed / 1000;
      nx = Math.sin(t * 0.9) * 0.45;
      ny = Math.sin(t * 0.63 + 1.1) * 0.35;
    } else {
      nx = 0.2;
      ny = -0.3;
    }
    const s = this.#s;
    const [tx, ty] = tiltFor(nx, ny, max);
    const tpx = 50 + clamp(nx, -1, 1) * 50;
    const tpy = 50 + clamp(ny, -1, 1) * 50;
    let moving: boolean;
    if (reduced) {
      // No tilt; the sheen only brightens when hovered or focused.
      s.rx = s.ry = s.vrx = s.vry = s.vpx = s.vpy = 0;
      s.px = 62;
      s.py = 30;
      lit = source ? 0.7 : 0.3;
      s.lit = lit;
      moving = false;
    } else {
      [s.rx, s.vrx] = springStep(s.rx, s.vrx, tx, deltaMs, 170, 18);
      [s.ry, s.vry] = springStep(s.ry, s.vry, ty, deltaMs, 170, 18);
      [s.px, s.vpx] = springStep(s.px, s.vpx, tpx, deltaMs, 220, 26);
      [s.py, s.vpy] = springStep(s.py, s.vpy, tpy, deltaMs, 220, 26);
      s.lit = damp(s.lit, lit, 8, deltaMs);
      moving =
        Math.abs(s.rx - tx) + Math.abs(s.ry - ty) > 0.02 ||
        Math.abs(s.vrx) + Math.abs(s.vry) > 0.02 ||
        Math.abs(s.px - tpx) + Math.abs(s.py - tpy) > 0.05 ||
        Math.abs(s.lit - lit) > 0.003;
    }
    // Hue rolls with the tilt, like light catching a real foil.
    const hue = hueBase + (s.px - 50) * 1.6 + (s.py - 50) * 1.1;
    const css = `${s.rx.toFixed(2)}|${s.ry.toFixed(2)}|${s.px.toFixed(1)}|${s.py.toFixed(1)}|${hue.toFixed(1)}|${s.lit.toFixed(3)}`;
    if (css !== this.#last) {
      this.#last = css;
      const st = this.style;
      st.setProperty('--rx', s.rx.toFixed(2));
      st.setProperty('--ry', s.ry.toFixed(2));
      st.setProperty('--px', s.px.toFixed(1));
      st.setProperty('--py', s.py.toFixed(1));
      st.setProperty('--hue', hue.toFixed(1));
      st.setProperty('--lit', s.lit.toFixed(3));
    }
    if (!moving) this.#resting = true;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ane-tilt-holo-card': TiltHoloCardElement;
  }
}

/** Registers `<ane-tilt-holo-card>` (or a custom tag name). Safe to call more than once. */
export function defineTiltHoloCard(tag = 'ane-tilt-holo-card'): void {
  defineElement(tag, TiltHoloCardElement);
}
