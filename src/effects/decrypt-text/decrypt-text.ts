import { defineElement, EffectElement } from '../../core/effect-element';
import { parseNumber } from '../../core/math';

export const CHARSETS = {
  latin: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
  hex: '0123456789ABCDEF',
  binary: '01',
  digits: '0123456789',
  blocks: '▖▗▘▙▚▛▜▝▞▟░▒▓█',
  symbols: '!<>-_\\/[]{}=+*^?#%&@$',
  katakana: 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ',
} as const;
export type CharsetName = keyof typeof CHARSETS;

/** Used for CJK positions whatever the charset, so mixed-script text scrambles naturally. */
const CJK_POOL = '的一是不了人我在有他这中大来上国个到说们为子和你地出道也时年得就那要下以生会自着去之过家学对可她里后小么心多天而能好都然没日于起还发成事只作当想看文无开手十用主行方又如前所本见经头面公同三已老从动两长知民样现分将外但身些与高意进把法此实回二理美点月明其种声全工己话儿者向情部正名定女问力机给等几很业最间新什打便位因重被走电四第门相次东政海口使教西再平真听世气信北少关并内加化由却代军产入先山五太水万市眼体别处总才场师书比住员九笑性通目华报立马命张活难神数件安表原车白应路期叫死常提感金何更反合放做系计或司利受光王果亲界及今京务制解各任至清物台象记边共风战干接它许八特觉望直服毛林题建南度统色字请交爱让认算论百吃义科怎元社术结六功指思非流每青管夫连远资队跟带花快条院变联言权往展该领传近留红治决周保达办运武半候七必城父强步完革深区即求品士转量空甚众技轻程告江语英基派满式李息写呢识极令黄德收脸钱党倒未持取设始版双历越史商千片容研像找友孩站广改议形委早房音火际则首单据导影失拿网香似斯专石若兵弟谁校读志飞观争究包组造落视济喜离虽坐集编宝谈府拉黑且随格尽剑讲布杀微怕母调局根曾准团段终乐切级克精哪官示冷域读'
  .replace(/\s/g, '');

const isCjk = (ch: string): boolean => /[⺀-鿿豈-﫿぀-ヿ가-힯]/u.test(ch);
const isSpace = (ch: string): boolean => /^\s+$/u.test(ch);
const LOWER = 'abcdefghijklmnopqrstuvwxyz';
const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * Glyph pool for one position. CJK always scrambles through CJK; with the default `latin` set,
 * letters keep their case and digits stay digits, so scramble glyphs are about as wide as the
 * final ones.
 */
export function poolFor(ch: string, charset: string, custom: string): string {
  if (isCjk(ch)) return CJK_POOL;
  if (charset !== 'latin') return custom;
  if (/[a-z]/.test(ch)) return LOWER;
  if (/[A-Z]/.test(ch)) return UPPER;
  if (/[0-9]/.test(ch)) return CHARSETS.digits;
  return custom;
}

const segmenter = typeof Intl !== 'undefined' && 'Segmenter' in Intl ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
const graphemes = (text: string): string[] => (segmenter ? [...segmenter.segment(text)].map((s) => s.segment) : Array.from(text));

/**
 * Keeps the glyphs of `pool` whose advance width is within `tolerance` of `target`'s, so a
 * scrambling cell never shows a glyph much wider or narrower than its final character.
 * Falls back to the whole pool when too few glyphs match (or nothing can be measured).
 */
export function widthMatched(pool: string, target: string, measure: (ch: string) => number, tolerance = 0.25): string {
  const w = measure(target);
  if (!(w > 0)) return pool;
  const glyphs = Array.from(pool);
  const close = glyphs.filter((g) => Math.abs(measure(g) - w) <= w * tolerance);
  if (close.length >= 4) return close.join('');
  // Not enough: take the closest handful.
  return glyphs
    .map((g) => [g, Math.abs(measure(g) - w)] as const)
    .sort((a, b) => a[1] - b[1])
    .slice(0, Math.min(6, glyphs.length))
    .map(([g]) => g)
    .join('');
}

export type RevealOrder = 'ltr' | 'rtl' | 'center' | 'random';

/** Integer hash → [0, 1). */
function hash(a: number, b: number, c: number): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35) ^ Math.imul(c + 0x27d4eb2f, 0x165667b1);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  return (h >>> 0) / 4294967296;
}

