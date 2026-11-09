import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getTickerStats } from '../../core/ticker';
import { OrbitLoadingScreenElement, parseProgress, parseSteps, SCREEN_DEFAULTS, stepStatus } from './index';

const mount = (attrs: Record<string, string> = {}): OrbitLoadingScreenElement => {
  const el = document.createElement('ane-orbit-loading-screen');
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
  document.body.append(el);
  return el;
};
const $ = <T extends Element = HTMLElement>(el: OrbitLoadingScreenElement, selector: string): T =>
  el.shadowRoot!.querySelector<T>(selector)!;
const statuses = (el: OrbitLoadingScreenElement): string[] =>
  [...el.shadowRoot!.querySelectorAll('.steps li')].map((li) => (li as HTMLElement).dataset.status!);

describe('orbit loading screen helpers', () => {
  it('parses progress values', () => {
    expect(parseProgress(null)).toBeNull();
    expect(parseProgress('')).toBeNull();
    expect(parseProgress('0.25')).toBe(0.25);
    expect(parseProgress('80%')).toBe(0.8);
    expect(parseProgress('7')).toBe(1);
    expect(parseProgress('-2')).toBe(0);
    expect(parseProgress('soon')).toBeNull();
  });

  it('splits step labels', () => {
    expect(parseSteps('Sign in | Query |  | Download')).toEqual(['Sign in', 'Query', 'Download']);
    expect(parseSteps(null)).toEqual([]);
  });

  it('derives step statuses', () => {
    expect([0, 1, 2].map((i) => stepStatus(i, 1, false, false))).toEqual(['done', 'active', 'pending']);
    expect(stepStatus(1, 1, false, true)).toBe('failed');
    expect([0, 1, 2].map((i) => stepStatus(i, 0, true, false))).toEqual(['done', 'done', 'done']);
  });
});

describe('<ane-orbit-loading-screen>', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.useRealTimers();
  });

  it('renders defaults and falls back without WebGL', () => {
    const el = mount();
    expect(el).toBeInstanceOf(OrbitLoadingScreenElement);
    expect($(el, '.heading').textContent).toBe(SCREEN_DEFAULTS.heading);
    expect($(el, '.eyebrow-text').textContent).toBe(SCREEN_DEFAULTS.eyebrow);
    expect(el.webgl).toBe(false);
    for (const canvas of el.shadowRoot!.querySelectorAll('canvas')) expect(canvas.getAttribute('aria-hidden')).toBe('true');
  });

  it('exposes a progressbar named by the heading', () => {
    const el = mount({ heading: 'Downloading imagery', progress: '0.4' });
    const meter = $(el, '[role="progressbar"]');
    expect(meter.getAttribute('aria-labelledby')).toBe('heading');
    expect(meter.getAttribute('aria-valuenow')).toBe('40');
    expect(meter.getAttribute('aria-valuetext')).toBe('40%');
    el.setAttribute('label', 'Satellite download');
    expect(meter.getAttribute('aria-label')).toBe('Satellite download');
    expect(meter.hasAttribute('aria-labelledby')).toBe(false);
  });

  it('is indeterminate without progress and shows a dash', () => {
    const el = mount();
    vi.advanceTimersByTime(100);
    const meter = $(el, '[role="progressbar"]');
    expect(meter.hasAttribute('aria-valuenow')).toBe(false);
    expect(meter.getAttribute('aria-valuetext')).toBe('Loading');
    expect($(el, '.num').textContent).toBe('—');
    el.progress = 0.5;
    expect(el.getAttribute('progress')).toBe('0.5');
    el.progress = null;
    expect(el.hasAttribute('progress')).toBe(false);
  });

  it('renders steps with statuses, the current step and screen-reader text', () => {
    const el = mount({ steps: 'Authenticate|Query catalog|Download tiles', step: '1' });
    expect(statuses(el)).toEqual(['done', 'active', 'pending']);
    const active = el.shadowRoot!.querySelectorAll('.steps li')[1]!;
    expect(active.getAttribute('aria-current')).toBe('step');
    expect(active.querySelector('.label')!.textContent).toBe('Query catalog');
    expect(active.querySelector('.sr')!.textContent).toBe(', in progress');
    el.step = 2;
    expect(statuses(el)).toEqual(['done', 'done', 'active']);
    el.steps = ['One', 'Two'];
    expect(el.getAttribute('steps')).toBe('One|Two');
    expect(statuses(el)).toEqual(['done', 'done']);
  });

  it('escapes step labels', () => {
    const el = mount({ steps: '<img src=x onerror=alert(1)>|Next' });
    expect(el.shadowRoot!.querySelector('.steps img')).toBeNull();
    expect(el.shadowRoot!.querySelector('.steps .label')!.textContent).toBe('<img src=x onerror=alert(1)>');
  });

  it('fires ane-complete once, marks every step done and re-arms', () => {
    const el = mount({ steps: 'A|B|C', step: '1', progress: '0.3' });
    const done = vi.fn();
    el.addEventListener('ane-complete', done);
    el.progress = 1;
    vi.advanceTimersByTime(3000);
    expect(done).toHaveBeenCalledTimes(1);
    expect(statuses(el)).toEqual(['done', 'done', 'done']);
    expect($(el, '[role="progressbar"]').getAttribute('aria-valuetext')).toBe('Complete');
    expect($(el, '.num').textContent).toBe('100');
    vi.advanceTimersByTime(1000);
    expect(done).toHaveBeenCalledTimes(1);
    el.progress = 0.2;
    vi.advanceTimersByTime(500);
    el.progress = 1;
    vi.advanceTimersByTime(3000);
    expect(done).toHaveBeenCalledTimes(2);
  });

  it('shows the failed state on the active step and never completes', () => {
    const el = mount({ steps: 'A|B|C', step: '1', progress: '1', error: '' });
    const done = vi.fn();
    el.addEventListener('ane-complete', done);
    vi.advanceTimersByTime(1500);
    expect(done).not.toHaveBeenCalled();
    expect(statuses(el)).toEqual(['done', 'failed', 'pending']);
    expect($(el, '[role="progressbar"]').getAttribute('aria-valuetext')).toBe('Failed');
  });

  it('updates text lines and hides empty ones', () => {
    const el = mount({ detail: '1.2 GB of 2 GB' });
    expect($(el, '.detail').textContent).toBe('1.2 GB of 2 GB');
    expect($(el, '.status').textContent).toBe('');
    el.setAttribute('heading', 'Almost there');
    expect($(el, '.heading').textContent).toBe('Almost there');
  });

  it('reveals the actions area only when something is slotted', async () => {
    const el = mount();
    const actions = $(el, '.actions');
    expect(actions.hidden).toBe(true);
    const button = document.createElement('button');
    button.slot = 'actions';
    button.textContent = 'Cancel';
    el.append(button);
    await vi.waitFor(() => expect(actions.hidden).toBe(false));
  });

  it('clamps satellites and reflects fullscreen and error', () => {
    const el = mount({ satellites: '9' });
    expect(el.satellites).toBe(4);
    el.error = true;
    expect(el.hasAttribute('error')).toBe(true);
    el.toggleAttribute('fullscreen', true);
    expect(el.matches('[fullscreen]')).toBe(true);
  });

  it('animates without errors and cleans up when removed', () => {
    const errors = vi.spyOn(console, 'error');
    const el = mount({ progress: '0.3', steps: 'A|B' });
    vi.advanceTimersByTime(500);
    expect(errors).not.toHaveBeenCalled();
    el.remove();
    expect(getTickerStats().subscribers).toBe(0);
  });
});
