import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getTickerStats } from '../../core/ticker';
import { GlassTabsElement, liquidStretch, nearestTab } from './index';

describe('helpers', () => {
  it('stretches along the motion and thins across it, more with speed', () => {
    expect(liquidStretch(0, 100, 1)).toEqual([0, 1]);
    const [slowW, slowH] = liquidStretch(500, 100, 1);
    const [fastW, fastH] = liquidStretch(2600, 100, 1);
    expect(fastW).toBeGreaterThan(slowW);
    expect(fastH).toBeLessThan(slowH);
    expect(liquidStretch(-2600, 100, 1)).toEqual(liquidStretch(2600, 100, 1)); // direction-free
    expect(liquidStretch(99999, 100, 1)[0]).toBeCloseTo(55); // capped
    expect(liquidStretch(2600, 100, 0)).toEqual([0, 1]); // stretch off
  });

  it('finds the nearest tab', () => {
    expect(nearestTab(10, [20, 80, 140])).toBe(0);
    expect(nearestTab(100, [20, 80, 140])).toBe(1);
    expect(nearestTab(999, [20, 80, 140])).toBe(2);
  });
});

describe('<ane-glass-tabs>', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
  });
  afterEach(() => {
    document.body.innerHTML = '';
    vi.useRealTimers();
  });

  const mount = (attrs = ''): GlassTabsElement => {
    document.body.innerHTML = `<ane-glass-tabs ${attrs}><button>Day</button><button>Week</button><button>Month</button></ane-glass-tabs>`;
    return document.querySelector('ane-glass-tabs')!;
  };

  it('applies the tablist pattern', () => {
    const el = mount('selected="1"');
    expect(el).toBeInstanceOf(GlassTabsElement);
    expect(el.getAttribute('role')).toBe('tablist');
    expect(el.tabs.map((t) => t.getAttribute('role'))).toEqual(['tab', 'tab', 'tab']);
    expect(el.tabs.map((t) => t.getAttribute('aria-selected'))).toEqual(['false', 'true', 'false']);
    expect(el.tabs.map((t) => t.getAttribute('tabindex'))).toEqual(['-1', '0', '-1']);
  });

  it('reports the selected index before the slot has updated', () => {
    const el = document.createElement('ane-glass-tabs') as GlassTabsElement;
    el.setAttribute('selected', '1');
    el.innerHTML = '<button>A</button><button>B</button>';
    document.body.append(el);
    expect(el.selected).toBe(1);
  });

  it('clamps the selected index', () => {
    const el = mount('selected="9"');
    expect(el.selected).toBe(2);
    el.selected = -3;
    expect(el.selected).toBe(0);
  });

  it('selects on click and fires ane-tab-change once per change', () => {
    const el = mount();
    const seen: number[] = [];
    el.addEventListener('ane-tab-change', (e) => seen.push(e.detail.index));
    el.tabs[2]!.click();
    el.tabs[2]!.click();
    el.tabs[0]!.click();
    expect(seen).toEqual([2, 0]);
    expect(el.getAttribute('selected')).toBe('0');
  });

  it('moves selection with arrow keys, Home and End (wrapping)', () => {
    const el = mount();
    el.tabs[0]!.focus();
    const key = (k: string): void => void document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
    key('ArrowRight');
    expect(el.selected).toBe(1);
    expect(document.activeElement).toBe(el.tabs[1]);
    key('End');
    expect(el.selected).toBe(2);
    key('ArrowRight');
    expect(el.selected).toBe(0);
    key('ArrowLeft');
    expect(el.selected).toBe(2);
    key('Home');
    expect(el.selected).toBe(0);
  });

  it('setting selected from code does not fire the user event', () => {
    const el = mount();
    const spy = vi.fn();
    el.addEventListener('ane-tab-change', spy);
    el.selected = 2;
    expect(spy).not.toHaveBeenCalled();
    expect(el.tabs[2]!.getAttribute('aria-selected')).toBe('true');
  });

  it('maps colours to custom properties, animates and cleans up', () => {
    const errors = vi.spyOn(console, 'error');
    const el = mount('accent="#ff0" tint="rgba(0,0,0,.2)"');
    expect(el.style.getPropertyValue('--ane-glass-accent')).toBe('#ff0');
    expect(el.style.getPropertyValue('--ane-glass-tint')).toBe('rgba(0,0,0,.2)');
    vi.advanceTimersByTime(500);
    expect(errors).not.toHaveBeenCalled();
    el.remove();
    expect(getTickerStats().subscribers).toBe(0);
  });
});
