import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getTickerStats } from '../../core/ticker';
import { ImageRevealElement } from './index';

describe('<ane-image-reveal>', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.useRealTimers();
  });

  it('registers and renders an accessible canvas', () => {
    const el = document.createElement('ane-image-reveal');
    document.body.append(el);
    expect(el).toBeInstanceOf(ImageRevealElement);
    const canvas = el.shadowRoot!.querySelector('canvas')!;
    expect(canvas.getAttribute('role')).toBe('img');
    expect(canvas.getAttribute('aria-label')).toBeTruthy();
  });

  it('honours the label attribute', () => {
    const el = document.createElement('ane-image-reveal');
    el.setAttribute('label', 'Custom label');
    document.body.append(el);
    expect(el.shadowRoot!.querySelector('canvas')!.getAttribute('aria-label')).toBe('Custom label');
  });

  it('animates without errors and cleans up when removed', () => {
    const errors = vi.spyOn(console, 'error');
    const el = document.createElement('ane-image-reveal');
    document.body.append(el);
    vi.advanceTimersByTime(500);
    expect(errors).not.toHaveBeenCalled();
    el.remove();
    expect(getTickerStats().subscribers).toBe(0);
  });
});
