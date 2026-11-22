import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getTickerStats } from '../../core/ticker';
import { ASCII_RAMPS, AsciiFieldElement, cellSize, rampFor } from './index';

describe('helpers', () => {
  it('resolves glyph ramps from presets or custom strings', () => {
    expect(rampFor(null).join('')).toBe(ASCII_RAMPS.classic);
    expect(rampFor('blocks').join('')).toBe(ASCII_RAMPS.blocks);
    expect(rampFor(' xX')).toEqual([' ', 'x', 'X']);
    expect(rampFor('x').join('')).toBe(ASCII_RAMPS.classic); // a single glyph is not a ramp
    expect(rampFor('katakana').length).toBeGreaterThan(5);
  });

  it('sizes cells in whole device pixels with a monospace aspect', () => {
    expect(cellSize(13, 1)).toEqual([8, 15]);
    expect(cellSize(13, 2)).toEqual([16, 29]);
    expect(cellSize(1, 1)).toEqual([3, 5]); // never degenerate
  });
});

describe('<ane-ascii-field>', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
  });
  afterEach(() => {
    document.body.innerHTML = '';
    vi.useRealTimers();
  });

  it('renders a decorative canvas and exposes the text to assistive technology', () => {
    document.body.innerHTML = '<ane-ascii-field text="HELLO"><h1>Hero</h1></ane-ascii-field>';
    const el = document.querySelector('ane-ascii-field')!;
    expect(el).toBeInstanceOf(AsciiFieldElement);
    expect(el.shadowRoot!.querySelector('canvas')!.getAttribute('aria-hidden')).toBe('true');
    expect(el.shadowRoot!.querySelector('.sr')!.textContent).toBe('HELLO');
    el.setAttribute('text', 'SHIP');
    expect(el.shadowRoot!.querySelector('.sr')!.textContent).toBe('SHIP');
    expect(el.shadowRoot!.querySelector('slot')!.assignedElements()[0]!.textContent).toBe('Hero');
  });

  it('freezes time under reduced motion', () => {
    document.body.innerHTML = '<ane-ascii-field motion="reduce"></ane-ascii-field>';
    const el = document.querySelector('ane-ascii-field')!;
    const a = el.time;
    vi.advanceTimersByTime(1000);
    expect(el.time).toBe(a);
  });

  it('morphs and dissolves (instantly under reduced motion)', async () => {
    document.body.innerHTML = '<ane-ascii-field motion="reduce"></ane-ascii-field>';
    const el = document.querySelector('ane-ascii-field')!;
    await el.morph('NOVA');
    expect(el.getAttribute('text')).toBe('NOVA');
    await el.dissolve();
    expect(el.getAttribute('text')).toBe('NOVA'); // dissolving keeps the word
  });

  it('runs without WebGL and cleans up when removed', () => {
    const errors = vi.spyOn(console, 'error');
    document.body.innerHTML = '<ane-ascii-field></ane-ascii-field>';
    const el = document.querySelector('ane-ascii-field')!;
    el.shockwave();
    vi.advanceTimersByTime(500);
    expect(errors).not.toHaveBeenCalled();
    el.remove();
    expect(getTickerStats().subscribers).toBe(0);
  });
});
