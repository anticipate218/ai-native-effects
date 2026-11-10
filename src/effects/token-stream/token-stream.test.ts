import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getTickerStats } from '../../core/ticker';
import { graphemes, splitText, StreamTokenizer, TokenStreamElement } from './index';

const texts = (units: Array<{ kind: string; text: string }>): string[] =>
  units.filter((u) => u.kind !== 'space').map((u) => (u.kind === 'text' ? u.text : `<${u.kind}:${u.text}>`));

describe('StreamTokenizer', () => {
  it('holds back a word that may still be growing', () => {
    const t = new StreamTokenizer();
    expect(texts(t.push('Hello wor'))).toEqual(['Hello']);
    expect(t.pendingLength).toBe(3);
    expect(texts(t.push('ld and'))).toEqual(['world']);
    expect(texts(t.push('', true))).toEqual(['and']);
    expect(t.pendingLength).toBe(0);
  });

  it('keeps punctuation attached to its word', () => {
    expect(texts(splitText('Hi, there. (Yes) "ok"', false))).toEqual(['Hi,', 'there.', '(Yes)', '"ok"']);
  });

  it('waits for a closing backtick before emitting code', () => {
    const t = new StreamTokenizer();
    expect(texts(t.push('run `npm ru'))).toEqual(['run']);
    expect(texts(t.push('n check` now', true))).toEqual(['<code:npm run check>', 'now']);
  });

  it('toggles bold across chunks, including a split marker', () => {
    const t = new StreamTokenizer();
    const first = t.push('a *');
    expect(texts(first)).toEqual(['a']);
    const units = [...t.push('*big** b', true)];
    expect(units.find((u) => u.text === 'big')?.bold).toBe(true);
    expect(units.find((u) => u.text === 'b')?.bold).toBe(false);
  });

  it('distinguishes line breaks from paragraphs, even when split', () => {
    const t = new StreamTokenizer();
    expect(texts(t.push('one\n'))).toEqual(['one']);
    expect(texts(t.push('\ntwo\nthree', true))).toEqual(['<para:\n>', 'two', '<br:\n>', 'three']);
  });

  it('splits Chinese into words without spaces', () => {
    const units = texts(splitText('洪水范围扩大了，主要在莱茵河下游。', false));
    expect(units.length).toBeGreaterThan(3);
    expect(units.join('')).toBe('洪水范围扩大了，主要在莱茵河下游。');
    expect(units.some((u) => u.startsWith('，'))).toBe(false);
  });

  it('keeps emoji and combining marks whole', () => {
    expect(graphemes('a👩‍🚀é')).toEqual(['a', '👩‍🚀', 'é']);
  });
});