/** Rank (0..1) at which each position is revealed for an order. Spaces are skipped by the caller. */
export function revealRanks(count: number, order: RevealOrder, seed: number): number[] {
  if (count <= 1) return [0];
  const idx = Array.from({ length: count }, (_, i) => i);
  if (order === 'rtl') return idx.map((i) => (count - 1 - i) / (count - 1));
  if (order === 'center') {
    const mid = (count - 1) / 2;
    return idx.map((i) => Math.abs(i - mid) / mid);
  }
  if (order === 'random') {
    const sorted = idx.slice().sort((a, b) => hash(a, seed, 7) - hash(b, seed, 7));
    const rank = new Array<number>(count);
    sorted.forEach((pos, k) => (rank[pos] = k / (count - 1)));
    return rank;
  }
  return idx.map((i) => i / (count - 1));
}

const STYLE = /* css */ `
:host {
  --_accent: var(--ane-decrypt-accent, #5ef2ff);
  --_glow: var(--ane-decrypt-glow, 1);
  display: inline;
  position: relative;
  font-size: var(--ane-size, inherit);
}
:host([hidden]) { display: none; }
.text { position: relative; }
.w { display: inline-block; white-space: nowrap; }
.c { position: relative; display: inline-block; white-space: pre; vertical-align: top; }
.c[data-k="grow"], .c[data-k="shrink"] { overflow: hidden; }
.f { visibility: hidden; }
.c[data-s="done"] .f { visibility: visible; }
.g {
  position: absolute;
  left: 50%;
  top: 0;
  transform: translateX(-50%);
  color: var(--_accent);
  opacity: 0.75;
  pointer-events: none;
  white-space: pre;
}
.c[data-s="done"] .g, .c[data-s="idle"] .g, .c[data-s="gone"] .g { display: none; }
.c[data-s="gone"] .f, .c[data-k="shrink"] .f { visibility: hidden; }
.c[data-s="old"] .g { color: inherit; opacity: 1; }
.c[data-s="flash"] .f {
  visibility: visible;
  color: #fff;
  text-shadow: 0 0 calc(0.45em * var(--_glow)) var(--_accent), 0 0 calc(0.12em * var(--_glow)) #fff;
}
.c[data-s="flash"] .g { display: none; }
.c[data-s="idle"] .f { visibility: hidden; }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
`;

/** Milliseconds per scramble glyph change. */
const TICK_MS = 55;
const FLASH_MS = 260;
/** Time for a new cell to open or an old one to close. */
const RESIZE_MS = 240;

interface Cell {
  /** `keep`: same position in both strings; `grow`: new position; `shrink`: position that goes away. */
  kind: 'keep' | 'grow' | 'shrink';
  width: number;
  el: HTMLElement;
  final: HTMLElement;
  glyph: HTMLElement;
  to: string;
  from: string;
  pool: string;
  start: number;
  lock: number;
  last: string;
}

/**
 * `<ane-decrypt-text>`: text that decodes itself out of scrambled glyphs, without layout jitter.
 * Changing `text` decodes from the old string to the new one.
 *
 * @attr text - the text (defaults to the element's text content)
 * @attr trigger - `view` (default, once when scrolled into view) | `hover` (also re-decodes on hover / focus) | `manual`
 * @attr order - `ltr` (default) | `rtl` | `center` | `random`
 * @attr charset - `latin` (default, case-aware) | `upper` | `hex` | `binary` | `digits` | `blocks` | `symbols` | `katakana`, or any string of glyphs
 * @attr stagger - total spread of reveal start times in ms, default `600`
 * @attr scramble - scramble time per character in ms, default `450`
 * @attr accent - colour of scrambling glyphs and the lock flash, default `#5ef2ff`
 * @attr glow - lock-flash glow strength 0..2, default `1`
 * @attr seed - integer seed for glyph choice and random order
 * @attr size, speed, motion
 * @fires ane-decrypt-done - when the text has fully decoded
 */
export class DecryptTextElement extends EffectElement {
  static override get observedAttributes(): string[] {
    return [...super.observedAttributes, 'text', 'order', 'charset', 'stagger', 'scramble', 'accent', 'glow', 'seed', 'trigger'];
  }

  #textEl: HTMLElement | null = null;
  #sr: HTMLElement | null = null;
  #cells: Cell[] = [];
  #shown = '';
  #runStart = -1;
  #running = false;
  #duration = 0;
  #seenObserver: IntersectionObserver | null = null;
  #measureCtx: CanvasRenderingContext2D | null | undefined;
  #widths = new Map<string, number>();
  #font = '';

  /** The target text. Setting it decodes from the current text. */
  get text(): string {
    return this.getAttribute('text') ?? this.textContent?.trim() ?? '';
  }
  set text(value: string) {
    this.setAttribute('text', value);
  }

  /** `true` while characters are still scrambling. */
  get decoding(): boolean {
    return this.#running;
  }

