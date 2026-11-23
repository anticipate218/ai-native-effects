import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getTickerStats } from '../../core/ticker';
import { bayer4, bayer8, DITHER_PALETTES, DitherGradientElement, hexToRgb, parseColors } from './index';

describe('helpers', () => {
  it('parses hex colours and colour lists', () => {
    expect(hexToRgb('#ff0000')).toEqual([1, 0, 0]);
    expect(hexToRgb('0f0')).toEqual([0, 1, 0]);
    expect(hexToRgb('nope')).toBeNull();
    expect(parseColors('#000, #fff  nope #123456', 6)).toHaveLength(3);
    expect(parseColors('#000,#111,#222', 2)).toHaveLength(2);
    expect(parseColors(null, 4)).toEqual([]);
  });

  it('builds proper Bayer matrices (each threshold exactly once)', () => {
    const b4 = new Set<number>();
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) b4.add(bayer4(x, y));
    expect([...b4].sort((a, b) => a - b)).toEqual(Array.from({ length: 16 }, (_, i) => i));
    const b8 = new Set<number>();
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) b8.add(bayer8(x, y));
    expect(b8.size).toBe(64);
    expect(Math.max(...b8)).toBe(63);
    // Ordered dither: neighbours differ a lot (no clumping).
    expect(Math.abs(bayer4(0, 0) - bayer4(1, 0))).toBeGreaterThanOrEqual(4);
    expect(bayer8(8, 8)).toBe(bayer8(0, 0)); // tiles
  });

  it('ships sensible palette presets', () => {
    for (const p of Object.values(DITHER_PALETTES)) {
      expect(p.length).toBeGreaterThanOrEqual(2);
      expect(p.length).toBeLessThanOrEqual(8);
      expect(p.every((h) => hexToRgb(h))).toBe(true);
    }
  });
});

describe('<ane-dither-gradient>', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
  });
  afterEach(() => {
    document.body.innerHTML = '';
    vi.useRealTimers();
  });

  it('resolves stops and palettes (auto, presets, custom, invalid)', () => {
    document.body.innerHTML = '<ane-dither-gradient colors="#000000,#ffffff"></ane-dither-gradient>';
    const el = document.querySelector('ane-dither-gradient')!;
    expect(el).toBeInstanceOf(DitherGradientElement);
    expect(el.stops).toEqual([[0, 0, 0], [1, 1, 1]]);
    expect(el.palette).toEqual(el.stops); // auto
    el.setAttribute('palette', 'gameboy');
    expect(el.palette).toHaveLength(4);
    el.setAttribute('palette', '#ff0000 #00ff00 #0000ff');
    expect(el.palette).toHaveLength(3);
    el.setAttribute('palette', 'not-a-palette');
    expect(el.palette).toEqual(el.stops);
    el.setAttribute('colors', 'junk');
    expect(el.stops).toHaveLength(4); // default gradient
  });

  it('shows a CSS gradient fallback without WebGL', () => {
    document.body.innerHTML = '<ane-dither-gradient colors="#000000,#ffffff"></ane-dither-gradient>';
    const el = document.querySelector('ane-dither-gradient')!;
    expect(el.webgl).toBe(false);
    expect(el.style.getPropertyValue('--_fallback')).toContain('linear-gradient');
  });

  it('freezes time under reduced motion and cleans up', () => {
    const errors = vi.spyOn(console, 'error');
    document.body.innerHTML = '<ane-dither-gradient motion="reduce"></ane-dither-gradient>';
    const el = document.querySelector('ane-dither-gradient')!;
    const t = el.time;
    vi.advanceTimersByTime(800);
    expect(el.time).toBe(t);
    expect(errors).not.toHaveBeenCalled();
    el.remove();
    expect(getTickerStats().subscribers).toBe(0);
  });
});
