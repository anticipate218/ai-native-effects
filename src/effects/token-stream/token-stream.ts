import { defineElement, EffectElement } from '../../core/effect-element';
import { clamp, damp, easeOutCubic, parseNumber } from '../../core/math';

export type Granularity = 'word' | 'char';
export type CaretMode = 'auto' | 'persist' | 'none';

export interface StreamUnit {
  kind: 'text' | 'space' | 'br' | 'para' | 'code';
  text: string;
  bold: boolean;
}

/** Unambiguous opening punctuation attaches to the next word. Straight quotes are ambiguous. */
const OPENING = /^[([{“‘«‹「『《〈【〔（]+$/u;
const ONLY_SPACE = /^\s+$/u;

const wordSegmenter = typeof Intl !== 'undefined' && 'Segmenter' in Intl ? new Intl.Segmenter(undefined, { granularity: 'word' }) : null;
const graphemeSegmenter = typeof Intl !== 'undefined' && 'Segmenter' in Intl ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;

interface Segment {
  segment: string;
  index: number;
  isWordLike: boolean;
}

/** Word segments, with a whitespace-based fallback where `Intl.Segmenter` is missing. */
function segmentWords(text: string): Segment[] {
  if (wordSegmenter) {
    return [...wordSegmenter.segment(text)].map((s) => ({ segment: s.segment, index: s.index, isWordLike: Boolean(s.isWordLike) }));
  }
  const out: Segment[] = [];
  const re = /\s+|[^\s]+/gu;
  for (let m = re.exec(text); m; m = re.exec(text)) out.push({ segment: m[0], index: m.index, isWordLike: !ONLY_SPACE.test(m[0]) });
  return out;
}

/** Splits text into graphemes (emoji and combining marks stay whole). */
export function graphemes(text: string): string[] {
  return graphemeSegmenter ? [...graphemeSegmenter.segment(text)].map((s) => s.segment) : Array.from(text);
}

/**
 * Turns a plain-text run into display units: words (with their punctuation attached so a
 * comma never starts a line) and whitespace. CJK text is split into words by `Intl.Segmenter`.
 */
export function splitText(text: string, bold: boolean): StreamUnit[] {
  const units: StreamUnit[] = [];
  let current: string | null = null;
  let prefix = '';
  const flush = (): void => {
    if (current !== null) units.push({ kind: 'text', text: current, bold });
    current = null;
  };
  for (const { segment, isWordLike } of segmentWords(text)) {
    if (ONLY_SPACE.test(segment)) {
      flush();
      if (prefix) {
        units.push({ kind: 'text', text: prefix, bold });
        prefix = '';
      }
      units.push({ kind: 'space', text: ' ', bold });
    } else if (isWordLike) {
      flush();
      current = prefix + segment;
      prefix = '';
    } else if (OPENING.test(segment)) {
      flush();
      prefix += segment;
    } else if (current !== null) {
      current += segment;
    } else {
      prefix += segment;
    }
  }
  flush();
  if (prefix) units.push({ kind: 'text', text: prefix, bold });
  return units;
}

/**
 * Incremental tokenizer for streamed text. It only emits units that cannot change when more
 * text arrives: a trailing half-word, an unclosed `code` span, a lone `*` or a final newline
 * (which might become a paragraph break) wait for the next chunk or for `final`.
 *
 * Supported formatting: line breaks, blank-line paragraphs, `inline code` and **bold**.
 */
export class StreamTokenizer {
  #pending = '';
  #bold = false;

  /** Characters received but not yet emitted. */
  get pendingLength(): number {
    return this.#pending.length;
  }

  push(text: string, final = false): StreamUnit[] {
    const s = this.#pending + text;
    const out: StreamUnit[] = [];
    let buffer = '';
    let i = 0;
    const flushBuffer = (): void => {
      if (buffer) out.push(...splitText(buffer, this.#bold));
      buffer = '';
    };
    while (i < s.length) {
      const c = s[i]!;
      if (c === '`') {
        const end = s.indexOf('`', i + 1);
        if (end < 0) {
          if (!final) break;
          buffer += s.slice(i);
          i = s.length;
          break;
        }
        flushBuffer();
        if (end > i + 1) out.push({ kind: 'code', text: s.slice(i + 1, end), bold: this.#bold });
        i = end + 1;
        continue;
      }
      if (c === '*' && s[i + 1] === '*') {
        flushBuffer();
        this.#bold = !this.#bold;
        i += 2;
        continue;
      }
      if (c === '*' && i === s.length - 1 && !final) break;
      if (c === '\r') {
        i++;
        continue;
      }
      if (c === '\n') {
        let j = i;
        while (s[j] === '\n' || s[j] === '\r') j++;
        if (j === s.length && !final) break; // more newlines may follow
        flushBuffer();
        const breaks = s.slice(i, j).replace(/\r/g, '').length;
        out.push({ kind: breaks > 1 ? 'para' : 'br', text: '\n', bold: this.#bold });
        i = j;
        continue;
      }
      buffer += c;
      i++;
    }
    let rest = s.slice(i);
    // Only text that runs to the very end of the input can still be growing.
    if (!final && buffer && i >= s.length) {
      // Hold back a trailing word that may still be growing.
      const segments = segmentWords(buffer);
      const last = segments[segments.length - 1];
      if (last && !ONLY_SPACE.test(last.segment)) {
        rest = buffer.slice(last.index) + rest;
        buffer = buffer.slice(0, last.index);
      }
    }
    flushBuffer();
    this.#pending = rest;
    return out;
  }

  reset(): void {
    this.#pending = '';
    this.#bold = false;
  }
}

const STYLE = /* css */ `
:host {
  --_text: var(--ane-stream-color, currentColor);
  --_accent: var(--ane-stream-accent, #7c5cff);
  display: block;
  position: relative;
  font-size: var(--ane-size, inherit);
  line-height: 1.6;
  overflow-wrap: anywhere;
}
:host([hidden]) { display: none; }
.wrap { position: relative; isolation: isolate; }
.body { color: var(--_text); }
.glow {
  position: absolute;
  left: 0;
  top: 0;
  width: 6em;
  height: 2.6em;
  margin: -1.3em 0 0 -3em;
  border-radius: 50%;
  background: radial-gradient(closest-side, color-mix(in srgb, var(--_accent) 34%, transparent), transparent);
  pointer-events: none;
  z-index: -1;
  opacity: 0;
  will-change: transform, opacity;
}
.t, .w, .c { display: inline-block; white-space: pre-wrap; }
.w { white-space: nowrap; }
.t.anim, .c.anim {
  color: color-mix(in oklab, var(--_accent) calc(var(--k, 0) * 100%), var(--_text));
}
.c.wait { opacity: 0; }
.b { font-weight: 650; }
.code {
  font-family: ui-monospace, "SFMono-Regular", "Cascadia Mono", Menlo, Consolas, monospace;
  font-size: 0.88em;
  padding: 0.05em 0.38em;
  border-radius: 0.35em;
  background: color-mix(in srgb, var(--_accent) 14%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--_accent) 26%, transparent);
  white-space: pre-wrap;
}
.pb { display: block; height: 0.7em; }
.caret {
  display: inline-block;
  width: 0.11em;
  min-width: 2px;
  height: 1.08em;
  margin-left: 0.08em;
  vertical-align: -0.17em;
  border-radius: 1px;
  background: var(--_accent);
  box-shadow: 0 0 0.5em color-mix(in srgb, var(--_accent) 70%, transparent);
}
.caret[hidden] { display: none; }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
`;

/** Reveal duration of one unit (ms, effect time). */
const INK_MS = 460;
const INK_MS_REDUCED = 160;
/** Backlog is drained within about this many seconds, however bursty the source. */
const CATCH_UP = 0.8;
/** Longest delay a single unit may cost (characters), so a long URL never stalls the stream. */
const MAX_COST = 12;

interface Atom {
  el: HTMLElement;
  start: number;
}

/**
 * `<ane-token-stream>`: streamed LLM text that writes itself smoothly. Bursty chunks are
 * buffered and released at an adaptive pace; each word rises out of a blur and "dries" from
 * the accent color, behind a glowing caret.
 *
 * @attr rate - base reveal speed in characters per second, default `60` (adapts upwards to the backlog)
 * @attr granularity - `word` (default) | `char`
 * @attr caret - `auto` (fades out when done) | `persist` | `none`
 * @attr color - text color, default `currentColor`
 * @attr accent - ink, caret and glow color, default `#7c5cff`
 * @attr size - font size (CSS length), default inherited
 * @attr speed - animation time scale, `0`-`5`
 * @attr motion - `auto` | `reduce` | `full`
 * @attr announce - announces "Response complete" through a polite live region
 * @attr label - accessible name of the text region
 * @fires ane-stream-end - after `done()` once every unit has been revealed
 * @csspart body
 * @cssprop --ane-size, --ane-stream-color, --ane-stream-accent
 */
export class TokenStreamElement extends EffectElement {
  static override get observedAttributes(): string[] {
    return [...super.observedAttributes, 'rate', 'granularity', 'caret', 'color', 'accent', 'label', 'announce'];
  }

  #body: HTMLElement | null = null;
  #caret: HTMLElement | null = null;
  #glow: HTMLElement | null = null;
  #live: HTMLElement | null = null;

  #tokenizer = new StreamTokenizer();
  #queue: StreamUnit[] = [];
  #queuedChars = 0;
  /** Graphemes of the unit being revealed in `char` mode. */
  #partial: { atoms: HTMLElement[]; next: number } | null = null;
  #budget = 0;
  #raw = '';
  #final = false;
  #ended = false;
  #active: Atom[] = [];
  #lastRelease = -Infinity;
  #endedAt = -Infinity;
  #activity = 0;
  #glowX = 0;
  #glowY = 0;
  #glowPlaced = false;
  #caretDirty = true;
  #targetX = 0;
  #targetY = 0;
  #waiters: Array<() => void> = [];

  /** Every character received so far (including formatting markers). */
  get text(): string {
    return this.#raw;
  }

  /** `true` until `done()` has been called and every unit is revealed. */
  get streaming(): boolean {
    return !this.#ended;
  }

  get rate(): number {
    return parseNumber(this.getAttribute('rate'), 60, 1, 2000);
  }
  set rate(value: number) {
    this.setAttribute('rate', String(value));
  }

  get granularity(): Granularity {
    return this.getAttribute('granularity') === 'char' ? 'char' : 'word';
  }
  set granularity(value: Granularity) {
    this.setAttribute('granularity', value);
  }

  protected build(root: ShadowRoot): void {
    root.innerHTML = `<style>${STYLE}</style><div class="wrap"><div class="glow" aria-hidden="true"></div><div class="body" part="body" role="region" aria-busy="true"><span class="caret" aria-hidden="true"></span></div></div><span class="sr" aria-live="polite"></span>`;
    this.#body = root.querySelector('.body');
    this.#caret = root.querySelector('.caret');
    this.#glow = root.querySelector('.glow');
    this.#live = root.querySelector('.sr');
    this.#syncLabel();
    this.#syncColors();
    this.#syncCaret();
    // Progressive enhancement: text written inside the tag streams in once upgraded.
    const initial = this.textContent?.replace(/^\s*\n|\n\s*$/g, '').trim();
    if (initial) {
      this.write(initial);
      this.done();
    }
  }

  protected override attributeChanged(name: string): void {
    if (name === 'label') this.#syncLabel();
    if (name === 'color' || name === 'accent') this.#syncColors();
    if (name === 'caret') this.#syncCaret();
  }

  protected override motionChanged(): void {
    this.tick(0);
  }

  /**
   * Nobody watches an off-screen answer, and the animation loop is paused there: reveal what
   * has arrived at once so `finished` and `ane-stream-end` are not held hostage by scrolling.
   */
  protected override visibilityChanged(visible: boolean): void {
    if (!visible) this.skip();
  }

  #catchUpIfHidden(): void {
    if (!this.onScreen && this.isConnected) this.skip();
  }

  #syncLabel(): void {
    this.#body?.setAttribute('aria-label', this.getAttribute('label') || 'Assistant response');
  }

  #syncColors(): void {
    const color = this.getAttribute('color');
    const accent = this.getAttribute('accent');
    if (color) this.style.setProperty('--ane-stream-color', color);
    else this.style.removeProperty('--ane-stream-color');
    if (accent) this.style.setProperty('--ane-stream-accent', accent);
    else this.style.removeProperty('--ane-stream-accent');
  }

  #syncCaret(): void {
    if (this.#caret) this.#caret.hidden = this.getAttribute('caret') === 'none';
  }

  // --- public API ----------------------------------------------------------------

  /** Adds a chunk of streamed text. Call `done()` when the source has finished. */
  write(text: string): void {
    if (!text) return;
    if (this.#ended) this.#ended = false;
    this.#final = false;
    this.#raw += text;
    this.#enqueue(this.#tokenizer.push(text));
    this.#busy(true);
    this.#catchUpIfHidden();
  }

  /** Marks the end of the stream; the rest of the buffer is revealed, then `ane-stream-end` fires. */
  done(): void {
    this.#final = true;
    this.#enqueue(this.#tokenizer.push('', true));
    this.#maybeEnd();
    this.#catchUpIfHidden();
  }

  /** Streams an async iterable or a `ReadableStream` of strings or bytes, then calls `done()`. */
  async stream(source: AsyncIterable<string | Uint8Array> | ReadableStream<string | Uint8Array>): Promise<void> {
    const decoder = new TextDecoder();
    const take = (chunk: string | Uint8Array): void =>
      this.write(typeof chunk === 'string' ? chunk : decoder.decode(chunk, { stream: true }));
    if ('getReader' in source) {
      const reader = source.getReader();
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value != null) take(value);
      }
    } else {
      for await (const chunk of source) take(chunk);
    }
    const tail = decoder.decode();
    if (tail) this.write(tail);
    this.done();
    return this.finished;
  }

  /** Resolves when the current stream has been fully revealed. */
  get finished(): Promise<void> {
    if (this.#ended) return Promise.resolve();
    return new Promise((resolve) => this.#waiters.push(resolve));
  }

  /** Reveals everything that has arrived, without animation. */
  skip(): void {
    while (this.#partial || this.#queue.length) this.#releaseNext(true);
    for (const atom of this.#active) this.#settle(atom.el);
    this.#active = [];
    this.#caretDirty = true;
    this.#maybeEnd();
  }

  /** Clears the text and starts a new, empty stream. */
  reset(): void {
    this.#tokenizer.reset();
    this.#queue = [];
    this.#queuedChars = 0;
    this.#partial = null;
    this.#active = [];
    this.#budget = 0;
    this.#raw = '';
    this.#final = false;
    this.#ended = false;
    this.#endedAt = -Infinity;
    this.#glowPlaced = false;
    this.#caretDirty = true;
    if (this.#body && this.#caret) this.#body.replaceChildren(this.#caret);
    if (this.#live) this.#live.textContent = '';
    this.#busy(true);
  }

  // --- internals -----------------------------------------------------------------

  #busy(on: boolean): void {
    this.#body?.setAttribute('aria-busy', String(on));
  }

  #enqueue(units: StreamUnit[]): void {
    for (const unit of units) {
      this.#queue.push(unit);
      this.#queuedChars += unit.text.length;
    }
  }

  #cost(unit: StreamUnit): number {
    if (unit.kind === 'space') return 0;
    if (unit.kind === 'br' || unit.kind === 'para') return unit.kind === 'para' ? 6 : 2;
    // In `char` mode every grapheme is paid for separately as it is revealed.
    if (this.granularity === 'char') return 1;
    return Math.min(MAX_COST, Math.max(1, unit.text.length));
  }

  /** Reveals the next unit (or grapheme, in `char` mode). Returns its cost. */
  #releaseNext(instant = false): number {
    const body = this.#body;
    const caret = this.#caret;
    if (!body || !caret) return 0;
    const now = this.elapsed;

    if (this.#partial) {
      const atom = this.#partial.atoms[this.#partial.next++]!;
      this.#reveal(atom, now, instant);
      if (this.#partial.next >= this.#partial.atoms.length) this.#partial = null;
      return 1;
    }

    const unit = this.#queue.shift();
    if (!unit) return 0;
    this.#queuedChars -= unit.text.length;
    this.#caretDirty = true;
    this.#lastRelease = now;

    if (unit.kind === 'space') {
      body.insertBefore(document.createTextNode(' '), caret);
      return 0;
    }
    if (unit.kind === 'br') {
      body.insertBefore(document.createElement('br'), caret);
      return this.#cost(unit);
    }
    if (unit.kind === 'para') {
      const gap = document.createElement('span');
      gap.className = 'pb';
      body.insertBefore(gap, caret);
      return this.#cost(unit);
    }

    const classes = `${unit.bold ? ' b' : ''}${unit.kind === 'code' ? ' code' : ''}`;
    if (this.granularity === 'char' && !instant) {
      // Lay the whole word out first (invisible), then reveal grapheme by grapheme:
      // no reflow jitter, and the word never breaks across lines.
      const word = document.createElement('span');
      word.className = `w${classes}`;
      const atoms = graphemes(unit.text).map((g) => {
        const span = document.createElement('span');
        span.className = 'c wait';
        span.textContent = g;
        word.append(span);
        return span;
      });
      body.insertBefore(word, caret);
      this.#partial = { atoms, next: 0 };
      return this.#releaseNext();
    }
    const span = document.createElement('span');
    span.className = `t${classes}`;
    span.textContent = unit.text;
    body.insertBefore(span, caret);
    this.#reveal(span, now, instant);
    return this.#cost(unit);
  }

  #reveal(el: HTMLElement, now: number, instant: boolean): void {
    el.classList.remove('wait');
    this.#lastRelease = now;
    if (instant) return;
    el.classList.add('anim');
    this.#paint(el, 0);
    this.#active.push({ el, start: now });
  }

  /** Writes the ink state for progress `k` (0 = just revealed, 1 = settled). */
  #paint(el: HTMLElement, k: number): void {
    const s = el.style;
    if (this.reducedMotion) {
      s.opacity = String(k);
      return;
    }
    const e = easeOutCubic(k);
    s.opacity = String(Math.min(1, 0.18 + e * 1.2));
    s.filter = e > 0.97 ? '' : `blur(${((1 - e) * 0.16).toFixed(3)}em)`;
    s.transform = `translateY(${((1 - e) * 0.26).toFixed(3)}em)`;
    s.setProperty('--k', ((1 - e) * 0.85).toFixed(3));
  }

  #settle(el: HTMLElement): void {
    el.classList.remove('anim');
    el.removeAttribute('style');
  }

  #maybeEnd(): void {
    if (this.#ended || !this.#final || this.#queue.length || this.#partial || this.#tokenizer.pendingLength) return;
    this.#ended = true;
    this.#endedAt = this.elapsed;
    this.#busy(false);
    if (this.hasAttribute('announce') && this.#live) this.#live.textContent = 'Response complete';
    this.dispatchEvent(new CustomEvent('ane-stream-end', { detail: { text: this.#raw }, bubbles: true, composed: true }));
    const waiters = this.#waiters;
    this.#waiters = [];
    waiters.forEach((resolve) => resolve());
  }

  protected tick(deltaMs: number): void {
    const now = this.elapsed;
    const reduced = this.reducedMotion;

    // 1. Release units at an adaptive pace.
    if (this.#queue.length || this.#partial) {
      const backlog = this.#queuedChars + this.#tokenizer.pendingLength;
      const rate = Math.max(this.rate, backlog / CATCH_UP);
      this.#budget += (rate * deltaMs) / 1000;
      let guard = 0;
      while ((this.#queue.length || this.#partial) && guard++ < 400) {
        const next = this.#partial ? 1 : this.#cost(this.#queue[0]!);
        if (this.#budget < next) break;
        this.#budget -= this.#releaseNext();
      }
      if (!this.#queue.length && !this.#partial) this.#budget = Math.min(this.#budget, 1);
      this.#maybeEnd();
    } else {
      this.#budget = 0;
    }

    // 2. Ink: only units that are still animating are touched.
    if (this.#active.length) {
      const duration = reduced ? INK_MS_REDUCED : INK_MS;
      let keep = 0;
      for (const atom of this.#active) {
        const k = clamp((now - atom.start) / duration, 0, 1);
        if (k >= 1) {
          this.#settle(atom.el);
        } else {
          this.#paint(atom.el, k);
          this.#active[keep++] = atom;
        }
      }
      this.#active.length = keep;
    }

    // 3. Caret and glow.
    this.#updateCaret(deltaMs, now, reduced);
  }

  #updateCaret(deltaMs: number, now: number, reduced: boolean): void {
    const caret = this.#caret;
    const glow = this.#glow;
    if (!caret || !glow) return;
    const mode = (this.getAttribute('caret') || 'auto') as CaretMode;
    const writing = now - this.#lastRelease < 260;
    const t = now / 1000;

    let opacity: number;
    if (this.#ended && mode !== 'persist') {
      opacity = 1 - clamp((now - this.#endedAt) / 450, 0, 1);
    } else if (writing || reduced) {
      opacity = 1;
    } else {
      opacity = 0.25 + 0.75 * (0.5 + 0.5 * Math.cos(t * Math.PI * 2 * 0.9));
    }
    caret.style.opacity = String(opacity);
    if (mode !== 'none') caret.hidden = opacity <= 0;

    const target = this.#ended ? 0 : writing ? 1 : 0.45;
    this.#activity = reduced ? 0 : damp(this.#activity, target, 6, deltaMs);
    if (reduced || mode === 'none') {
      glow.style.opacity = '0';
      return;
    }
    if (this.#caretDirty && !caret.hidden) {
      this.#targetX = caret.offsetLeft;
      this.#targetY = caret.offsetTop + caret.offsetHeight / 2;
      this.#caretDirty = false;
      if (!this.#glowPlaced) {
        this.#glowX = this.#targetX;
        this.#glowY = this.#targetY;
        this.#glowPlaced = true;
      }
    }
    // Lines jump instantly; along a line the glow glides behind the pen.
    if (Math.abs(this.#targetY - this.#glowY) > 4) {
      this.#glowY = this.#targetY;
      this.#glowX = this.#targetX;
    } else {
      this.#glowX = damp(this.#glowX, this.#targetX, 14, deltaMs);
      this.#glowY = damp(this.#glowY, this.#targetY, 14, deltaMs);
    }
    glow.style.opacity = String(this.#activity * Math.max(opacity, 0.4));
    glow.style.transform = `translate(${this.#glowX.toFixed(1)}px, ${this.#glowY.toFixed(1)}px)`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ane-token-stream': TokenStreamElement;
  }
}

/** Registers `<ane-token-stream>` (or a custom tag name). Safe to call more than once. */
export function defineTokenStream(tag = 'ane-token-stream'): void {
  defineElement(tag, TokenStreamElement);
}
