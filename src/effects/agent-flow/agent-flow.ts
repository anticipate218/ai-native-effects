import { defineElement, EffectElement } from '../../core/effect-element';
import { clamp, damp, easeOutCubic } from '../../core/math';
import { edgePath, layoutFlow, layoutStack, railPath, type LayoutNode } from './layout';

export const FLOW_STEP_KINDS = ['plan', 'think', 'search', 'retrieve', 'code', 'tool', 'answer', 'step'] as const;
export type FlowStepKind = (typeof FLOW_STEP_KINDS)[number];
export const FLOW_STEP_STATUSES = ['queued', 'running', 'done', 'error'] as const;
export type FlowStepStatus = (typeof FLOW_STEP_STATUSES)[number];

export interface FlowStep {
  id: string;
  /** Step(s) this one follows. Omit for a root. */
  parents?: string | readonly string[];
  kind?: FlowStepKind;
  title: string;
  detail?: string;
  status?: FlowStepStatus;
  /** Duration in ms to display when done; measured automatically otherwise. */
  duration?: number;
  /** Longer result text, shown when the step is expanded (tool output, retrieved snippet…). */
  output?: string;
}

export type FlowLayout = 'auto' | 'graph' | 'stack';

export interface FlowStepToggleDetail {
  id: string;
  expanded: boolean;
}

export interface FlowStepChangeDetail {
  id: string;
  status: FlowStepStatus;
  previous: FlowStepStatus | null;
}

const KIND_TINT: Record<FlowStepKind, string> = {
  plan: '#8b6cff',
  think: '#b48cff',
  search: '#5ef2ff',
  retrieve: '#4cc9f0',
  code: '#ffb547',
  tool: '#9aa4ff',
  answer: '#3ddc97',
  step: '#9aa4c8',
};

// Original 16×16 line icons.
const ICONS: Record<FlowStepKind, string> = {
  plan: '<path d="M5.5 4.5h7M5.5 8h7M5.5 11.5h4.5"/><circle cx="3" cy="4.5" r=".6"/><circle cx="3" cy="8" r=".6"/><circle cx="3" cy="11.5" r=".6"/>',
  think: '<path d="M8 2.5l1.2 3.3 3.3 1.2-3.3 1.2L8 11.5 6.8 8.2 3.5 7l3.3-1.2z"/><path d="M12.5 10.5l.5 1.4 1.4.5-1.4.5-.5 1.4-.5-1.4-1.4-.5 1.4-.5z"/>',
  search: '<circle cx="7" cy="7" r="4"/><path d="M10 10l3.5 3.5"/>',
  retrieve: '<ellipse cx="8" cy="4" rx="5" ry="1.8"/><path d="M3 4v8c0 1 2.2 1.8 5 1.8s5-.8 5-1.8V4M3 8c0 1 2.2 1.8 5 1.8S13 9 13 8"/>',
  code: '<path d="M5.5 4.5L2 8l3.5 3.5M10.5 4.5L14 8l-3.5 3.5M9 3l-2 10"/>',
  tool: '<path d="M10.5 2.5a3 3 0 00-2.9 3.8L2.8 11.1a1.2 1.2 0 001.7 1.7l4.8-4.8a3 3 0 003.8-2.9l-1.7 1.1-1.6-.4-.4-1.6z"/>',
  answer: '<path d="M2.5 4a1.5 1.5 0 011.5-1.5h8A1.5 1.5 0 0113.5 4v5.5A1.5 1.5 0 0112 11H7l-3 2.5V11a1.5 1.5 0 01-1.5-1.5z"/>',
  step: '<circle cx="8" cy="8" r="3"/>',
};

const STATUS_TEXT: Record<FlowStepStatus, string> = { queued: 'queued', running: 'running', done: 'done', error: 'failed' };

