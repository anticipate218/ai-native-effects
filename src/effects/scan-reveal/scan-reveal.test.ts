import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getTickerStats } from '../../core/ticker';
import { DEFAULT_CLASSES, parseClasses, ScanRevealElement, scanStatus } from './index';

describe('scan reveal helpers', () => {
  it('parses class legends and falls back to defaults', () => {
    expect(parseClasses('Water:#00f|Crops:rgb(1, 2, 3)')).toEqual([
      { name: 'Water', color: '#00f' },
      { name: 'Crops', color: 'rgb(1, 2, 3)' },
    ]);
    expect(parseClasses(null)).toEqual(DEFAULT_CLASSES);
    expect(parseClasses('nonsense')).toEqual(DEFAULT_CLASSES);
  });

  it('derives the phase and overall progress from both passes', () => {
    expect(scanStatus(0, 0, true)).toEqual({ phase: 'standby', value: 0 });
    expect(scanStatus(0.5, 0, true)).toEqual({ phase: 'acquiring', value: 0.25 });
    expect(scanStatus(0.5, 0, false)).toEqual({ phase: 'acquiring', value: 0.5 });
    expect(scanStatus(1, 0.5, true)).toEqual({ phase: 'analyzing', value: 0.75 });
    expect(scanStatus(1, 0, false)).toEqual({ phase: 'complete', value: 1 });
    expect(scanStatus(1, 1, true)).toEqual({ phase: 'complete', value: 1 });
  });
});

describe('<ane-scan-reveal>', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.useRealTimers();
  });

  const mount = (attrs: Record<string, string> = {}): ScanRevealElement => {
    const el = document.createElement('ane-scan-reveal');
    for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
    document.body.append(el);
    return el;
  };
  const $ = (el: ScanRevealElement, selector: string): HTMLElement => el.shadowRoot!.querySelector(selector)!;

  it('renders an described image and a progressbar, with the 2D fallback without WebGL', () => {
    const el = mount({ alt: 'Flooded fields' });
    expect(el.webgl).toBe(false);
    expect($(el, 'canvas').getAttribute('role')).toBe('img');
    expect($(el, 'canvas').getAttribute('aria-label')).toBe('Flooded fields');
    const meter = $(el, '[role="progressbar"]');
    vi.advanceTimersByTime(100);
    expect(meter.getAttribute('aria-valuemin')).toBe('0');
    expect(meter.getAttribute('aria-valuetext')).toMatch(/Acquiring|Standby/);
  });

  it('follows app-driven progress and fires ane-scan-complete once per pass', () => {
    const el = mount({ progress: '0.4', hud: '' });
    const done = vi.fn();
    el.addEventListener('ane-scan-complete', done);
    vi.advanceTimersByTime(1500);
    expect(el.phase).toBe('acquiring');
    expect($(el, '.phase').textContent).toBe('Acquiring');
    expect($(el, '.pct').textContent).toBe('40%');
    el.progress = 1;
    vi.advanceTimersByTime(1500);
    expect(el.phase).toBe('complete');
    expect(done).toHaveBeenCalledTimes(1);
    expect(done.mock.calls[0]![0].detail.pass).toBe('acquisition');
    vi.advanceTimersByTime(500);
    expect(done).toHaveBeenCalledTimes(1);
    expect($(el, '[role="progressbar"]').getAttribute('aria-valuetext')).toBe('Complete');
  });

  it('autoplays without progress and can replay', () => {
    const el = mount({ duration: '1000' });
    vi.advanceTimersByTime(300);
    expect(el.phase).toBe('acquiring');
    vi.advanceTimersByTime(1500);
    expect(el.phase).toBe('complete');
    el.replay();
    vi.advanceTimersByTime(50);
    expect(el.phase).toBe('acquiring');
  });

  it('shows the finished result at once in reduced-motion autoplay', () => {
    const el = mount({ motion: 'reduce' });
    vi.advanceTimersByTime(50);
    expect(el.phase).toBe('complete');
  });

  it('renders HUD labels and the legend from attributes', () => {
    const el = mount({ hud: '', caption: 'Sentinel-2B', detail: 'T31UFU', classes: 'Water:#00f|Crops:#0f0' });
    expect($(el, '.caption').textContent).toBe('Sentinel-2B');
    expect($(el, '.detail').textContent).toBe('T31UFU');
    expect([...el.shadowRoot!.querySelectorAll('.legend b')].map((b) => b.textContent)).toEqual(['Water', 'Crops']);
    el.setAttribute('caption', 'Landsat 9');
    expect($(el, '.caption').textContent).toBe('Landsat 9');
  });

  it('reflects progress and analysis, and returns to autoplay on null', () => {
    const el = mount();
    el.progress = 0.3;
    el.analysis = 2;
    expect(el.getAttribute('progress')).toBe('0.3');
    expect(el.getAttribute('analysis')).toBe('1');
    el.progress = null;
    expect(el.hasAttribute('progress')).toBe(false);
  });

  it('cleans up when removed', () => {
    const errors = vi.spyOn(console, 'error');
    const el = mount({ hud: '' });
    vi.advanceTimersByTime(500);
    expect(errors).not.toHaveBeenCalled();
    el.remove();
    expect(getTickerStats().subscribers).toBe(0);
  });
});
