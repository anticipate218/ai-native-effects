import { parseNumber } from './math';
import { resolveReducedMotion, watchReducedMotion } from './motion';
import { subscribe } from './ticker';

/**
 * `HTMLElement` is missing during server-side rendering (Next.js, Nuxt, Astro...).
 * Falling back to an empty class keeps `import 'ai-native-effects'` safe there;
 * nothing is defined until the code runs in a browser.
 */
const SafeHTMLElement: typeof HTMLElement =
  typeof HTMLElement === 'undefined' ? (class {} as unknown as typeof HTMLElement) : HTMLElement;

/**
 * Base class for every effect. It owns the boring parts so effects stay small:
 *
 * - an open shadow root, built once on first connection;
 * - the shared animation loop, paused while the element is off-screen or detached;
 * - `speed` (time scale), `motion` (auto | reduce | full) and `size` attributes;
 * - reduced-motion tracking, including live OS setting changes.
 */
export abstract class EffectElement extends SafeHTMLElement {
  static get observedAttributes(): string[] {
    return ['speed', 'motion', 'size'];
  }

  /** Effect-local clock in milliseconds, scaled by `speed`. */
  protected elapsed = 0;

  #root: ShadowRoot | null = null;
  #built = false;
  #speed = 1;
  #reducedMotion = false;
  #onScreen = true;
  #stopTicking: (() => void) | null = null;
  #stopWatchingMotion: (() => void) | null = null;
  #observer: IntersectionObserver | null = null;

  protected get root(): ShadowRoot {
    this.#root ??= this.attachShadow({ mode: 'open' });
    return this.#root;
  }

  /** Animation time scale. `0` freezes the effect, `1` is normal speed, max `5`. */
  get speed(): number {
    return this.#speed;
  }
  set speed(value: number) {
    this.setAttribute('speed', String(value));
  }

  /** `true` when the effect is rendering its reduced-motion variant. */
  get reducedMotion(): boolean {
    return this.#reducedMotion;
  }

  connectedCallback(): void {
    if (!this.#built) {
      this.build(this.root);
      this.#built = true;
    }
    this.#syncMotion();
    this.#stopWatchingMotion ??= watchReducedMotion(() => this.#syncMotion());
    if (!this.#observer && typeof IntersectionObserver === 'function') {
      this.#observer = new IntersectionObserver((entries) => {
        const latest = entries[entries.length - 1];
        if (!latest) return;
        this.#onScreen = latest.isIntersecting;
        this.#syncTicking();
      });
      this.#observer.observe(this);
    }
    this.#syncTicking();
  }

  disconnectedCallback(): void {
    this.#stopTicking?.();
    this.#stopTicking = null;
    this.#stopWatchingMotion?.();
    this.#stopWatchingMotion = null;
    this.#observer?.disconnect();
    this.#observer = null;
    this.#onScreen = true;
  }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
    if (name === 'speed') {
      this.#speed = parseNumber(newValue, 1, 0, 5);
    } else if (name === 'motion') {
      this.#syncMotion();
    } else if (name === 'size') {
      if (newValue) this.style.setProperty('--ane-size', newValue);
      else this.style.removeProperty('--ane-size');
    }
    if (this.#built && oldValue !== newValue) this.attributeChanged(name, oldValue, newValue);
  }

  /** Creates the shadow DOM. Called once, on first connection. */
  protected abstract build(root: ShadowRoot): void;

  /** Advances the animation. `deltaMs` is already scaled by `speed`. */
  protected abstract tick(deltaMs: number): void;

  /** Reacts to an observed attribute change after the DOM is built. */
  protected attributeChanged(_name: string, _oldValue: string | null, _newValue: string | null): void {}

  /** Called when the resolved reduced-motion mode changes. */
  protected motionChanged(_reduced: boolean): void {}

  #syncMotion(): void {
    const reduced = resolveReducedMotion(this.getAttribute('motion'));
    if (reduced === this.#reducedMotion) return;
    this.#reducedMotion = reduced;
    if (this.#built) this.motionChanged(reduced);
  }

  #syncTicking(): void {
    const shouldTick = this.isConnected && this.#onScreen;
    if (shouldTick && !this.#stopTicking) {
      this.#stopTicking = subscribe((_now, delta) => {
        const scaled = delta * this.#speed;
        this.elapsed += scaled;
        this.tick(scaled);
      });
    } else if (!shouldTick && this.#stopTicking) {
      this.#stopTicking();
      this.#stopTicking = null;
    }
  }
}

/** Registers a custom element once; a no-op during SSR or when the tag is taken. */
export function defineElement(tag: string, constructor: CustomElementConstructor): void {
  if (typeof customElements === 'undefined' || customElements.get(tag)) return;
  customElements.define(tag, constructor);
}
