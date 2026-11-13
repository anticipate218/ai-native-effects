import '../../src/effects/agent-flow';
import type { AgentFlowElement, FlowStep } from '../../src/effects/agent-flow';
import { timeline, type Scene } from '../shared/scene';

type Event = [number, (flow: AgentFlowElement) => void];

const add = (step: FlowStep): ((flow: AgentFlowElement) => void) => (flow) => flow.addStep(step);
const set = (id: string, patch: Partial<FlowStep>): ((flow: AgentFlowElement) => void) => (flow) => flow.updateStep(id, patch);

/** A realistic run: plan → three parallel calls → analysis + cross-check → answer. */
export const SAMPLE_RUN: Event[] = [
  [300, add({ id: 'plan', kind: 'plan', title: 'Plan the analysis', detail: 'Flood extent change, Rhine, 2–14 June', status: 'running' })],
  [1300, set('plan', { status: 'done', duration: 1000 })],
  [1400, add({ id: 'news', parents: 'plan', kind: 'search', title: 'Search flood reports', detail: '“Rhine flooding June 2026”', status: 'running' })],
  [1550, add({ id: 's1', parents: 'plan', kind: 'retrieve', title: 'Fetch Sentinel-1 scenes', detail: '2 passes · VV · 10 m', status: 'running' })],
  [1700, add({ id: 'gauge', parents: 'plan', kind: 'tool', title: 'River gauge API', detail: 'Lobith, Nijmegen', status: 'running' })],
  [2900, set('gauge', { status: 'done', duration: 1200, output: 'Lobith 15.9 m (+3.1 m) · Nijmegen 14.2 m (+2.8 m)' })],
  [3300, set('news', { status: 'done', duration: 1900, output: '4 results · Rijkswaterstaat, DW, NOS, Reuters\nPeak discharge at Lobith on 11 June' })],
  [3400, add({ id: 'check', parents: 'news', kind: 'think', title: 'Cross-check reports', detail: '4 sources agree on peak 11 June', status: 'running' })],
  [4100, set('s1', { status: 'done', duration: 2550, output: 'S1A_IW_GRDH_20260602 · S1A_IW_GRDH_20260614\n2 × 1.6 GB, orbit 88 ascending' })],
  [4200, add({ id: 'extent', parents: ['s1', 'gauge'], kind: 'code', title: 'Compute flood extent', detail: 'backscatter < −18 dB → water mask', status: 'running' })],
  [4900, set('check', { status: 'done', duration: 1500 })],
  [6100, set('extent', { status: 'done', duration: 1900, output: 'water 2 Jun: 41.2 km² → 14 Jun: 56.9 km² (+38%)' })],
  [6200, add({ id: 'answer', parents: ['extent', 'check'], kind: 'answer', title: 'Write the summary', detail: 'Extent grew 38%, mostly along the lower Rhine', status: 'running' })],
  [7800, set('answer', { status: 'done', duration: 1600 })],
];

const scene: Scene = {
  width: 800,
  height: 450,
  duration: 10200,
  poster: 4600,
  play(stage) {
    stage.innerHTML = `
      <ane-agent-flow style="position:absolute;inset:0;height:100%;border-radius:0" label="Flood analysis run"></ane-agent-flow>`;
    const flow = stage.querySelector('ane-agent-flow')!;
    return timeline(SAMPLE_RUN.map(([at, action]): [number, () => void] => [at, () => action(flow)]));
  },
};

export default scene;
