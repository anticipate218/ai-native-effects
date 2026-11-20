import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getTickerStats } from '../../core/ticker';
import { drawFoil, TiltHoloCardElement, tiltFor } from './index';

describe('helpers', () => {
  it('dips the side under the pointer away from the viewer', () => {
    // Pointer right: rotateY positive (right edge goes back). Pointer top: rotateX positive (top goes back).
    expect(tiltFor(1, 0, 10)).toEqual([-0, 10]);
    expect(tiltFor(0, -1, 10)).toEqual([10, 0]);
    expect(tiltFor(-1, 1, 10)).toEqual([-10, -10]);
    expect(tiltFor(5, -5, 10)).toEqual([10, 10]); // clamped
  });

  it('draws every foil pattern without throwing', () => {
    const calls: string[] = [];
    const gradient = { addColorStop: () => {} };
    const ctx = new Proxy(
      {},
      {
        get: (_t, key) => (key === 'createRadialGradient' ? () => gradient : (...args: unknown[]) => calls.push(String(key) + args.length)),
        set: () => true,
      },
    ) as unknown as CanvasRenderingContext2D;
    for (const p of ['lines', 'sparkle', 'scales', 'none'] as const) drawFoil(ctx, p, 7, 64);
    expect(calls.filter((c) => c.startsWith('clearRect'))).toHaveLength(4);
    expect(calls.some((c) => c.startsWith('stroke'))).toBe(true); // lines
    expect(calls.some((c) => c.startsWith('arc'))).toBe(true); // scales
  });
});

describe('<ane-tilt-holo-card>', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.useRealTimers();
  });

  const mount = (attrs = ''): TiltHoloCardElement => {
    document.body.innerHTML = `<ane-tilt-holo-card ${attrs}><a href="#">Pass</a></ane-tilt-holo-card>`;
    return document.querySelector('ane-tilt-holo-card')!;
  };

  it('renders the layers around slotted content', () => {
    const card = mount();
    expect(card).toBeInstanceOf(TiltHoloCardElement);
    const root = card.shadowRoot!;
    for (const part of ['card', 'foil', 'sheen', 'glare', 'shadow']) expect(root.querySelector(`[part="${part}"]`)).not.toBeNull();
    expect(root.querySelector('slot')!.assignedElements()[0]!.textContent).toBe('Pass');
  });

  it('maps attributes to custom properties', () => {
    const card = mount('foil-strength="0.4" glare="2" sheen="0.3" blend="screen" radius="8px" ratio="5/7" perspective="600px"');
    const v = (p: string): string => card.style.getPropertyValue(p);
    expect(v('--_foil')).toBe('0.4');
    expect(v('--_glare')).toBe('1'); // clamped
    expect(v('--_sheen')).toBe('0.3');
    expect(v('--_blend')).toBe('screen');
    expect(v('--ane-holo-radius')).toBe('8px');
    expect(v('--_ratio')).toBe('5/7');
    expect(v('--_persp')).toBe('600px');
    card.setAttribute('blend', 'nonsense');
    expect(v('--_blend')).toBe('');
  });

  it('sways when idle and holds still with idle="off"', () => {
    const card = mount();
    vi.advanceTimersByTime(1500);
    const [rx, ry] = card.tiltAngles;
    expect(Math.abs(rx) + Math.abs(ry)).toBeGreaterThan(0.5);

    const still = mount('idle="off"');
    vi.advanceTimersByTime(3000);
    const a = still.style.getPropertyValue('--ry');
    vi.advanceTimersByTime(500);
    expect(still.style.getPropertyValue('--ry')).toBe(a); // settled: no more writes
  });

  it('stays flat under reduced motion', () => {
    const card = mount('motion="reduce"');
    card.dispatchEvent(new PointerEvent('pointermove', { clientX: 5, clientY: 5, pointerType: 'mouse' }));
    vi.advanceTimersByTime(800);
    expect(card.tiltAngles).toEqual([0, 0]);
    expect(card.style.getPropertyValue('--rx')).toBe('0.00');
  });

  it('tilts towards keyboard focus', () => {
    const card = mount('idle="off"');
    card.querySelector('a')!.focus();
    vi.advanceTimersByTime(1500);
    const [rx, ry] = card.tiltAngles;
    expect(rx).toBeGreaterThan(1);
    expect(ry).toBeGreaterThan(1);
  });

  it('animates without errors and cleans up when removed', () => {
    const errors = vi.spyOn(console, 'error');
    const card = mount('gyro');
    window.dispatchEvent(Object.assign(new Event('deviceorientation'), { beta: 60, gamma: -20 }));
    vi.advanceTimersByTime(1000);
    expect(errors).not.toHaveBeenCalled();
    card.remove();
    expect(getTickerStats().subscribers).toBe(0);
  });
});
