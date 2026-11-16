import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getTickerStats } from '../../core/ticker';
import { buildDisplacementMap, DEFAULT_OPTICS, GlassLensElement, roundedRectSdf } from './index';

describe('optics', () => {
  it('computes a signed distance for rounded rectangles', () => {
    expect(roundedRectSdf(0, 0, 50, 20, 10)).toBeCloseTo(-20);
    expect(roundedRectSdf(60, 0, 50, 20, 10)).toBeCloseTo(10);
    expect(roundedRectSdf(50, 0, 50, 20, 10)).toBeCloseTo(0);
    // Corner: distance to the arc, not to the box corner.
    expect(roundedRectSdf(50, 20, 50, 20, 10)).toBeCloseTo(Math.SQRT2 * 10 - 10);
  });

  const map = (w: number, h: number, optics = DEFAULT_OPTICS): Uint8ClampedArray => {
    const out = new Uint8ClampedArray(w * h * 4);
    buildDisplacementMap({ width: w, height: h, radius: Math.min(w, h) / 2 }, optics, out);
    return out;
  };
  const px = (data: Uint8ClampedArray, w: number, x: number, y: number): number[] => [...data.slice((y * w + x) * 4, (y * w + x) * 4 + 4)];

  it('is neutral and transparent outside the lens', () => {
    const data = map(60, 40);
    expect(px(data, 60, 0, 0)).toEqual([128, 128, 0, 0]); // corner, outside the pill
  });

  it('magnifies the body: samples towards the centre', () => {
    const data = map(80, 80, { ...DEFAULT_OPTICS, bend: 0 });
    const [rLeft] = px(data, 80, 25, 40);
    const [rRight] = px(data, 80, 55, 40);
    const [, gTop] = px(data, 80, 40, 25);
    expect(rLeft!).toBeGreaterThan(128); // left of centre samples to the right
    expect(rRight!).toBeLessThan(128);
    expect(gTop!).toBeGreaterThan(128);
    expect(px(data, 80, 40, 40)[3]).toBe(255);
  });

  it('pulls content in from outside at the rim and lights the rim facing the light', () => {
    const data = map(80, 80, { ...DEFAULT_OPTICS, curvature: 0, lightAngle: 180 });
    const [rRim] = px(data, 80, 78, 40); // right rim: samples further right
    expect(rRim!).toBeGreaterThan(128);
    const specRight = px(data, 80, 79, 40)[2]!;
    const specLeft = px(data, 80, 0, 40)[2]!;
    expect(specRight).toBeGreaterThan(specLeft); // light from the right (180°)
  });
});

describe('<ane-glass-lens>', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.useRealTimers();
  });

  const mount = (attrs: Record<string, string> = {}, html = '<p>Hello <mark>world</mark></p>'): GlassLensElement => {
    const el = document.createElement('ane-glass-lens');
    for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
    el.innerHTML = html;
    document.body.append(el);
    return el;
  };

  it('keeps the content as real, slotted DOM with a decorative lens', () => {
    const el = mount();
    const root = el.shadowRoot!;
    expect(root.querySelector('slot')).not.toBeNull();
    expect(root.querySelector('.lens')!.getAttribute('aria-hidden')).toBe('true');
    expect(root.querySelector('filter')).not.toBeNull();
    expect(el.querySelector('mark')!.textContent).toBe('world');
  });

  it('defaults to follow mode and normalises unknown modes', () => {
    expect(mount().mode).toBe('follow');
    expect(mount({ mode: 'read' }).mode).toBe('read');
    expect(mount({ mode: 'nonsense' }).mode).toBe('follow');
  });

  it('shows the lens over an element with focusOn() and hides it with stop()', () => {
    const el = mount({ mode: 'static' });
    el.focusOn(el.querySelector('mark')!);
    vi.advanceTimersByTime(600);
    const lens = el.shadowRoot!.querySelector<HTMLElement>('.lens')!;
    expect(Number(lens.style.opacity)).toBeGreaterThan(0.9);
    el.stop();
    vi.advanceTimersByTime(800);
    expect(Number(lens.style.opacity)).toBeLessThan(0.1);
  });

  it('applies the accent colour as a custom property', () => {
    const el = mount({ accent: '#ff0066' });
    expect(el.style.getPropertyValue('--ane-lens-accent')).toBe('#ff0066');
  });

  it('runs a read pass without layout and cleans up when removed', () => {
    const errors = vi.spyOn(console, 'error');
    const el = mount({ mode: 'read' });
    el.read();
    vi.advanceTimersByTime(1500);
    expect(errors).not.toHaveBeenCalled();
    expect(el.found).toEqual([]);
    el.remove();
    expect(getTickerStats().subscribers).toBe(0);
  });
});
