import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getTickerStats } from '../../core/ticker';
import { CHARSETS, DecryptTextElement, poolFor, revealRanks, widthMatched } from './index';

describe('helpers', () => {
  it('ranks positions for each reveal order', () => {
    expect(revealRanks(5, 'ltr', 1)).toEqual([0, 0.25, 0.5, 0.75, 1]);
    expect(revealRanks(5, 'rtl', 1)).toEqual([1, 0.75, 0.5, 0.25, 0]);
    expect(revealRanks(5, 'center', 1)).toEqual([1, 0.5, 0, 0.5, 1]);
    const random = revealRanks(6, 'random', 3);
    expect([...random].sort()).toEqual([0, 0.2, 0.4, 0.6, 0.8, 1]);
    expect(revealRanks(6, 'random', 3)).toEqual(random); // deterministic
    expect(revealRanks(1, 'ltr', 1)).toEqual([0]);
  });

  it('keeps case and script with the latin charset', () => {
    expect(poolFor('a', 'latin', CHARSETS.latin)).toMatch(/^[a-z]+$/);
    expect(poolFor('Q', 'latin', CHARSETS.latin)).toMatch(/^[A-Z]+$/);
    expect(poolFor('7', 'latin', CHARSETS.latin)).toBe(CHARSETS.digits);
    expect(poolFor('a', 'hex', CHARSETS.hex)).toBe(CHARSETS.hex);
    expect(/[一-鿿]/.test(poolFor('字', 'hex', CHARSETS.hex))).toBe(true);
  });

  it('picks glyphs of a similar width', () => {
    const widths: Record<string, number> = { i: 3, l: 3, j: 3, t: 4, f: 4, m: 12, w: 11, a: 7, e: 7 };
    const measure = (ch: string): number => widths[ch] ?? 7;
    // Only 3 glyphs within ±25% of 'i': falls back to the 6 closest (narrow ones first).
    expect(widthMatched('ilmjtfwae', 'i', measure)).toBe('iljtfa');
    expect(widthMatched('ilmjtfwae', 'm', measure)).not.toContain('i');
    expect(widthMatched('abc', 'a', () => 0)).toBe('abc'); // nothing measurable: whole pool
  });
});

describe('<ane-decrypt-text>', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
  });
  afterEach(() => {
    document.body.innerHTML = '';
    vi.useRealTimers();
  });
  const mount = (attrs: Record<string, string> = {}, text = ''): DecryptTextElement => {
    const el = document.createElement('ane-decrypt-text');
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    el.textContent = text;
    document.body.append(el);
    return el;
  };
  const visible = (el: DecryptTextElement): string =>
    [...el.shadowRoot!.querySelectorAll<HTMLElement>('.c')]
      .map((c) => (c.dataset.s === 'done' || c.dataset.s === 'flash' ? c.querySelector('.f')!.textContent : c.querySelector('.g')!.textContent))
      .join('');

  it('exposes the final text to assistive technology from the start', () => {
    const el = mount({ trigger: 'manual' }, 'Hello world');
    expect(el.getAttribute('aria-label')).toBe('Hello world');
    expect(el.shadowRoot!.querySelector('.text')!.getAttribute('aria-hidden')).toBe('true');
    expect(el.shadowRoot!.querySelector('.sr')!.textContent).toBe('Hello world');
  });

  it('scrambles then resolves to the text and fires ane-decrypt-done', () => {
    const el = mount({ trigger: 'manual', stagger: '200', scramble: '300' }, 'Hi there');
    const done = vi.fn();
    el.addEventListener('ane-decrypt-done', done);
    el.decode();
    vi.advanceTimersByTime(120);
    expect(el.decoding).toBe(true);
    expect(visible(el)).not.toBe('Hithere');
    vi.advanceTimersByTime(1500);
    expect(el.decoding).toBe(false);
    expect(visible(el)).toBe('Hithere');
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('keeps each word on one line and spaces as text', () => {
    const el = mount({ trigger: 'manual' }, 'ab cd');
    expect(el.shadowRoot!.querySelectorAll('.w')).toHaveLength(2);
    expect(el.shadowRoot!.querySelectorAll('.c')).toHaveLength(4);
  });

  it('morphs to a new text and drops leftover cells', () => {
    const el = mount({ trigger: 'manual', stagger: '100', scramble: '100' }, 'remember.');
    el.decode();
    vi.advanceTimersByTime(1500);
    el.text = 'react.';
    expect(el.getAttribute('aria-label')).toBe('react.');
    vi.advanceTimersByTime(1500);
    expect(visible(el)).toBe('react.');
    expect(el.shadowRoot!.querySelectorAll('.c')).toHaveLength(6);
  });

  it('is deterministic for a seed', () => {
    const a = mount({ trigger: 'manual', seed: '4', charset: 'hex' }, 'ABCDEF');
    const b = mount({ trigger: 'manual', seed: '4', charset: 'hex' }, 'ABCDEF');
    a.decode();
    b.decode();
    vi.advanceTimersByTime(100);
    expect(visible(a)).toBe(visible(b));
  });

  it('skips scrambling in reduced motion', () => {
    const el = mount({ trigger: 'manual', motion: 'reduce' }, 'Calm');
    const done = vi.fn();
    el.addEventListener('ane-decrypt-done', done);
    el.decode();
    expect(visible(el)).toBe('Calm');
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('finishes at once when scrolled away mid-decode, or when started and left off-screen', async () => {
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
    const el = mount({ trigger: 'manual', stagger: '2000', scramble: '2000' }, 'Long decode');
    const done = vi.fn();
    el.addEventListener('ane-decrypt-done', done);
    el.decode();
    vi.advanceTimersByTime(100);
    expect(el.decoding).toBe(true);
    fire!(false); // scrolled away
    expect(el.decoding).toBe(false);
    expect(done).toHaveBeenCalledTimes(1);
    expect(visible(el)).toBe('Longdecode');
    // Starting while hidden waits briefly for a scroll, then gives up and finishes.
    el.text = 'Next';
    expect(el.decoding).toBe(true);
    await new Promise((r) => setTimeout(r, 350));
    expect(el.decoding).toBe(false);
    expect(done).toHaveBeenCalledTimes(2);
    vi.unstubAllGlobals();
  });

  it('re-decodes on hover with trigger="hover" and cleans up', () => {
    const el = mount({ trigger: 'hover', stagger: '50', scramble: '50' }, 'Menu');
    vi.advanceTimersByTime(1000);
    el.dispatchEvent(new Event('pointerenter'));
    expect(el.decoding).toBe(true);
    vi.advanceTimersByTime(1000);
    el.remove();
    expect(getTickerStats().subscribers).toBe(0);
  });
});