  protected build(root: ShadowRoot): void {
    root.innerHTML = `<style>${STYLE}</style><span class="text" part="text" aria-hidden="true"></span><span class="sr"></span>`;
    this.#textEl = root.querySelector('.text');
    this.#sr = root.querySelector('.sr');
    this.addEventListener('pointerenter', this.#onHover);
    this.addEventListener('focusin', this.#onHover);
    this.#syncStyle();
    this.#layout(this.text, '');
    // Nothing shows until the first decode (on view, on hover or via decode()).
    this.#setAll('idle');
  }

  override connectedCallback(): void {
    super.connectedCallback();
    const trigger = this.getAttribute('trigger') || 'view';
    if (trigger === 'manual' || this.#seenObserver) return;
    if (typeof IntersectionObserver !== 'function') {
      this.decode();
      return;
    }
    this.#seenObserver = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        this.#seenObserver?.disconnect();
        this.decode();
      }
    });
    this.#seenObserver.observe(this);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#seenObserver?.disconnect();
    this.#seenObserver = null;
  }

  protected override attributeChanged(name: string, oldValue: string | null): void {
    if (name === 'text') {
      // Morph from what is on screen now.
      const from = this.#running ? this.#shown : (oldValue ?? this.#shown);
      this.#layout(this.text, from);
      this.#begin();
    } else if (['order', 'stagger', 'scramble', 'charset', 'seed'].includes(name)) {
      this.#layout(this.text, '');
      if (this.#runStart >= 0) this.#begin();
    } else {
      this.#syncStyle();
    }
  }

  /** Decodes the current text from scrambled glyphs (again). */
  decode(): void {
    this.#layout(this.text, '');
    this.#begin();
  }

  #onHover = (): void => {
    if (this.getAttribute('trigger') === 'hover' && !this.#running) this.decode();
  };

  #syncStyle(): void {
    const accent = this.getAttribute('accent');
    if (accent) this.style.setProperty('--ane-decrypt-accent', accent);
    else this.style.removeProperty('--ane-decrypt-accent');
    this.style.setProperty('--ane-decrypt-glow', String(parseNumber(this.getAttribute('glow'), 1, 0, 2)));
  }

