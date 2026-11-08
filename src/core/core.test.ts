import { afterEach, describe, expect, it, vi } from 'vitest';
import { clamp, createRandom, damp, easeOutBack, hump, lerp, parseNumber } from './math';
import { resolveReducedMotion } from './motion';
import { getTickerStats, MAX_DELTA_MS, resetTickerStats, subscribe } from './ticker';

describe('math', () => {
  it('clamps and interpolates', () => {
    expect(clamp(5, 0, 1)).toBe(1);
    expect(clamp(-5, 0, 1)).toBe(0);
    expect(lerp(10, 20, 0.25)).toBe(12.5);
  });

  it('damps frame-rate independently', () => {
    // One 32ms step lands where two 16ms steps do.
    const once = damp(0, 1, 8, 32);
    const twice = damp(damp(0, 1, 8, 16), 1, 8, 16);
    expect(once).toBeCloseTo(twice, 10);
    expect(damp(0, 1, 8, 0)).toBe(0);
  });

  it('eases with overshoot and humps', () => {
    expect(easeOutBack(0)).toBeCloseTo(0);
    expect(easeOutBack(1)).toBeCloseTo(1);
    expect(Math.max(...[0.6, 0.7, 0.8, 0.9].map((t) => easeOutBack(t)))).toBeGreaterThan(1);
    expect(hump(0.5)).toBeCloseTo(1);
    expect(hump(0)).toBe(0);
    expect(hump(1.2)).toBe(0);
  });

  it('produces deterministic seeded randomness', () => {
    const a = createRandom(42);
    const b = createRandom(42);
    const seqA = [a(), a(), a()];
    expect(seqA).toEqual([b(), b(), b()]);
    expect(seqA.every((n) => n >= 0 && n < 1)).toBe(true);
    expect(createRandom(43)()).not.toBe(seqA[0]);
  });

  it('parses numeric attributes defensively', () => {
    expect(parseNumber(null, 1)).toBe(1);
    expect(parseNumber('', 1)).toBe(1);
    expect(parseNumber('abc', 1)).toBe(1);
    expect(parseNumber('2.5', 1, 0, 5)).toBe(2.5);
    expect(parseNumber('99', 1, 0, 5)).toBe(5);
    expect(parseNumber('-3', 1, 0, 5)).toBe(0);
  });
});

describe('motion', () => {
  it('honours explicit motion preferences', () => {
    expect(resolveReducedMotion('reduce')).toBe(true);
    expect(resolveReducedMotion('full')).toBe(false);
  });

  it('follows the OS setting in auto mode', () => {
    const spy = vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList);
    expect(resolveReducedMotion(null)).toBe(true);
    expect(resolveReducedMotion('auto')).toBe(true);
    spy.mockReturnValue({ matches: false } as MediaQueryList);
    expect(resolveReducedMotion('auto')).toBe(false);
  });
});

describe('ticker', () => {
  afterEach(() => {
    vi.useRealTimers();
    resetTickerStats();
  });

  it('runs one shared loop and stops when the last subscriber leaves', () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
    const a = vi.fn();
    const b = vi.fn();
    const stopA = subscribe(a);
    const stopB = subscribe(b);
    vi.advanceTimersByTime(100);
    expect(a.mock.calls.length).toBeGreaterThanOrEqual(5);
    expect(b.mock.calls.length).toBe(a.mock.calls.length);
    expect(getTickerStats().subscribers).toBe(2);

    stopA();
    stopB();
    const calls = b.mock.calls.length;
    vi.advanceTimersByTime(100);
    expect(b.mock.calls.length).toBe(calls);
    expect(getTickerStats().subscribers).toBe(0);
  });

  it('clamps long frame gaps', () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
    const deltas: number[] = [];
    const stop = subscribe((_now, delta) => deltas.push(delta));
    vi.advanceTimersByTime(50);
    expect(Math.max(...deltas)).toBeLessThanOrEqual(MAX_DELTA_MS);
    stop();
  });

  it('keeps running when one subscriber throws', () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const healthy = vi.fn();
    const stopBad = subscribe(() => {
      throw new Error('boom');
    });
    const stopGood = subscribe(healthy);
    vi.advanceTimersByTime(50);
    expect(healthy).toHaveBeenCalled();
    expect(error).toHaveBeenCalled();
    expect(getTickerStats().frames).toBeGreaterThan(0);
    stopBad();
    stopGood();
  });
});
