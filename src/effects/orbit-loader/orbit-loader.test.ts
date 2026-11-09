import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getTickerStats } from '../../core/ticker';
import { generateLand, OrbitLoaderElement } from './index';

const mount = (attrs: Record<string, string> = {}): OrbitLoaderElement => {
  const el = document.createElement('ane-orbit-loader');
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
  document.body.append(el);
  return el;
};
const bar = (el: OrbitLoaderElement): HTMLElement => el.shadowRoot!.querySelector('[role="progressbar"]')!;

describe('<ane-orbit-loader>', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.useRealTimers();
  });

  it('registers and exposes a named progressbar', () => {
    const el = mount();
    expect(el).toBeInstanceOf(OrbitLoaderElement);
    expect(bar(el).getAttribute('aria-label')).toBe('Loading data');
    expect(bar(el).getAttribute('aria-valuemin')).toBe('0');
    expect(bar(el).getAttribute('aria-valuemax')).toBe('100');
    expect(el.shadowRoot!.querySelector('canvas')!.getAttribute('aria-hidden')).toBe('true');
  });

  it('is indeterminate without a progress attribute', () => {
    const el = mount();
    expect(el.progress).toBeNull();
    expect(bar(el).hasAttribute('aria-valuenow')).toBe(false);
    expect(bar(el).getAttribute('aria-valuetext')).toBe('Loading');
  });

  it('parses fractions and percentages, clamping to 0..1', () => {
    const el = mount({ progress: '0.42' });
    expect(el.progress).toBe(0.42);
    expect(bar(el).getAttribute('aria-valuenow')).toBe('42');
    expect(bar(el).getAttribute('aria-valuetext')).toBe('42%');
    el.setAttribute('progress', '75%');
    expect(el.progress).toBe(0.75);
    el.setAttribute('progress', '3');
    expect(el.progress).toBe(1);
    el.setAttribute('progress', '-1');
    expect(el.progress).toBe(0);
    el.setAttribute('progress', 'soon');
    expect(el.progress).toBeNull();
  });

  it('reflects the progress property and returns to indeterminate on null', () => {
    const el = mount();
    el.progress = 0.5;
    expect(el.getAttribute('progress')).toBe('0.5');
    el.progress = null;
    expect(el.hasAttribute('progress')).toBe(false);
    expect(bar(el).hasAttribute('aria-valuenow')).toBe(false);
  });

  it('fires ane-complete once when progress reaches 100%', () => {
    const el = mount({ progress: '0.2' });
    const done = vi.fn();
    el.addEventListener('ane-complete', done);
    el.progress = 1;
    vi.advanceTimersByTime(3000);
    expect(done).toHaveBeenCalledTimes(1);
    expect(bar(el).getAttribute('aria-valuetext')).toBe('Complete');
    vi.advanceTimersByTime(1000);
    expect(done).toHaveBeenCalledTimes(1);
    // Starting a new job re-arms the event.
    el.progress = 0.1;
    vi.advanceTimersByTime(500);
    el.progress = 1;
    vi.advanceTimersByTime(3000);
    expect(done).toHaveBeenCalledTimes(2);
  });

  it('does not complete while in the failed state', () => {
    const el = mount({ progress: '1', error: '' });
    const done = vi.fn();
    el.addEventListener('ane-complete', done);
    vi.advanceTimersByTime(1000);
    expect(done).not.toHaveBeenCalled();
    expect(bar(el).getAttribute('aria-valuetext')).toBe('Failed');
    el.error = false;
    expect(el.hasAttribute('error')).toBe(false);
  });

  it('shows the percentage only through the eased value', () => {
    const el = mount({ 'show-value': '', progress: '0.5', motion: 'reduce' });
    vi.advanceTimersByTime(100);
    expect(el.shadowRoot!.querySelector('.value')!.textContent).toBe('50%');
  });

  it('clamps the satellite count and honours the label', () => {
    const el = mount({ satellites: '12', label: 'Downloading tiles' });
    expect(el.satellites).toBe(6);
    el.satellites = 0;
    expect(el.satellites).toBe(1);
    expect(bar(el).getAttribute('aria-label')).toBe('Downloading tiles');
  });

  it('generates a deterministic, partial land mask from the seed', () => {
    const a = generateLand(7);
    const b = generateLand(7);
    const c = generateLand(8);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
    const share = a.length / 3 / 1500;
    expect(share).toBeGreaterThan(0.1);
    expect(share).toBeLessThan(0.6);
    for (let i = 0; i < a.length; i += 3) expect(Math.hypot(a[i]!, a[i + 1]!, a[i + 2]!)).toBeCloseTo(1, 5);
  });

  it('animates without errors and cleans up when removed', () => {
    const errors = vi.spyOn(console, 'error');
    const el = mount({ progress: '0.3', satellites: '4' });
    vi.advanceTimersByTime(500);
    expect(errors).not.toHaveBeenCalled();
    el.remove();
    expect(getTickerStats().subscribers).toBe(0);
  });
});