  #pool(): string {
    const name = this.getAttribute('charset') || 'latin';
    return (CHARSETS as Record<string, string>)[name] ?? (name.length > 1 ? name : CHARSETS.latin);
  }

  /** Builds one cell per grapheme of `to` (padding with `from`), grouped by word. */
  #layout(to: string, from: string): void {
    const host = this.#textEl;
    if (!host) return;
    this.#sr!.textContent = to;
    this.setAttribute('aria-label', to);
    if (!this.hasAttribute('role')) this.setAttribute('role', 'text');
    const target = graphemes(to);
    const source = graphemes(from);
    const n = Math.max(target.length, source.length);
    const pool = this.#pool();
    const charset = this.getAttribute('charset') || 'latin';
    const seed = Math.round(parseNumber(this.getAttribute('seed'), 7));
    const order = (['ltr', 'rtl', 'center', 'random'].includes(this.getAttribute('order') ?? '') ? this.getAttribute('order') : 'ltr') as RevealOrder;
    const stagger = parseNumber(this.getAttribute('stagger'), 600, 0, 20000);
    const scramble = parseNumber(this.getAttribute('scramble'), 450, 0, 20000);
    const ranks = revealRanks(n, order, seed);

    host.replaceChildren();
    this.#cells = [];
    let word: HTMLElement | null = null;
    for (let i = 0; i < n; i++) {
      const ch = target[i] ?? '';
      const old = source[i] ?? '';
      if (isSpace(ch) && (isSpace(old) || !old)) {
        word = null;
        host.append(document.createTextNode(ch));
        continue;
      }
      if (!word) {
        word = document.createElement('span');
        word.className = 'w';
        host.append(word);
      }
      const el = document.createElement('span');
      el.className = 'c';
      const final = document.createElement('span');
      final.className = 'f';
      // A disappearing cell keeps the old glyph as an invisible spacer until it closes.
      final.textContent = ch || old;
      const glyph = document.createElement('span');
      glyph.className = 'g';
      el.append(final, glyph);
      word.append(el);
      const start = ranks[i]! * stagger * 0.6;
      const kind: Cell['kind'] = !ch ? 'shrink' : from && !old ? 'grow' : 'keep';
      el.dataset.k = kind;
      this.#cells.push({
        kind,
        width: 0,
        el,
        final,
        glyph,
        to: ch,
        from: old,
        pool: widthMatched(poolFor(ch || old, charset, pool), ch || old, this.#measure),
        start,
        lock: start + scramble + ranks[i]! * stagger * 0.4,
        last: '',
      });
    }
    this.#duration = Math.max(0, ...this.#cells.map((c) => c.lock)) + Math.max(FLASH_MS, RESIZE_MS);
    // Measure once so opening and closing cells can animate their width.
    for (const c of this.#cells) {
      if (c.kind === 'keep') continue;
      c.width = c.el.getBoundingClientRect().width;
      if (c.kind === 'grow') c.el.style.width = '0px';
    }
  }

  /** Glyph advance width in the element's current font (cached per font); 0 when unavailable. */
  #measure = (ch: string): number => {
    if (this.#measureCtx === undefined) {
      try {
        this.#measureCtx = document.createElement('canvas').getContext('2d');
      } catch {
        this.#measureCtx = null;
      }
    }
    const ctx = this.#measureCtx;
    if (!ctx) return 0;
    const cs = getComputedStyle(this.#textEl ?? this);
    const font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    if (font !== this.#font) {
      this.#font = font;
      this.#widths.clear();
      ctx.font = font;
    }
    let w = this.#widths.get(ch);
    if (w === undefined) {
      w = ctx.measureText(ch).width;
      this.#widths.set(ch, w);
    }
    return w;
  };

  #setAll(state: string): void {
    for (const c of this.#cells) c.el.dataset.s = state;
  }

  #begin(): void {
    if (this.reducedMotion) {
      // No scrambling: a short fade of the final text.
      this.#setAll('done');
      this.#textEl?.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: 'ease-out' });
      this.#running = false;
      this.#shown = this.text;
      this.#emitDone();
      return;
    }
    this.#runStart = this.elapsed;
    this.#running = true;
    // Off-screen the animation loop is paused. Give a pending scroll a moment to bring the
    // element into view; if it stays hidden, finish so apps waiting for ane-decrypt-done never hang.
    if (!this.onScreen) {
      const run = this.#runStart;
      setTimeout(() => {
        if (this.#running && this.#runStart === run && !this.onScreen) this.#finish();
      }, 300);
      return;
    }
    this.tick(0);
  }

  #emitDone(): void {
    this.dispatchEvent(new CustomEvent('ane-decrypt-done', { detail: { text: this.text }, bubbles: true, composed: true }));
  }

  protected tick(_deltaMs: number): void {
    if (!this.#running) return;
    const t = this.elapsed - this.#runStart;
    const slot = Math.floor(t / TICK_MS);
    const seed = Math.round(parseNumber(this.getAttribute('seed'), 7));
    let shown = '';
    this.#cells.forEach((c, i) => {
      let state: string;
      let glyph = '';
      if (t < c.start) {
        state = c.from ? 'old' : 'scramble';
        glyph = c.from || this.#pick(c, i, slot, seed);
      } else if (t < c.lock) {
        state = 'scramble';
        glyph = this.#pick(c, i, slot, seed);
      } else if (t < c.lock + FLASH_MS && c.to) {
        state = 'flash';
      } else {
        state = c.to ? 'done' : 'gone';
      }
      if (c.kind === 'grow') {
        const k = Math.min(1, Math.max(0, (t - c.start) / RESIZE_MS));
        c.el.style.width = k >= 1 ? '' : `${(c.width * k).toFixed(2)}px`;
      } else if (c.kind === 'shrink' && t >= c.lock) {
        const k = Math.min(1, (t - c.lock) / RESIZE_MS);
        c.el.style.width = `${(c.width * (1 - k)).toFixed(2)}px`;
        c.el.style.opacity = String(1 - k);
      }
      if (c.el.dataset.s !== state) c.el.dataset.s = state;
      if (glyph !== c.last) {
        c.glyph.textContent = glyph;
        c.last = glyph;
      }
      shown += state === 'done' || state === 'flash' ? c.to : glyph;
    });
    this.#shown = shown;
    if (t >= this.#duration) this.#finish();
  }

  protected override visibilityChanged(visible: boolean): void {
    if (!visible && this.#running) this.#finish();
  }

  /** Shows the final text at once and fires ane-decrypt-done. */
  #finish(): void {
    this.#running = false;
    for (const c of this.#cells) {
      // Remove padding cells left over from a longer previous string.
      if (!c.to) {
        c.el.remove();
        continue;
      }
      c.el.dataset.s = 'done';
      c.el.style.width = '';
      c.el.style.opacity = '';
    }
    this.#shown = this.text;
    this.#emitDone();
  }

  #pick(c: Cell, i: number, slot: number, seed: number): string {
    if (!c.to && !c.from) return '';
    const pool = c.pool;
    const h = hash(i, slot, seed);
    return pool[Math.floor(h * pool.length) % pool.length]!;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ane-decrypt-text': DecryptTextElement;
  }
  interface HTMLElementEventMap {
    'ane-decrypt-done': CustomEvent<{ text: string }>;
  }
}

/** Registers `<ane-decrypt-text>` (or a custom tag name). Safe to call more than once. */
export function defineDecryptText(tag = 'ane-decrypt-text'): void {
  defineElement(tag, DecryptTextElement);
}