const STYLE = /* css */ `
:host {
  --_accent: var(--ane-flow-accent, #7c5cff);
  --_accent2: var(--ane-flow-accent-2, #5ef2ff);
  --_success: var(--ane-success, #3ddc97);
  --_danger: var(--ane-danger, #ff5d6c);
  --_card: var(--ane-flow-card, rgba(19, 23, 44, 0.92));
  --_text: var(--ane-flow-text, #eef1ff);
  --_muted: rgba(220, 226, 255, 0.66);
  --_w: var(--ane-flow-node-width, 236px);
  display: block;
  position: relative;
  width: 100%;
  height: var(--ane-size, 460px);
  overflow: hidden;
  border-radius: var(--ane-flow-radius, 16px);
  color: var(--_text);
  background-color: var(--ane-flow-bg, #0a0d1a);
  background-image: radial-gradient(rgba(220, 226, 255, 0.07) 1px, transparent 1.3px);
  background-size: 22px 22px;
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  contain: layout paint style;
}
:host([hidden]) { display: none; }
.world { position: absolute; left: 0; top: 0; transform-origin: 0 0; will-change: transform; }
svg.edges { position: absolute; left: 0; top: 0; width: 1px; height: 1px; overflow: visible; pointer-events: none; }
.edge { fill: none; stroke-linecap: round; }
.edge.base { stroke: rgba(220, 226, 255, 0.2); stroke-width: 1.5; }
.edge.base[data-status="queued"] { stroke: rgba(220, 226, 255, 0.16); stroke-dasharray: 0.012 0.02; }
.edge.base[data-status="running"] { stroke: url(#ane-flow-grad); stroke-width: 2; }
.edge.base[data-status="error"] { stroke: color-mix(in srgb, var(--_danger) 70%, transparent); }
.edge.glow { stroke: var(--_accent2); stroke-width: 7; opacity: 0; filter: blur(4px); }
.edge.flow { stroke: #fff; stroke-width: 3.2; stroke-dasharray: 0.001 0.07; opacity: 0; }
ol { list-style: none; margin: 0; padding: 0; }
.node {
  position: absolute;
  left: 0;
  top: 0;
  width: var(--_w);
  box-sizing: border-box;
  border-radius: 13px;
  background: var(--_card);
  border: 1px solid rgba(220, 226, 255, 0.09);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
  will-change: transform, opacity;
}
.stack .node { width: var(--_stack-w, var(--_w)); }
.card {
  all: unset;
  box-sizing: border-box;
  display: grid;
  grid-template-columns: 30px minmax(0, 1fr) auto;
  gap: 10px;
  align-items: start;
  width: 100%;
  padding: 10px 12px 10px 10px;
  border-radius: inherit;
  cursor: pointer;
  color: inherit;
  font: inherit;
  text-align: left;
}
.card:focus-visible { outline: 2px solid var(--_accent2); outline-offset: 3px; }
.node[data-expanded] { z-index: 1; }
.node[data-expanded] .detail { display: block; -webkit-line-clamp: unset; overflow: visible; }
.output {
  display: none;
  margin: -2px 10px 10px 50px;
  padding: 8px 10px;
  border-radius: 9px;
  background: rgba(0, 0, 0, 0.28);
  box-shadow: inset 0 0 0 1px rgba(220, 226, 255, 0.06);
  font: 11px/1.5 ui-monospace, "SFMono-Regular", "Cascadia Mono", Menlo, Consolas, monospace;
  color: rgba(220, 226, 255, 0.84);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  max-height: 9.5em;
  overflow: auto;
}
.node[data-expanded] .output:not(:empty) { display: block; }
.node[data-status="queued"] { border-style: dashed; border-color: rgba(220, 226, 255, 0.16); background: color-mix(in srgb, var(--_card) 70%, transparent); }
.node[data-status="queued"] .text, .node[data-status="queued"] .icon { opacity: 0.6; }
.node[data-status="error"] { border-color: color-mix(in srgb, var(--_danger) 60%, transparent); }
.node[data-status="running"] { border-color: transparent; }
.ring {
  position: absolute;
  inset: -1px;
  border-radius: inherit;
  padding: 1.5px;
  background: conic-gradient(from var(--a, 0deg), transparent 0deg 210deg, var(--_accent) 280deg, var(--_accent2) 340deg, transparent 360deg);
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask: linear-gradient(#000 0 0) content-box exclude, linear-gradient(#000 0 0);
  opacity: 0;
  pointer-events: none;
}
.node[data-status="running"] .ring { opacity: 1; }
.node[data-status="running"]::after {
  content: "";
  position: absolute;
  inset: -1px;
  border-radius: inherit;
  box-shadow: 0 0 22px color-mix(in srgb, var(--_accent) 35%, transparent);
  pointer-events: none;
}
.icon {
  width: 30px;
  height: 30px;
  border-radius: 9px;
  display: grid;
  place-items: center;
  background: color-mix(in srgb, var(--k) 16%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--k) 32%, transparent);
  color: var(--k);
}
.icon svg, .state svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; }
.title { display: block; font-size: 13px; font-weight: 650; line-height: 1.3; letter-spacing: -0.005em; }
.detail {
  margin-top: 3px;
  font-size: 11.5px;
  line-height: 1.4;
  color: var(--_muted);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.detail:empty { display: none; }
.meta { display: grid; justify-items: end; gap: 4px; padding-top: 1px; }
.state { width: 16px; height: 16px; color: var(--_muted); }
.node[data-status="running"] .state { color: var(--_accent2); }
.node[data-status="done"] .state { color: var(--_success); }
.node[data-status="error"] .state { color: var(--_danger); }
.dur { font: 600 10.5px/1 ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace; color: var(--_muted); font-variant-numeric: tabular-nums; }
.dur:empty { display: none; }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
`;

