import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getTickerStats } from '../../core/ticker';
import { ImageRevealElement, stepAt } from './index';

describe('stepAt', () => {
  it('maps progress to a sampler step and the fraction within it', () => {
    expect(stepAt(0, 30)).toEqual({ step: 0, frac: 0 });
    expect(stepAt(0.5, 30)).toEqual({ step: 15, frac: 0 });
    const mid = stepAt(0.51, 30);
    expect(mid.step).toBe(15);
    expect(mid.frac).toBeCloseTo(0.3);
    expect(stepAt(1, 30)).toEqual({ step: 30, frac: 0 });
    expect(stepAt(2, 30).step).toBe(30);
    expect(stepAt(0.5, 0).step).toBe(0); // at least one step
  });
});

describe('<ane-image-reveal>', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.useRealTimers();
  });

  const mount = (attrs: Record<string, string> = {}): ImageRevealElement => {
    const el = document.createElement('ane-image-reveal');
    for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
    document.body.append(el);
    return el;
  };
  const $ = (el: ImageRevealElement, selector: string): HTMLElement => el.shadowRoot!.querySelector(selector)!;

  it('renders a described image and a step progressbar (2D fallback without WebGL)', () => {
    const el = mount({ alt: 'A generated harbour at dusk', steps: '20', progress: '0.5' });
    expect(el.webgl).toBe(false);
    expect($(el, 'canvas').getAttribute('aria-label')).toBe('A generated harbour at dusk');
    vi.advanceTimersByTime(800);
    const meter = $(el, '[role="progressbar"]');
    expect(meter.getAttribute('aria-valuemax')).toBe('20');
    expect(meter.getAttribute('aria-valuenow')).toBe('10');
    expect(meter.getAttribute('aria-valuetext')).toBe('Step 10 of 20');
  });

  it('shows the prompt, seed and step counter in the HUD', () => {
    const el = mount({ hud: '', caption: 'A lighthouse in fog', seed: '42', steps: '25', progress: '0.4' });
    vi.advanceTimersByTime(800);
    expect($(el, '.prompt').textContent).toBe('A lighthouse in fog');
    expect($(el, '.seed').textContent).toBe('seed 42');
    expect($(el, '.counter').textContent).toBe('Step 10 / 25');
  });

  it('autoplays to completion, fires ane-reveal-complete once and can replay', () => {
    const el = mount({ duration: '1000' });
    const done = vi.fn();
    el.addEventListener('ane-reveal-complete', done);
    vi.advanceTimersByTime(400);
    expect(el.dataset.phase).toBe('denoising');
    vi.advanceTimersByTime(900);
    expect(el.dataset.phase).toBe('done');
    expect(done).toHaveBeenCalledTimes(1);
    expect(done.mock.calls[0]![0].detail).toEqual({ steps: 30 });
    vi.advanceTimersByTime(500);
    expect(done).toHaveBeenCalledTimes(1);
    el.replay();
    vi.advanceTimersByTime(50);
    expect(el.step).toBeLessThan(30);
  });

  it('jumps to the result in reduced-motion autoplay', () => {
    const el = mount({ motion: 'reduce' });
    vi.advanceTimersByTime(50);
    expect(el.step).toBe(30);
  });

  it('offers a keyboard-operable compare slider once done', () => {
    const el = mount({ compare: '', progress: '1' });
    vi.advanceTimersByTime(3000);
    const knob = $(el, '[role="slider"]');
    expect(knob.getAttribute('tabindex')).toBe('0');
    expect(knob.getAttribute('aria-valuenow')).toBe('50'); // swept in to the middle
    knob.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    expect(el.split).toBe(0);
    knob.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(el.split).toBeCloseTo(0.02);
    knob.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', shiftKey: true, bubbles: true }));
    expect(el.split).toBeCloseTo(0.12);
    knob.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    expect(knob.getAttribute('aria-valuenow')).toBe('100');
    el.split = 7;
    expect(el.split).toBe(1);
  });

  it('reflects progress and returns to autoplay on null', () => {
    const el = mount();
    el.progress = 0.25;
    expect(el.getAttribute('progress')).toBe('0.25');
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
