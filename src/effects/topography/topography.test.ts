import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getTickerStats } from '../../core/ticker';
import { isIndexContour, resolveTopoColors, RIPPLE_LIFE, TOPO_THEMES, TopographyElement } from './index';
import { MAX_RIPPLES } from './topo-gl';

describe('helpers', () => {
  it('resolves theme colours with per-colour overrides', () => {
    expect(resolveTopoColors('night').background).toEqual(resolveTopoColors('night', {}).background);
    const paper = resolveTopoColors(null);
    expect(paper.background[0]).toBeGreaterThan(0.9); // light paper by default
    const custom = resolveTopoColors('night', { color: '#ff0000', accent: 'not-a-colour' });
    expect(custom.color).toEqual([1, 0, 0]);
    expect(custom.accent).toEqual(resolveTopoColors('night').accent); // invalid override falls back
    expect(resolveTopoColors('nope')).toEqual(paper); // unknown theme falls back to paper
    for (const t of Object.values(TOPO_THEMES)) expect(Object.keys(t)).toEqual(['background', 'color', 'accent']);
  });

  it('marks every Nth contour as an index contour', () => {
    expect([0, 1, 4, 5, 10, -5].map((k) => isIndexContour(k, 5))).toEqual([true, false, false, true, true, true]);
    expect(isIndexContour(5, 0)).toBe(false);
  });
});

describe('<ane-topography>', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
  });
  afterEach(() => {
    document.body.innerHTML = '';
    vi.useRealTimers();
  });

  const mount = (attrs = ''): TopographyElement => {
    document.body.innerHTML = `<ane-topography ${attrs} style="width:400px;height:240px"><h1>Hero</h1></ane-topography>`;
    return document.querySelector('ane-topography')!;
  };
  const at = (el: Element, type: string, x = 120, y = 80, pointerType = 'mouse'): boolean =>
    el.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, pointerType, buttons: type === 'pointerdown' ? 1 : 0, bubbles: true }));

  it('falls back to CSS without WebGL and keeps its content', () => {
    const el = mount('theme="night"');
    expect(el).toBeInstanceOf(TopographyElement);
    expect(el.webgl).toBe(false);
    expect(el.hasAttribute('data-gl')).toBe(false);
    expect(el.querySelector('h1')?.textContent).toBe('Hero');
    expect(el.style.getPropertyValue('--_bg')).toMatch(/^rgb\(/);
    expect(el.shadowRoot!.querySelector('canvas')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('raises a hill under the pointer and lets it sink when it leaves', () => {
    const el = mount();
    at(el, 'pointermove');
    vi.advanceTimersByTime(1500);
    expect(el.hill).toBeGreaterThan(0.9);
    el.dispatchEvent(new PointerEvent('pointerleave'));
    vi.advanceTimersByTime(4000);
    expect(el.hill).toBeLessThan(0.05);
  });

  it('ignores touch moves without contact, and relief="0" keeps the ground flat', () => {
    const el = mount();
    at(el, 'pointermove', 100, 100, 'touch');
    vi.advanceTimersByTime(800);
    expect(el.hill).toBe(0);
    const flat = mount('relief="0"');
    at(flat, 'pointermove');
    vi.advanceTimersByTime(800);
    expect(flat.hill).toBe(0);
  });

  it('sends ripples on click (capped, expiring) unless ripples="off"', () => {
    const el = mount();
    for (let i = 0; i < MAX_RIPPLES + 2; i++) at(el, 'pointerdown', 50 + i * 10, 60);
    expect(el.rippleCount).toBe(MAX_RIPPLES);
    vi.advanceTimersByTime(RIPPLE_LIFE * 1000 + 300);
    expect(el.rippleCount).toBe(0);
    el.ripple(10, 10);
    expect(el.rippleCount).toBe(1);

    const off = mount('ripples="off"');
    at(off, 'pointerdown');
    expect(off.rippleCount).toBe(0);
  });

  it('keeps interaction in real time when the drift is paused (speed="0")', () => {
    const el = mount('speed="0"');
    at(el, 'pointermove');
    at(el, 'pointerdown');
    vi.advanceTimersByTime(1500);
    expect(el.time).toBe(0);
    expect(el.hill).toBeGreaterThan(0.9);
    vi.advanceTimersByTime(RIPPLE_LIFE * 1000);
    expect(el.rippleCount).toBe(0);
  });

  it('freezes the terrain and drops ripples under reduced motion', () => {
    const el = mount('motion="reduce"');
    vi.advanceTimersByTime(500);
    const t = el.time;
    vi.advanceTimersByTime(2000);
    expect(el.time).toBe(t);
    el.ripple(20, 20);
    expect(el.rippleCount).toBe(0);
    at(el, 'pointermove');
    vi.advanceTimersByTime(50);
    expect(el.hill).toBe(1); // the hill still follows, without easing
  });

  it('updates the fallback colours with the theme and cleans up when removed', () => {
    const errors = vi.spyOn(console, 'error');
    const el = mount();
    const before = el.style.getPropertyValue('--_bg');
    el.setAttribute('theme', 'night');
    expect(el.style.getPropertyValue('--_bg')).not.toBe(before);
    el.setAttribute('color', '#00ff00');
    expect(el.colors.color).toEqual([0, 1, 0]);
    vi.advanceTimersByTime(500);
    expect(errors).not.toHaveBeenCalled();
    el.remove();
    expect(getTickerStats().subscribers).toBe(0);
  });
});