const STATE_ICONS: Record<FlowStepStatus, string> = {
  queued: '<circle cx="8" cy="8" r="5.5" stroke-dasharray="2 2.4"/>',
  running: '<circle cx="8" cy="8" r="5.5" opacity=".25"/><path class="spin" d="M8 2.5a5.5 5.5 0 015.5 5.5"/>',
  done: '<circle cx="8" cy="8" r="6" opacity=".35"/><path d="M5.3 8.2l1.8 1.8 3.6-3.8"/>',
  error: '<circle cx="8" cy="8" r="6" opacity=".35"/><path d="M6 6l4 4M10 6l-4 4"/>',
};

interface NodeState {
  step: Required<Pick<FlowStep, 'id' | 'kind' | 'title' | 'status'>> & { parents: string[]; detail: string; output: string; duration?: number };
  expanded: boolean;
  el: HTMLLIElement;
  x: number;
  y: number;
  tx: number;
  ty: number;
  width: number;
  height: number;
  born: number;
  startedAt: number | null;
  placed: boolean;
}

interface EdgeState {
  from: string;
  to: string;
  base: SVGPathElement;
  glow: SVGPathElement;
  flow: SVGPathElement;
  born: number;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
const ENTER_MS = 420;
const EDGE_MS = 520;

const toParents = (p: FlowStep['parents']): string[] => (p == null ? [] : typeof p === 'string' ? [p] : [...p]);
const now = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/**
 * `<ane-agent-flow>`: a live graph of an agent run. Steps arrive as events and grow into a
 * layered flow (plan → parallel tool calls → join → answer); running steps glow, edges carry
 * data, and the camera keeps the newest work in view.
 *
 * @attr accent, accent-2 - running colours (gradient), defaults `#7c5cff`, `#5ef2ff`
 * @attr size - height (CSS length), default `460px`
 * @attr speed, motion
 * @attr announce - announce status changes through a polite live region
 * @attr label - accessible name of the step list, default `Agent run`
 * @attr layout - `auto` (stack below 560px) | `graph` | `stack`
 * @fires ane-step-change - when a step's status changes
 * @fires ane-step-toggle - when a step is expanded or collapsed
 */
export class AgentFlowElement extends EffectElement {
  static override get observedAttributes(): string[] {
    return [...super.observedAttributes, 'accent', 'accent-2', 'label', 'announce', 'layout'];
  }

  #world: HTMLElement | null = null;
  #list: HTMLOListElement | null = null;
  #edgeLayer: SVGGElement | null = null;
  #live: HTMLElement | null = null;
  #resize: ResizeObserver | null = null;
  #nodes = new Map<string, NodeState>();
  #edges = new Map<string, EdgeState>();
  #layoutDirty = false;
  #stack = false;
  #width = 0;
  #height = 0;
  #cam = { x: 0, y: 0, s: 1, tx: 0, ty: 0, ts: 1, placed: false };

