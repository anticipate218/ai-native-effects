import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getTickerStats } from '../../core/ticker';
import { AgentFlowElement, formatDuration } from './index';

describe('<ane-agent-flow>', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.useRealTimers();
  });

  const mount = (attrs: Record<string, string> = {}): AgentFlowElement => {
    const el = document.createElement('ane-agent-flow');
    for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
    document.body.append(el);
    return el;
  };
  const items = (el: AgentFlowElement): HTMLElement[] => [...el.shadowRoot!.querySelectorAll<HTMLElement>('li.node')];
  const edges = (el: AgentFlowElement): number => el.shadowRoot!.querySelectorAll('path.edge.base').length;

  it('renders steps as a labelled list with readable status text', () => {
    const el = mount({ label: 'Flood run' });
    expect(el.shadowRoot!.querySelector('ol')!.getAttribute('aria-label')).toBe('Flood run');
    expect(el.addStep({ id: 'plan', kind: 'plan', title: 'Plan', detail: 'Rhine', status: 'running' })).toBe(true);
    const [li] = items(el);
    expect(li!.dataset.status).toBe('running');
    expect(li!.dataset.kind).toBe('plan');
    expect(li!.querySelector('.title')!.textContent).toBe('Plan');
    expect(li!.querySelector('.status-text')!.textContent).toBe(', running');
  });

  it('rejects duplicate ids and normalises unknown kinds and statuses', () => {
    const el = mount();
    el.addStep({ id: 'a', title: 'A', kind: 'banana' as never, status: 'nope' as never });
    expect(el.addStep({ id: 'a', title: 'Again' })).toBe(false);
    expect(el.steps[0]).toMatchObject({ kind: 'step', status: 'queued' });
  });

  it('draws an edge per known parent and handles joins', () => {
    const el = mount();
    el.addStep({ id: 'plan', title: 'Plan' });
    el.addStep({ id: 'a', parents: 'plan', title: 'A' });
    el.addStep({ id: 'b', parents: ['plan', 'ghost'], title: 'B' });
    el.addStep({ id: 'join', parents: ['a', 'b'], title: 'Join' });
    expect(edges(el)).toBe(4);
    el.removeStep('a');
    expect(edges(el)).toBe(2);
    expect(items(el)).toHaveLength(3);
  });

  it('updates status, fires ane-step-change and shows durations', () => {
    const el = mount();
    const changes = vi.fn();
    el.addEventListener('ane-step-change', changes);
    el.addStep({ id: 'search', kind: 'search', title: 'Search', status: 'queued' });
    expect(changes).not.toHaveBeenCalled();
    el.updateStep('search', { status: 'running' });
    vi.advanceTimersByTime(1500);
    el.updateStep('search', { status: 'done' });
    expect(changes).toHaveBeenCalledTimes(2);
    expect(changes.mock.calls[1]![0].detail).toEqual({ id: 'search', status: 'done', previous: 'running' });
    const li = items(el)[0]!;
    expect(li.querySelector('.dur')!.textContent).toMatch(/^1\.\d s$/);
    expect(li.querySelector('.status-text')!.textContent).toMatch(/^, done in 1\.\d s$/);
    el.updateStep('search', { duration: 320 });
    expect(li.querySelector('.dur')!.textContent).toBe('320 ms');
    expect(el.updateStep('missing', { status: 'done' })).toBe(false);
  });

  it('can re-parent a step', () => {
    const el = mount();
    el.addStep({ id: 'a', title: 'A' });
    el.addStep({ id: 'b', title: 'B' });
    el.addStep({ id: 'c', parents: 'a', title: 'C' });
    el.updateStep('c', { parents: ['b'] });
    expect(el.steps.find((s) => s.id === 'c')!.parents).toEqual(['b']);
    expect(edges(el)).toBe(1);
  });

  it('diffs a whole steps array (framework-friendly)', () => {
    const el = mount();
    el.steps = [
      { id: 'plan', title: 'Plan', status: 'done' },
      { id: 'x', parents: 'plan', title: 'X', status: 'running' },
    ];
    const first = items(el)[0];
    el.steps = [
      { id: 'plan', title: 'Plan', status: 'done' },
      { id: 'y', parents: 'plan', title: 'Y', status: 'queued' },
    ];
    expect(items(el)[0]).toBe(first); // kept, not re-created
    expect(el.steps.map((s) => s.id)).toEqual(['plan', 'y']);
  });

  it('announces status changes when asked and resets cleanly', () => {
    const el = mount({ announce: '' });
    el.addStep({ id: 'a', title: 'Fetch scenes', status: 'running' });
    el.updateStep('a', { status: 'error' });
    expect(el.shadowRoot!.querySelector('.live')!.textContent).toBe('Fetch scenes: failed');
    el.reset();
    expect(items(el)).toHaveLength(0);
    expect(edges(el)).toBe(0);
  });

  it('expands a step with a real button, shows its output and fires ane-step-toggle', () => {
    const el = mount();
    const toggles = vi.fn();
    el.addEventListener('ane-step-toggle', toggles);
    el.addStep({ id: 'search', kind: 'search', title: 'Search', detail: 'flood reports', output: '4 results' });
    const li = items(el)[0]!;
    const button = li.querySelector('button.card')!;
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(li.querySelector('.output')!.textContent).toBe('4 results');
    (button as HTMLButtonElement).click();
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(li.hasAttribute('data-expanded')).toBe(true);
    expect(toggles.mock.calls[0]![0].detail).toEqual({ id: 'search', expanded: true });
    expect(el.toggleStep('search', true)).toBe(true);
    expect(toggles).toHaveBeenCalledTimes(1); // already open: no event
    el.toggleStep('search');
    expect(li.hasAttribute('data-expanded')).toBe(false);
    el.updateStep('search', { output: '5 results' });
    expect(li.querySelector('.output')!.textContent).toBe('5 results');
    expect(el.toggleStep('missing')).toBe(false);
  });

  it('redraws the icon when the kind changes', () => {
    const el = mount();
    el.addStep({ id: 'a', kind: 'search', title: 'A' });
    const li = items(el)[0]!;
    const before = li.querySelector('.icon')!.innerHTML;
    el.updateStep('a', { kind: 'code' });
    expect(li.dataset.kind).toBe('code');
    expect(li.querySelector('.icon')!.innerHTML).not.toBe(before);
  });

  it('switches to the stacked layout on request', () => {
    const el = mount({ layout: 'stack' });
    el.addStep({ id: 'a', title: 'A' });
    vi.advanceTimersByTime(50);
    expect(el.stacked).toBe(true);
    el.setAttribute('layout', 'graph');
    vi.advanceTimersByTime(50);
    expect(el.stacked).toBe(false);
  });

  it('animates without errors and cleans up when removed', () => {
    const errors = vi.spyOn(console, 'error');
    const el = mount();
    el.addStep({ id: 'a', title: 'A', status: 'running' });
    el.addStep({ id: 'b', parents: 'a', title: 'B', status: 'running' });
    vi.advanceTimersByTime(800);
    expect(errors).not.toHaveBeenCalled();
    el.remove();
    expect(getTickerStats().subscribers).toBe(0);
  });
});

describe('formatDuration', () => {
  it('formats milliseconds, seconds and minutes', () => {
    expect(formatDuration(4)).toBe('<10 ms');
    expect(formatDuration(320)).toBe('320 ms');
    expect(formatDuration(1540)).toBe('1.5 s');
    expect(formatDuration(42000)).toBe('42 s');
    expect(formatDuration(125000)).toBe('2m 5s');
  });
});
