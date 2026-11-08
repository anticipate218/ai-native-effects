import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getTickerStats } from '../../core/ticker';
import { BUDDY_STATES, DEFAULT_BUDDY_LABELS, ThinkingBuddyElement, type BuddyStateChangeDetail } from './index';

const svgOf = (el: ThinkingBuddyElement) => el.shadowRoot!.querySelector('svg')!;

function mount(attrs: Record<string, string> = {}): ThinkingBuddyElement {
  const el = document.createElement('ane-thinking-buddy');
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
  document.body.append(el);
  return el;
}

describe('<ane-thinking-buddy>', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.useRealTimers();
  });

  it('registers the custom element on import', () => {
    expect(customElements.get('ane-thinking-buddy')).toBe(ThinkingBuddyElement);
    expect(document.createElement('ane-thinking-buddy')).toBeInstanceOf(ThinkingBuddyElement);
  });

  it('renders an accessible SVG with an idle default state', () => {
    const el = mount();
    const svg = svgOf(el);
    expect(el.state).toBe('idle');
    expect(svg.getAttribute('role')).toBe('img');
    expect(svg.getAttribute('aria-label')).toBe(DEFAULT_BUDDY_LABELS.idle);
    expect(svg.getAttribute('data-state')).toBe('idle');
  });

  it('reads the initial state from markup without firing an event', () => {
    const listener = vi.fn();
    document.addEventListener('ane-statechange', listener);
    const el = mount({ state: 'thinking' });
    expect(el.state).toBe('thinking');
    expect(svgOf(el).getAttribute('aria-label')).toBe(DEFAULT_BUDDY_LABELS.thinking);
    expect(listener).not.toHaveBeenCalled();
    document.removeEventListener('ane-statechange', listener);
  });

  it('switches state through the attribute and the property, firing ane-statechange', () => {
    const el = mount();
    const events: BuddyStateChangeDetail[] = [];
    el.addEventListener('ane-statechange', (event) => events.push(event.detail));

    el.setAttribute('state', 'thinking');
    el.state = 'success';
    el.state = 'success'; // no-op: unchanged

    expect(el.getAttribute('state')).toBe('success');
    expect(svgOf(el).getAttribute('data-state')).toBe('success');
    expect(events).toEqual([
      { state: 'thinking', previous: 'idle' },
      { state: 'success', previous: 'thinking' },
    ]);
  });

  it('bubbles state changes out of the shadow root', () => {
    const el = mount();
    const listener = vi.fn();
    document.body.addEventListener('ane-statechange', listener);
    el.state = 'error';
    expect(listener).toHaveBeenCalledTimes(1);
    document.body.removeEventListener('ane-statechange', listener);
  });

  it('falls back to idle for unknown states', () => {
    const el = mount({ state: 'thinking' });
    el.setAttribute('state', 'dancing');
    expect(el.state).toBe('idle');
  });

  it('supports localised labels and a label override', () => {
    const el = mount();
    el.labels = { idle: '空闲', thinking: '正在思考' };
    expect(svgOf(el).getAttribute('aria-label')).toBe('空闲');
    el.state = 'thinking';
    expect(svgOf(el).getAttribute('aria-label')).toBe('正在思考');
    el.state = 'waiting';
    expect(svgOf(el).getAttribute('aria-label')).toBe(DEFAULT_BUDDY_LABELS.waiting);
    el.setAttribute('label', 'Build bot');
    expect(svgOf(el).getAttribute('aria-label')).toBe('Build bot');
  });

  it('announces state changes only when asked to', () => {
    const quiet = mount();
    quiet.state = 'thinking';
    expect(quiet.shadowRoot!.querySelector('.sr')!.textContent).toBe('');

    const loud = mount({ announce: '' });
    loud.state = 'error';
    expect(loud.shadowRoot!.querySelector('.sr')!.textContent).toBe(DEFAULT_BUDDY_LABELS.error);
  });

  it('maps color, accent and size attributes onto CSS custom properties', () => {
    const el = mount({ color: '#ff8800', accent: 'rgb(0, 200, 255)', size: '96px' });
    const svg = svgOf(el);
    expect(svg.style.getPropertyValue('--ane-buddy-color')).toBe('#ff8800');
    expect(svg.style.getPropertyValue('--ane-buddy-accent')).toBe('rgb(0, 200, 255)');
    expect(el.style.getPropertyValue('--ane-size')).toBe('96px');

    el.removeAttribute('color');
    el.removeAttribute('size');
    expect(svg.style.getPropertyValue('--ane-buddy-color')).toBe('');
    expect(el.style.getPropertyValue('--ane-size')).toBe('');
  });

  it('parses speed defensively', () => {
    const el = mount({ speed: '2' });
    expect(el.speed).toBe(2);
    el.setAttribute('speed', '99');
    expect(el.speed).toBe(5);
    el.setAttribute('speed', 'fast');
    expect(el.speed).toBe(1);
  });

  it('honours motion="reduce"', () => {
    const el = mount({ motion: 'reduce' });
    expect(el.reducedMotion).toBe(true);
    el.setAttribute('motion', 'full');
    expect(el.reducedMotion).toBe(false);
  });

  it('animates through every state without errors', () => {
    const errors = vi.spyOn(console, 'error');
    const el = mount({ interactive: '' });
    for (const state of BUDDY_STATES) {
      el.state = state;
      vi.advanceTimersByTime(1200);
    }
    el.boop();
    el.replay();
    vi.advanceTimersByTime(600);
    expect(errors).not.toHaveBeenCalled();
    // The success confetti has been launched and later hidden again.
    const confetti = Array.from(el.shadowRoot!.querySelectorAll('.confetti'));
    expect(confetti).toHaveLength(18);
  });

  it('keeps the reduced-motion character still', () => {
    const el = mount({ motion: 'reduce', state: 'thinking' });
    const char = el.shadowRoot!.querySelector('.char')!;
    vi.advanceTimersByTime(300);
    const first = char.getAttribute('transform');
    vi.advanceTimersByTime(700);
    expect(char.getAttribute('transform')).toBe(first);
  });

  it('unsubscribes from the shared loop when removed', () => {
    const el = mount();
    vi.advanceTimersByTime(32);
    expect(getTickerStats().subscribers).toBe(1);
    el.remove();
    expect(getTickerStats().subscribers).toBe(0);
  });
});