  /** Snapshot of the steps (in insertion order). Assigning diffs against the current run. */
  get steps(): FlowStep[] {
    return [...this.#nodes.values()].map(({ step }) => ({ ...step, parents: [...step.parents] }));
  }
  set steps(value: readonly FlowStep[]) {
    const keep = new Set(value.map((s) => s.id));
    for (const id of [...this.#nodes.keys()]) if (!keep.has(id)) this.removeStep(id);
    for (const step of value) {
      if (this.#nodes.has(step.id)) this.updateStep(step.id, step);
      else this.addStep(step);
    }
  }

  protected build(root: ShadowRoot): void {
    root.innerHTML = `<style>${STYLE}</style>
<div class="world" part="world">
  <svg class="edges" aria-hidden="true"><defs><linearGradient id="ane-flow-grad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--_accent)"/><stop offset="1" stop-color="var(--_accent2)"/></linearGradient></defs><g></g></svg>
  <ol class="nodes"></ol>
</div>
<span class="sr live" aria-live="polite"></span>`;
    this.#world = root.querySelector('.world');
    this.#list = root.querySelector('ol');
    this.#edgeLayer = root.querySelector('svg g');
    this.#live = root.querySelector('.live');
    this.#syncLabel();
    this.#syncColors();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (!this.#resize && typeof ResizeObserver === 'function') {
      this.#resize = new ResizeObserver(() => this.#fit());
      this.#resize.observe(this);
    }
    this.#fit();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#resize?.disconnect();
    this.#resize = null;
  }

  protected override attributeChanged(name: string): void {
    if (name === 'label') this.#syncLabel();
    if (name === 'accent' || name === 'accent-2') this.#syncColors();
    if (name === 'layout') {
      this.#layoutDirty = true;
      this.#cam.placed = false;
      this.tick(0);
    }
  }

  #syncLabel(): void {
    this.#list?.setAttribute('aria-label', this.getAttribute('label') || 'Agent run');
  }

  #syncColors(): void {
    const set = (attr: string, prop: string): void => {
      const v = this.getAttribute(attr);
      if (v) this.style.setProperty(prop, v);
      else this.style.removeProperty(prop);
    };
    set('accent', '--ane-flow-accent');
    set('accent-2', '--ane-flow-accent-2');
  }

  // --- public API ----------------------------------------------------------------

  /** Adds a step. Returns `false` if the id already exists (use `updateStep`). */
  addStep(input: FlowStep): boolean {
    if (!input.id || this.#nodes.has(input.id) || !this.#list) return false;
    const step: NodeState['step'] = {
      id: input.id,
      parents: toParents(input.parents).filter((p) => p !== input.id),
      kind: FLOW_STEP_KINDS.includes(input.kind as FlowStepKind) ? (input.kind as FlowStepKind) : 'step',
      title: input.title,
      detail: input.detail ?? '',
      status: FLOW_STEP_STATUSES.includes(input.status as FlowStepStatus) ? (input.status as FlowStepStatus) : 'queued',
      duration: input.duration,
      output: input.output ?? '',
    };
    const el = document.createElement('li');
    el.className = 'node';
    el.innerHTML = `<i class="ring" aria-hidden="true"></i><button type="button" class="card" aria-expanded="false"><span class="icon" aria-hidden="true"></span><span class="text"><span class="title"></span><span class="detail"></span><span class="sr status-text"></span></span><span class="meta" aria-hidden="true"><span class="state"></span><span class="dur"></span></span></button><div class="output"></div>`;
    el.querySelector('.card')!.addEventListener('click', () => this.toggleStep(step.id));
    this.#list.append(el);

    // New steps rise out of their (first) parent.
    const parent = this.#nodes.get(step.parents[0] ?? '');
    const node: NodeState = {
      step,
      el,
      x: parent?.x ?? 0,
      y: parent ? parent.y + 20 : 0,
      tx: 0,
      ty: 0,
      width: 0,
      height: 0,
      born: this.elapsed,
      startedAt: step.status === 'running' ? now() : null,
      placed: !parent,
      expanded: false,
    };
    this.#nodes.set(step.id, node);
    this.#render(node);
    for (const p of step.parents) if (this.#nodes.has(p)) this.#addEdge(p, step.id);
    this.#layoutDirty = true;
    this.#announce(node, null);
    this.tick(0);
    return true;
  }

  /** Updates a step's fields (status, title, detail, output, kind, parents, duration). */
  updateStep(id: string, patch: Partial<FlowStep>): boolean {
    const node = this.#nodes.get(id);
    if (!node) return false;
    const previous = node.step.status;
    const s = node.step;
    if (patch.title != null) s.title = patch.title;
    if (patch.detail != null) s.detail = patch.detail;
    if (patch.duration != null) s.duration = patch.duration;
    if (patch.output != null) s.output = patch.output;
    if (patch.kind && FLOW_STEP_KINDS.includes(patch.kind)) s.kind = patch.kind;
    if (patch.status && FLOW_STEP_STATUSES.includes(patch.status)) s.status = patch.status;
    if (patch.parents != null) {
      const next = toParents(patch.parents).filter((p) => p !== id);
      for (const p of s.parents) if (!next.includes(p)) this.#removeEdge(p, id);
      for (const p of next) if (!s.parents.includes(p) && this.#nodes.has(p)) this.#addEdge(p, id);
      s.parents = next;
    }
    if (s.status === 'running' && previous !== 'running') node.startedAt = now();
    if ((s.status === 'done' || s.status === 'error') && s.duration == null && node.startedAt != null) {
      s.duration = now() - node.startedAt;
    }
    this.#render(node);
    this.#layoutDirty = true;
    if (previous !== s.status) this.#announce(node, previous);
    this.tick(0);
    return true;
  }

  /** Expands or collapses a step's details (toggles when `open` is omitted). */
  toggleStep(id: string, open?: boolean): boolean {
    const node = this.#nodes.get(id);
    if (!node) return false;
    const next = open ?? !node.expanded;
    if (next === node.expanded) return true;
    node.expanded = next;
    this.#render(node);
    this.#layoutDirty = true;
    this.dispatchEvent(
      new CustomEvent<FlowStepToggleDetail>('ane-step-toggle', { detail: { id, expanded: next }, bubbles: true, composed: true }),
    );
    this.tick(0);
    return true;
  }

  removeStep(id: string): boolean {
    const node = this.#nodes.get(id);
    if (!node) return false;
    node.el.remove();
    this.#nodes.delete(id);
    for (const key of [...this.#edges.keys()]) {
      const e = this.#edges.get(key)!;
      if (e.from === id || e.to === id) this.#removeEdge(e.from, e.to);
    }
    this.#layoutDirty = true;
    return true;
  }

  /** Clears the run. */
  reset(): void {
    for (const id of [...this.#nodes.keys()]) this.removeStep(id);
    this.#cam.placed = false;
  }

  // --- rendering -----------------------------------------------------------------

  #render(node: NodeState): void {
    const { el, step } = node;
    el.dataset.status = step.status;
    if (el.dataset.kind !== step.kind) {
      el.dataset.kind = step.kind;
      el.style.setProperty('--k', KIND_TINT[step.kind]);
      el.querySelector('.icon')!.innerHTML = `<svg viewBox="0 0 16 16">${ICONS[step.kind]}</svg>`;
    }
    el.toggleAttribute('data-expanded', node.expanded);
    el.querySelector('.card')!.setAttribute('aria-expanded', String(node.expanded));
    el.querySelector('.output')!.textContent = step.output;
    el.querySelector('.title')!.textContent = step.title;
    el.querySelector('.detail')!.textContent = step.detail;
    const dur = step.status === 'done' && step.duration != null ? formatDuration(step.duration) : '';
    el.querySelector('.dur')!.textContent = dur;
    el.querySelector('.status-text')!.textContent = `, ${STATUS_TEXT[step.status]}${dur ? ` in ${dur}` : ''}`;
    el.querySelector('.state')!.innerHTML = `<svg viewBox="0 0 16 16">${STATE_ICONS[step.status]}</svg>`;
  }

  #announce(node: NodeState, previous: FlowStepStatus | null): void {
    if (previous !== null || node.step.status !== 'queued') {
      this.dispatchEvent(
        new CustomEvent<FlowStepChangeDetail>('ane-step-change', {
          detail: { id: node.step.id, status: node.step.status, previous },
          bubbles: true,
          composed: true,
        }),
      );
    }
    if (this.hasAttribute('announce') && this.#live && node.step.status !== 'queued') {
      this.#live.textContent = `${node.step.title}: ${STATUS_TEXT[node.step.status]}`;
    }
  }

  #addEdge(from: string, to: string): void {
    const key = `${from}\u0000${to}`;
    if (this.#edges.has(key) || !this.#edgeLayer) return;
    const make = (cls: string): SVGPathElement => {
      const p = document.createElementNS(SVG_NS, 'path');
      p.setAttribute('class', `edge ${cls}`);
      p.setAttribute('pathLength', '1');
      return p;
    };
    const edge: EdgeState = { from, to, base: make('base'), glow: make('glow'), flow: make('flow'), born: this.elapsed };
    this.#edgeLayer.append(edge.glow, edge.base, edge.flow);
    this.#edges.set(key, edge);
  }

  #removeEdge(from: string, to: string): void {
    const key = `${from}\u0000${to}`;
    const edge = this.#edges.get(key);
    if (!edge) return;
    edge.base.remove();
    edge.glow.remove();
    edge.flow.remove();
    this.#edges.delete(key);
  }

  #fit(): void {
    const rect = this.getBoundingClientRect();
    this.#width = rect.width;
    this.#height = rect.height;
    this.#layoutDirty = true;
    this.tick(0);
  }

  /** `true` when steps are shown as a single column (narrow containers or `layout="stack"`). */
  get stacked(): boolean {
    const mode = (this.getAttribute('layout') || 'auto') as FlowLayout;
    return mode === 'stack' || (mode === 'auto' && this.#width > 0 && this.#width < 560);
  }

  #relayout(): void {
    const pad = 28;
    const rail = 22;
    this.#stack = this.stacked;
    this.#world!.classList.toggle('stack', this.#stack);
    this.#world!.style.setProperty('--_stack-w', `${Math.max(200, Math.round(this.#width - pad * 2 - rail - 3 * 14))}px`);
    for (const node of this.#nodes.values()) {
      node.width = node.el.offsetWidth || 236;
      node.height = node.el.offsetHeight || 56;
    }
    const inputs = [...this.#nodes.values()].map((n) => ({ id: n.step.id, parents: n.step.parents, width: n.width, height: n.height }));
    const result = this.#stack ? layoutStack(inputs, { gap: 12, indent: 14, maxIndent: 3 }) : layoutFlow(inputs, { rankGap: 46, nodeGap: 22 });
    for (const [id, placed] of result.nodes) {
      const node = this.#nodes.get(id)!;
      node.tx = placed.x;
      node.ty = placed.y;
      if (!node.placed) {
        // New steps rise into their own slot (spawning at the parent made siblings overlap
        // mid-flight); existing steps glide when the layout changes.
        node.placed = true;
        node.x = placed.x;
        node.y = placed.y + 16;
      }
    }
    // Camera: while work is running, fit the width and follow the newest active step;
    // once nothing is running, zoom out to show the whole run (graph) or the latest step (stack).
    const contentW = result.maxX - result.minX;
    const contentH = result.maxY - result.minY;
    const fitW = (this.#width - pad * 2) / Math.max(contentW, 1);
    const fitH = (this.#height - pad * 2) / Math.max(contentH, 1);
    let focus = 0;
    for (const n of this.#nodes.values()) {
      if (n.step.status === 'running') focus = Math.max(focus, n.ty + n.height / 2);
    }
    const overview = focus === 0;
    if (this.#stack) {
      const top = pad - result.minY;
      this.#cam.ts = 1;
      this.#cam.tx = pad + rail - result.minX;
      this.#cam.ty = Math.min(top, this.#height - pad - (overview ? result.maxY : focus));
    } else {
      const s = this.#nodes.size ? clamp(Math.min(1, fitW, overview ? fitH : 1), 0.4, 1) : 1;
      const top = pad - result.minY * s;
      this.#cam.ts = s;
      this.#cam.tx = this.#width / 2 - ((result.minX + result.maxX) / 2) * s;
      this.#cam.ty = overview
        ? Math.max(top, this.#height / 2 - ((result.minY + result.maxY) / 2) * s)
        : Math.min(top, this.#height - pad - focus * s);
    }
    if (!this.#cam.placed) {
      this.#cam.x = this.#cam.tx;
      this.#cam.y = this.#cam.ty;
      this.#cam.s = this.#cam.ts;
      this.#cam.placed = true;
    }
  }

  protected tick(deltaMs: number): void {
    if (!this.#world) return;
    if (this.#layoutDirty && this.#width) {
      this.#layoutDirty = false;
      this.#relayout();
    }
    const reduced = this.reducedMotion;
    const t = this.elapsed;
    const k = (lambda: number): ((a: number, b: number) => number) =>
      reduced ? (_a, b) => b : (a, b) => damp(a, b, lambda, deltaMs);

    // Camera.
    const cam = this.#cam;
    const ease = k(6);
    cam.x = ease(cam.x, cam.tx);
    cam.y = ease(cam.y, cam.ty);
    cam.s = ease(cam.s, cam.ts);
    this.#world.style.transform = `translate(${cam.x.toFixed(1)}px, ${cam.y.toFixed(1)}px) scale(${cam.s.toFixed(4)})`;
    this.style.backgroundPosition = `${(cam.x % 22).toFixed(1)}px ${(cam.y % 22).toFixed(1)}px`;

    // Nodes.
    const glide = k(9);
    for (const node of this.#nodes.values()) {
      node.x = glide(node.x, node.tx);
      node.y = glide(node.y, node.ty);
      const enter = reduced ? 1 : easeOutCubic(clamp((t - node.born) / ENTER_MS, 0, 1));
      const scale = 0.94 + 0.06 * enter;
      node.el.style.transform = `translate(${(node.x - node.width / 2).toFixed(1)}px, ${(node.y - node.height / 2).toFixed(1)}px) scale(${scale.toFixed(3)})`;
      node.el.style.opacity = String(enter);
      if (node.step.status === 'running') {
        node.el.style.setProperty('--a', `${reduced ? 0 : ((t * 0.24) % 360).toFixed(1)}deg`);
        const spin = node.el.querySelector<SVGPathElement>('.spin');
        if (spin) spin.style.transform = reduced ? '' : `rotate(${((t * 0.36) % 360).toFixed(1)}deg)`;
        if (spin) spin.style.transformOrigin = '8px 8px';
      }
    }

    // Edges follow the animated node positions.
    for (const edge of this.#edges.values()) {
      const a = this.#nodes.get(edge.from);
      const b = this.#nodes.get(edge.to);
      if (!a || !b) continue;
      const box = (n: NodeState): LayoutNode => ({ x: n.x, y: n.y, rank: 0, width: n.width, height: n.height });
      const d = this.#stack ? railPath(box(a), box(b)) : edgePath(box(a), box(b));
      edge.base.setAttribute('d', d);
      edge.glow.setAttribute('d', d);
      edge.flow.setAttribute('d', d);
      const status = b.step.status;
      edge.base.dataset.status = status;
      const drawn = reduced ? 1 : easeOutCubic(clamp((t - edge.born) / EDGE_MS, 0, 1));
      if (status === 'queued') {
        edge.base.style.strokeDashoffset = '';
        edge.base.style.strokeDasharray = '';
      } else {
        edge.base.style.strokeDasharray = drawn < 1 ? '1 1' : '';
        edge.base.style.strokeDashoffset = drawn < 1 ? String(1 - drawn) : '';
      }
      const running = status === 'running' && !reduced;
      edge.glow.style.opacity = running ? '0.35' : '0';
      edge.flow.style.opacity = running ? '0.9' : '0';
      if (running) edge.flow.style.strokeDashoffset = String((-t / 1800) % 1);
    }
  }
}

export function formatDuration(ms: number): string {
  if (ms < 10) return '<10 ms';
  if (ms < 1000) return `${Math.round(ms / 10) * 10} ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(ms < 10000 ? 1 : 0)} s`;
  const m = Math.floor(ms / 60000);
  return `${m}m ${Math.round((ms % 60000) / 1000)}s`;
}

declare global {
  interface HTMLElementTagNameMap {
    'ane-agent-flow': AgentFlowElement;
  }
  interface HTMLElementEventMap {
    'ane-step-change': CustomEvent<FlowStepChangeDetail>;
    'ane-step-toggle': CustomEvent<FlowStepToggleDetail>;
  }
}

/** Registers `<ane-agent-flow>` (or a custom tag name). Safe to call more than once. */
export function defineAgentFlow(tag = 'ane-agent-flow'): void {
  defineElement(tag, AgentFlowElement);
}
