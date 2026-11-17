import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getTickerStats } from '../../core/ticker';
import { AURORA_PALETTES, AuroraElement, parseColor } from './index';

describe('parseColor', () => {
  it('parses hex and rgb() colours and falls back otherwise', () => {
    expect(parseColor('#ff0000', [0, 0, 0])).toEqual([1, 0, 0]);
    expect(parseColor('#0f0', [0, 0, 0])).toEqual([0, 1, 0]);
    expect(parseColor('rgb(0, 0, 255)', [0, 0, 0])).toEqual([0, 0, 1]);
    expect(parseColor('rgba(255 255 255 / .5)', [0, 0, 0])).toEqual([1, 1, 1]);
    expect(parseColor('papayawhip', [0.1, 0.2, 0.3])).toEqual([0.1, 0.2, 0.3]);
    expect(parseColor(null, [0.1, 0.2, 0.3])).toEqual([0.1, 0.2, 0.3]);
  });
});

describe('<ane-aurora>', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
  });
  afterEach(() => {
    document.body.innerHTML = '';
    vi.useRealTimers();
  });
  const mount = (attrs: Record<string, string> = {}): AuroraElement => {
    const el = document.createElement('ane-aurora');
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    el.innerHTML = '<h1>Hello</h1><a href="#start">Start</a>';
    document.body.append(el);
    return el;
  };

  it('keeps the slotted content as real DOM over a decorative background', () => {
    const el = mount();
    const root = el.shadowRoot!;
    expect(root.querySelector('slot')).not.toBeNull();
    expect(root.querySelector('canvas')!.getAttribute('aria-hidden')).toBe('true');
    expect(el.querySelector('a')!.textContent).toBe('Start');
  });

  it('falls back to CSS gradients without WebGL', () => {
    const el = mount();
    expect(el.webgl).toBe(false);
    expect(el.hasAttribute('data-fallback')).toBe(true);
  });

  it('exposes the palette and its colours as custom properties', () => {
    const el = mount({ palette: 'ember' });
    expect(el.palette).toBe('ember');
    expect(el.style.getPropertyValue('--_low')).toBe(AURORA_PALETTES.ember.low);
    el.setAttribute('color', '#123456');
    expect(el.style.getPropertyValue('--_low')).toBe('#123456');
    el.setAttribute('palette', 'nonsense');
    expect(el.palette).toBe('borealis');
  });

  it('clamps the grain amount', () => {
    const el = mount({ grain: '3' });
    expect(el.style.getPropertyValue('--_grain')).toBe('1');
  });

  it('animates without errors and cleans up when removed', () => {
    const errors = vi.spyOn(console, 'error');
    const el = mount({ interactive: '' });
    el.dispatchEvent(new PointerEvent('pointermove', { clientX: 10, clientY: 10 }));
    vi.advanceTimersByTime(500);
    expect(errors).not.toHaveBeenCalled();
    el.remove();
    expect(getTickerStats().subscribers).toBe(0);
  });
});
