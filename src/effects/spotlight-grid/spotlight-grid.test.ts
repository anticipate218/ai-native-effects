import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getTickerStats } from '../../core/ticker';
import { distToRect, SpotlightGridElement, waveAt } from './index';

describe('helpers', () => {
  it('measures the distance from a point to a rectangle', () => {
    const r = { x: 10, y: 10, w: 100, h: 50 };
    expect(distToRect(50, 30, r)).toBe(0); // inside
    expect(distToRect(0, 30, r)).toBe(10); // left
    expect(distToRect(50, 70, r)).toBe(10); // below
    expect(distToRect(113, 64, r)).toBe(5); // corner (3-4-5)
  });

  it('lights a card as the wave front passes it and fades over its life', () => {
    expect(waveAt(200, 200, 0)).toBeCloseTo(1, 5);
    expect(waveAt(200, 400, 0)).toBeLessThan(0.01);
    expect(waveAt(200, 200, 0.5)).toBeLessThan(waveAt(200, 200, 0.1));
    expect(waveAt(200, 200, 1)).toBe(0);
    expect(waveAt(200, 200, -0.1)).toBe(0);
  });
});

describe('<ane-spotlight-grid>', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
  });
  afterEach(() => {
    document.body.innerHTML = '';
    vi.useRealTimers();
  });

  const mount = (attrs = ''): SpotlightGridElement => {
    document.body.innerHTML = `<ane-spotlight-grid ${attrs}><article tabindex="0">A</article><article tabindex="0">B</article><article>C</article></ane-spotlight-grid>`;
    const el = document.querySelector('ane-spotlight-grid')!;
    // happy-dom has no layout: give the host and cards a geometry.
    const rect = (x: number, y: number, w: number, h: number) => () => ({ left: x, top: y, width: w, height: h, right: x + w, bottom: y + h, x, y, toJSON() {} }) as DOMRect;
    el.getBoundingClientRect = rect(0, 0, 600, 300);
    el.cards.forEach((c, i) => (c.getBoundingClientRect = rect(i * 200, 0, 190, 300)));
    return el;
  };

  it('draws one border ring and one sheen per card', () => {
    const el = mount();
    expect(el).toBeInstanceOf(SpotlightGridElement);
    expect(el.cards).toHaveLength(3);
    expect(el.shadowRoot!.querySelectorAll('.ring')).toHaveLength(3);
    expect(el.shadowRoot!.querySelectorAll('.fill')).toHaveLength(3);
  });

  it('maps attributes to custom properties', () => {
    const el = mount('color="#ff0" accent="#0ff" radius="200px" border="3px" dot-gap="30px" sheen="2"');
    const v = (p: string): string => el.style.getPropertyValue(p);
    expect(v('--ane-spot-color')).toBe('#ff0');
    expect(v('--ane-spot-accent')).toBe('#0ff');
    expect(v('--ane-spot-radius')).toBe('200px');
    expect(v('--ane-spot-border')).toBe('3px');
    expect(v('--ane-spot-dot-gap')).toBe('30px');
    expect(v('--ane-spot-sheen')).toBe('1'); // clamped
    el.removeAttribute('color');
    expect(v('--ane-spot-color')).toBe('');
  });

  it('springs the light towards the pointer and brightens', () => {
    const el = mount('idle="off"');
    el.dispatchEvent(new PointerEvent('pointermove', { clientX: 500, clientY: 200, pointerType: 'mouse' }));
    vi.advanceTimersByTime(1500);
    expect(parseFloat(el.style.getPropertyValue('--x'))).toBeCloseTo(500, 0);
    expect(parseFloat(el.style.getPropertyValue('--y'))).toBeCloseTo(200, 0);
    expect(parseFloat(el.style.getPropertyValue('--i'))).toBeGreaterThan(0.95);
    el.dispatchEvent(new PointerEvent('pointerleave'));
    vi.advanceTimersByTime(2000);
    expect(parseFloat(el.style.getPropertyValue('--i'))).toBeLessThan(0.05);
  });

  it('moves the light to a focused card', () => {
    const el = mount('idle="off"');
    el.cards[1]!.focus();
    vi.advanceTimersByTime(1500);
    expect(parseFloat(el.style.getPropertyValue('--x'))).toBeCloseTo(295, 0); // centre of card B
  });

  it('runs a light wave through the cards, and none under reduced motion', () => {
    const el = mount('idle="off"');
    vi.advanceTimersByTime(50);
    el.pulse(0, 150);
    vi.advanceTimersByTime(150);
    const pulses = (): number[] => [...el.shadowRoot!.querySelectorAll<HTMLElement>('.ring')].map((r) => parseFloat(r.style.getPropertyValue('--pulse') || '0'));
    expect(Math.max(...pulses())).toBeGreaterThan(0.3);
    vi.advanceTimersByTime(3000);
    expect(Math.max(...pulses())).toBe(0);

    const still = mount('motion="reduce"');
    still.pulse();
    vi.advanceTimersByTime(200);
    expect([...still.shadowRoot!.querySelectorAll<HTMLElement>('.ring')].every((r) => !r.style.getPropertyValue('--pulse'))).toBe(true);
  });

  it('animates without errors and cleans up when removed', () => {
    const errors = vi.spyOn(console, 'error');
    const el = mount();
    vi.advanceTimersByTime(1000);
    expect(errors).not.toHaveBeenCalled();
    el.remove();
    expect(getTickerStats().subscribers).toBe(0);
  });
});
