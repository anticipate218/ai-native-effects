import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getTickerStats } from '../../core/ticker';
import { anticipation, HoldButtonElement, waveFront } from './index';

describe('helpers', () => {
  it('builds a rippling fill front that is empty at 0 and full at 1', () => {
    expect(waveFront(0, 0)).toBe('polygon(0% 0%, 0% 0%, 0% 100%, 0% 100%)');
    expect(waveFront(1, 0)).toBe('polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)');
    const mid = waveFront(0.5, 0.3);
    const xs = [...mid.matchAll(/([\d.-]+)% ([\d.]+)%/g)].slice(1, -1).map((m) => Number(m[1]));
    expect(Math.min(...xs)).toBeGreaterThan(47);
    expect(Math.max(...xs)).toBeLessThan(53);
    expect(new Set(xs).size).toBeGreaterThan(3); // it ripples
    expect(waveFront(0.5, 0.3, 0)).not.toBe(mid); // amplitude 0: a straight front
  });

  it('only shakes in the last stretch', () => {
    expect(anticipation(0.3)).toBe(0);
    expect(anticipation(0.6)).toBe(0);
    expect(anticipation(0.8)).toBeGreaterThan(0);
    expect(anticipation(1)).toBeCloseTo(1.6);
  });
});

describe('<ane-hold-button>', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
  });
  afterEach(() => {
    document.body.innerHTML = '';
    vi.useRealTimers();
  });

  const mount = (attrs = 'duration="1000"'): HoldButtonElement => {
    document.body.innerHTML = `<ane-hold-button ${attrs}>Hold to delete</ane-hold-button>`;
    return document.querySelector('ane-hold-button')!;
  };
  const down = (el: Element, id = 1): boolean => el.dispatchEvent(new PointerEvent('pointerdown', { pointerId: id, button: 0, bubbles: true }));
  const up = (el: Element, id = 1): boolean => el.dispatchEvent(new PointerEvent('pointerup', { pointerId: id, button: 0, bubbles: true }));

  it('is a focusable button with a hold hint', () => {
    const el = mount();
    expect(el).toBeInstanceOf(HoldButtonElement);
    expect(el.getAttribute('role')).toBe('button');
    expect(el.tabIndex).toBe(0);
    expect(el.getAttribute('aria-description')).toMatch(/hold/i);
  });

  it('completes after the hold duration and fires start/complete', () => {
    const el = mount();
    const events: string[] = [];
    for (const n of ['ane-hold-start', 'ane-hold-cancel', 'ane-hold-complete']) el.addEventListener(n, () => events.push(n));
    down(el);
    vi.advanceTimersByTime(600);
    expect(el.progress).toBeGreaterThan(0.4);
    expect(el.confirmed).toBe(false);
    vi.advanceTimersByTime(600);
    expect(el.confirmed).toBe(true);
    up(el);
    expect(events).toEqual(['ane-hold-start', 'ane-hold-complete']);
  });

  it('drains back and fires cancel when released early', () => {
    const el = mount();
    const cancels: number[] = [];
    el.addEventListener('ane-hold-cancel', (e) => cancels.push(e.detail.progress));
    down(el);
    vi.advanceTimersByTime(400);
    up(el);
    expect(cancels).toHaveLength(1);
    expect(cancels[0]).toBeGreaterThan(0.25);
    vi.advanceTimersByTime(1000);
    expect(el.progress).toBe(0);
    expect(el.confirmed).toBe(false);
  });

  it('works from the keyboard (hold Space) and ignores auto-repeat', () => {
    const el = mount();
    el.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    vi.advanceTimersByTime(500);
    el.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', repeat: true, bubbles: true }));
    vi.advanceTimersByTime(700);
    expect(el.confirmed).toBe(true);
    el.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', bubbles: true }));
  });

  it('resets after reset-after, or stays confirmed with 0', () => {
    const el = mount('duration="500" reset-after="800"');
    down(el);
    vi.advanceTimersByTime(700);
    up(el);
    expect(el.confirmed).toBe(true);
    vi.advanceTimersByTime(1000);
    expect(el.confirmed).toBe(false);

    const stay = mount('duration="500" reset-after="0"');
    down(stay);
    vi.advanceTimersByTime(700);
    up(stay);
    vi.advanceTimersByTime(5000);
    expect(stay.confirmed).toBe(true);
    stay.reset();
    expect(stay.confirmed).toBe(false);
  });

  it('does nothing while disabled', () => {
    const el = mount('duration="500" disabled');
    expect(el.getAttribute('aria-disabled')).toBe('true');
    expect(el.tabIndex).toBe(-1);
    down(el);
    vi.advanceTimersByTime(1000);
    expect(el.progress).toBe(0);
  });

  it('animates without errors and cleans up when removed', () => {
    const errors = vi.spyOn(console, 'error');
    const el = mount('duration="300"');
    down(el);
    vi.advanceTimersByTime(800);
    up(el);
    expect(errors).not.toHaveBeenCalled();
    el.remove();
    expect(getTickerStats().subscribers).toBe(0);
  });
});