describe('<ane-token-stream>', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.useRealTimers();
  });

  const mount = (attrs: Record<string, string> = {}, content = ''): TokenStreamElement => {
    const el = document.createElement('ane-token-stream');
    for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
    el.textContent = content;
    document.body.append(el);
    return el;
  };
  const shown = (el: TokenStreamElement): string => el.shadowRoot!.querySelector('.body')!.textContent!;
  const body = (el: TokenStreamElement): HTMLElement => el.shadowRoot!.querySelector('.body')!;

  it('reveals written text over time and marks the region busy', () => {
    const el = mount({ rate: '60' });
    expect(body(el).getAttribute('aria-busy')).toBe('true');
    expect(body(el).getAttribute('aria-label')).toBe('Assistant response');
    el.write('The quick brown fox jumps ');
    vi.advanceTimersByTime(50);
    const early = shown(el);
    vi.advanceTimersByTime(2000);
    expect(early.length).toBeLessThan(shown(el).length);
    expect(shown(el)).toBe('The quick brown fox jumps ');
    expect(el.text).toBe('The quick brown fox jumps ');
  });

  it('catches up with a large backlog instead of lagging', () => {
    const el = mount({ rate: '10' });
    const text = 'word '.repeat(80);
    el.write(text);
    el.done();
    // At the base rate this would take 40 s; the backlog drains with a ~0.8 s time constant.
    vi.advanceTimersByTime(2500);
    expect(shown(el).length).toBeGreaterThan(text.length * 0.9);
  });

  it('fires ane-stream-end once after done() and resolves finished', async () => {
    const el = mount();
    const end = vi.fn();
    el.addEventListener('ane-stream-end', end);
    el.write('Short answer.');
    const finished = el.finished;
    el.done();
    vi.advanceTimersByTime(1500);
    await finished;
    expect(end).toHaveBeenCalledTimes(1);
    expect(end.mock.calls[0]![0].detail.text).toBe('Short answer.');
    expect(body(el).getAttribute('aria-busy')).toBe('false');
    vi.advanceTimersByTime(500);
    expect(end).toHaveBeenCalledTimes(1);
  });

  it('renders formatting as real elements', () => {
    const el = mount();
    el.write('**Bold** and `code`\n\nNext line');
    el.done();
    el.skip();
    const root = el.shadowRoot!;
    expect(root.querySelector('.b')!.textContent).toBe('Bold');
    expect(root.querySelector('.code')!.textContent).toBe('code');
    expect(root.querySelector('.pb')).not.toBeNull();
    expect(shown(el)).toBe('Bold and codeNext line');
  });

  it('reveals grapheme by grapheme in char mode without splitting words', () => {
    const el = mount({ granularity: 'char', rate: '20' });
    el.write('Hello there');
    el.done();
    vi.advanceTimersByTime(120);
    const word = el.shadowRoot!.querySelector('.w')!;
    expect(word.querySelectorAll('.c')).toHaveLength(5);
    expect(word.querySelectorAll('.c.wait').length).toBeGreaterThan(0);
    vi.advanceTimersByTime(3000);
    expect(el.shadowRoot!.querySelectorAll('.c.wait')).toHaveLength(0);
  });

  it('skip() reveals everything immediately and reset() clears', () => {
    const el = mount({ rate: '5' });
    el.write('A fairly long answer that would take a while.');
    el.done();
    el.skip();
    expect(shown(el)).toBe('A fairly long answer that would take a while.');
    expect(el.streaming).toBe(false);
    el.reset();
    expect(shown(el)).toBe('');
    expect(el.text).toBe('');
    expect(el.streaming).toBe(true);
    expect(el.shadowRoot!.querySelector('.caret')).not.toBeNull();
  });

  it('streams async iterables and byte streams', async () => {
    const el = mount();
    async function* source(): AsyncGenerator<string> {
      yield 'Hello ';
      yield 'world';
    }
    const done = el.stream(source());
    await vi.waitFor(() => expect(el.text).toBe('Hello world'));
    vi.advanceTimersByTime(2000);
    await done;
    expect(shown(el)).toBe('Hello world');

    const bytes = new TextEncoder().encode('字节流');
    const readable = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes.slice(0, 4));
        controller.enqueue(bytes.slice(4));
        controller.close();
      },
    });
    el.reset();
    const second = el.stream(readable);
    await vi.waitFor(() => expect(el.text).toBe('字节流'));
    vi.advanceTimersByTime(2000);
    await second;
    expect(shown(el)).toBe('字节流');
  });

  it('streams text written inside the tag', () => {
    const el = mount({}, 'Pre-rendered answer');
    vi.advanceTimersByTime(2000);
    expect(shown(el)).toBe('Pre-rendered answer');
    expect(el.streaming).toBe(false);
  });

  it('announces completion when asked', () => {
    const el = mount({ announce: '' });
    el.write('Done.');
    el.done();
    el.skip();
    expect(el.shadowRoot!.querySelector('.sr')!.textContent).toBe('Response complete');
  });

  it('reveals instantly while scrolled out of view, so finished is never held up', () => {
    let fire: ((visible: boolean) => void) | null = null;
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(cb: IntersectionObserverCallback) {
          fire = (visible) => cb([{ isIntersecting: visible } as IntersectionObserverEntry], this as never);
        }
        observe(): void {}
        disconnect(): void {}
      },
    );
    const el = mount({ rate: '5' });
    el.write('Text that would take a long time ');
    fire!(false);
    expect(shown(el)).toBe('Text that would take a long time ');
    const end = vi.fn();
    el.addEventListener('ane-stream-end', end);
    el.write('to finish.');
    el.done();
    expect(end).toHaveBeenCalledTimes(1);
    expect(shown(el)).toBe('Text that would take a long time to finish.');
    vi.unstubAllGlobals();
  });

  it('settles ink styles and cleans up when removed', () => {
    const errors = vi.spyOn(console, 'error');
    const el = mount({ motion: 'reduce' });
    expect(el.reducedMotion).toBe(true);
    el.write('Calm text ');
    vi.advanceTimersByTime(1500);
    expect(el.shadowRoot!.querySelectorAll('.t[style]')).toHaveLength(0);
    expect(errors).not.toHaveBeenCalled();
    el.remove();
    expect(getTickerStats().subscribers).toBe(0);
  });
});
