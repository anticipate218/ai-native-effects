import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getTickerStats } from '../../core/ticker';
import { MagnetDockElement, magnifyAt, springStep } from './index';

describe('helpers', () => {
  it('magnifies with a cosine-squared falloff', () => {
    expect(magnifyAt(0, 100, 2)).toBe(2);
    expect(magnifyAt(50, 100, 2)).toBeCloseTo(1.5, 5);
    expect(magnifyAt(-50, 100, 2)).toBeCloseTo(1.5, 5);
    expect(magnifyAt(100, 100, 2)).toBeCloseTo(1, 10);
    expect(magnifyAt(400, 100, 2)).toBeCloseTo(1, 10);
    expect(magnifyAt(10, 0, 2)).toBe(1);
  });

  it('springs settle on the target with a slight overshoot', () => {
    let x = 1;
    let v = 0;
    let peak = 1;
    for (let i = 0; i < 120; i++) {
      [x, v] = springStep(x, v, 2, 16);
      peak = Math.max(peak, x);
    }
    expect(x).toBeCloseTo(2, 3);
    expect(peak).toBeGreaterThan(2.01); // overshoots…
    expect(peak).toBeLessThan(2.2); // …but only a little
  });

  it('clamps huge frame gaps so springs never explode', () => {
    const [x] = springStep(0, 0, 1, 5000);
    expect(Number.isFinite(x)).toBe(true);
    expect(Math.abs(x)).toBeLessThan(2);
  });
});

describe('<ane-magnet-dock>', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.useRealTimers();
  });

  const mount = (attrs = ''): MagnetDockElement => {
    document.body.innerHTML = `<ane-magnet-dock ${attrs}><button aria-label="One"></button><button aria-label="Two" data-active></button><a href="#" aria-label="Three"></a></ane-magnet-dock>`;
    return document.querySelector('ane-magnet-dock')!;
  };

  it('registers as a toolbar with a single tab stop', () => {
    const dock = mount();
    expect(dock).toBeInstanceOf(MagnetDockElement);
    expect(dock.getAttribute('role')).toBe('toolbar');
    expect(dock.items.map((el) => el.getAttribute('tabindex'))).toEqual(['0', '-1', '-1']);
  });

  it('moves focus with arrow keys, Home and End', () => {
    const dock = mount();
    const [one, two, three] = dock.items;
    one!.focus();
    one!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(document.activeElement).toBe(two);
    expect(two!.getAttribute('tabindex')).toBe('0');
    expect(one!.getAttribute('tabindex')).toBe('-1');
    two!.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    expect(document.activeElement).toBe(three);
    three!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(document.activeElement).toBe(one); // wraps
    one!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(document.activeElement).toBe(three);
  });

  it('shows activity dots for data-active items', async () => {
    const dock = mount();
    const dots = () => [...dock.shadowRoot!.querySelectorAll<HTMLElement>('.dot')].map((d) => !d.hidden);
    expect(dots()).toEqual([false, true, false]);
    dock.items[0]!.setAttribute('data-active', '');
    await Promise.resolve(); // MutationObserver
    expect(dots()).toEqual([true, true, false]);
  });

  it('fires ane-dock-launch on click and via launch()', () => {
    const dock = mount();
    const seen: Element[] = [];
    dock.addEventListener('ane-dock-launch', (e) => seen.push(e.detail.item));
    dock.items[1]!.click();
    dock.launch(dock.items[2]!);
    dock.launch(document.body); // not an item: ignored
    expect(seen).toEqual([dock.items[1], dock.items[2]]);
  });

  it('picks up items added later', async () => {
    const dock = mount();
    const extra = document.createElement('button');
    extra.setAttribute('aria-label', 'Four');
    dock.append(extra);
    await vi.waitFor(() => expect(dock.items).toHaveLength(4));
    expect(extra.getAttribute('tabindex')).toBe('-1');
  });

  it('mirrors gap, tint and accent into custom properties', () => {
    const dock = mount('gap="4px" tint="rgba(0,0,0,.3)" accent="#ff0"');
    expect(dock.style.getPropertyValue('--ane-dock-gap')).toBe('4px');
    expect(dock.style.getPropertyValue('--ane-dock-tint')).toBe('rgba(0,0,0,.3)');
    expect(dock.style.getPropertyValue('--ane-dock-accent')).toBe('#ff0');
    dock.removeAttribute('gap');
    expect(dock.style.getPropertyValue('--ane-dock-gap')).toBe('');
  });

  it('animates without errors and cleans up when removed', () => {
    const errors = vi.spyOn(console, 'error');
    const dock = mount();
    dock.items[0]!.dispatchEvent(new PointerEvent('pointermove', { clientX: 10, bubbles: true, composed: true }));
    dock.items[0]!.click();
    vi.advanceTimersByTime(1000);
    expect(errors).not.toHaveBeenCalled();
    dock.remove();
    expect(getTickerStats().subscribers).toBe(0);
  });
});
