import '../shared/debug';
import '../../src/effects/agent-flow';
import type { AgentFlowElement, FlowStep } from '../../src/effects/agent-flow';
import { CDN } from '../shared/meta';
import { attrString, mountPlayground } from '../shared/playground';
import { SAMPLE_RUN } from '../scenes/agent-flow';

const flow = document.getElementById('effect') as AgentFlowElement;
const log = document.getElementById('event-log')!;

mountPlayground({
  element: flow,
  controlsHost: document.getElementById('controls')!,
  codeHost: document.getElementById('code')!,
  defaults: { theme: 'dark', layout: 'auto', accent: '#7c5cff', 'accent-2': '#5ef2ff', size: '460px', speed: '1', motion: 'auto' },
  controls: [
    { type: 'segmented', attr: 'layout', label: 'Layout', options: ['auto', 'graph', 'stack'], value: 'auto' },
    { type: 'segmented', attr: 'theme', label: 'Theme', options: ['dark', 'light'], value: 'dark' },
    { type: 'color', attr: 'accent', label: 'Accent', value: '#7c5cff' },
    { type: 'color', attr: 'accent-2', label: 'Accent 2', value: '#5ef2ff' },
    { type: 'range', attr: 'size', label: 'Height', min: 320, max: 720, step: 10, value: 500, unit: 'px' },
    { type: 'range', attr: 'speed', label: 'Speed', min: 0, max: 3, step: 0.1, value: 1 },
    { type: 'select', attr: 'motion', label: 'Motion', options: ['auto', 'reduce', 'full'], value: 'auto' },
    { type: 'toggle', attr: 'announce', label: 'Announce status changes', value: false },
  ],
  snippets: (attrs) => {
    const html = attrString(attrs);
    return {
      HTML: `<script type="module" src="${CDN}/effects/agent-flow.js"></script>\n\n<ane-agent-flow${html} label="Agent run"></ane-agent-flow>\n\n<script type="module">\n  const flow = document.querySelector('ane-agent-flow');\n  flow.addStep({ id: 'plan', kind: 'plan', title: 'Plan the analysis', status: 'running' });\n  // …later, from your agent's events:\n  flow.updateStep('plan', { status: 'done' });\n  flow.addStep({ id: 'search', parents: 'plan', kind: 'search', title: 'Search reports', status: 'running' });\n</script>`,
      React: `import { useEffect, useRef } from 'react';\nimport 'ai-native-effects/agent-flow';\nimport type { FlowStep } from 'ai-native-effects/agent-flow';\n\nexport function RunGraph({ steps }: { steps: FlowStep[] }) {\n  const ref = useRef<HTMLElement & { steps: FlowStep[] }>(null);\n  // Assigning the whole array diffs it: existing cards are kept and animated.\n  useEffect(() => {\n    if (ref.current) ref.current.steps = steps;\n  }, [steps]);\n  return <ane-agent-flow${html} ref={ref} />;\n}`,
      Vue: `<script setup lang="ts">\nimport { ref, watchEffect } from 'vue';\nimport 'ai-native-effects/agent-flow';\nimport type { FlowStep } from 'ai-native-effects/agent-flow';\nconst props = defineProps<{ steps: FlowStep[] }>();\nconst el = ref();\nwatchEffect(() => { if (el.value) el.value.steps = props.steps; });\n</script>\n\n<template>\n  <ane-agent-flow${html} ref="el" />\n</template>`,
      'JS API': `import 'ai-native-effects/agent-flow';\n\nconst flow = document.querySelector('ane-agent-flow');\n\nagent.on('step:start', (e) => flow.addStep({\n  id: e.id, parents: e.parentIds, kind: e.tool ? 'tool' : 'think',\n  title: e.title, detail: e.input, status: 'running',\n}));\nagent.on('step:end', (e) => flow.updateStep(e.id, {\n  status: e.error ? 'error' : 'done', output: e.result,\n}));\n\nflow.addEventListener('ane-step-toggle', (e) => console.log(e.detail));\nflow.toggleStep('plan', true); // expand programmatically\nflow.reset();`,
    };
  },
});

flow.addEventListener('ane-step-change', (event) => {
  const { id, status, previous } = event.detail;
  log.innerHTML = `<code>ane-step-change</code> ${id}: ${previous ?? 'new'} → <strong>${status}</strong>`;
});
flow.addEventListener('ane-step-toggle', (event) => {
  log.innerHTML = `<code>ane-step-toggle</code> ${event.detail.id}: <strong>${event.detail.expanded ? 'expanded' : 'collapsed'}</strong>`;
});

let timers: number[] = [];
const clear = (): void => {
  timers.forEach(clearTimeout);
  timers = [];
};
const simulate = (): void => {
  clear();
  flow.reset();
  timers = SAMPLE_RUN.map(([at, action]) => window.setTimeout(() => action(flow), at));
};

let extra = 0;
document.getElementById('simulate')!.addEventListener('click', simulate);
document.getElementById('add')!.addEventListener('click', () => {
  if (!flow.steps.length) flow.addStep({ id: 'plan', kind: 'plan', title: 'Plan the analysis', status: 'done', duration: 900 });
  const parent = flow.steps.find((s) => s.kind === 'plan')?.id ?? flow.steps[0]!.id;
  const id = `extra-${++extra}`;
  const kinds: Array<FlowStep['kind']> = ['search', 'retrieve', 'code', 'tool', 'think'];
  flow.addStep({ id, parents: parent, kind: kinds[extra % kinds.length], title: `Extra step ${extra}`, detail: 'Added from the playground', status: 'running' });
  timers.push(window.setTimeout(() => flow.updateStep(id, { status: 'done', output: `Result of extra step ${extra}` }), 1600));
});
document.getElementById('fail')!.addEventListener('click', () => {
  const running = flow.steps.find((s) => s.status === 'running');
  if (running) flow.updateStep(running.id, { status: 'error', output: 'Timed out after 30 s' });
  else {
    const parent = flow.steps[flow.steps.length - 1]?.id;
    flow.addStep({ id: `fail-${++extra}`, parents: parent, kind: 'tool', title: 'Call flaky API', detail: 'HTTP 503', status: 'error' });
  }
});
document.getElementById('reset')!.addEventListener('click', () => {
  clear();
  flow.reset();
});

simulate();
