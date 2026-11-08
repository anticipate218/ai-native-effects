import '../shared/debug';
import { BUDDY_STATES, type BuddyState, type ThinkingBuddyElement } from '../../src/effects/thinking-buddy';
import '../../src/effects/thinking-buddy';
import { CDN } from '../shared/meta';
import { attrString, mountPlayground } from '../shared/playground';

const buddy = document.getElementById('buddy') as ThinkingBuddyElement;
const status = document.getElementById('status')!;
const pill = status.parentElement!;
const viewport = document.getElementById('viewport')!;
const log = document.getElementById('event-log')!;

const COLORS: Record<BuddyState, string> = {
  idle: '#5ef2ff',
  thinking: '#5ef2ff',
  waiting: '#ffb547',
  success: '#3ddc97',
  error: '#ff5d6c',
};

const playground = mountPlayground({
  element: buddy,
  controlsHost: document.getElementById('controls')!,
  codeHost: document.getElementById('code')!,
  defaults: { state: 'idle', color: '#7c5cff', accent: '#5ef2ff', size: '160px', speed: '1', motion: 'auto' },
  controls: [
    { type: 'segmented', attr: 'state', label: 'State', options: BUDDY_STATES, value: 'thinking' },
    { type: 'color', attr: 'color', label: 'Body color', value: '#7c5cff' },
    { type: 'color', attr: 'accent', label: 'Accent', value: '#5ef2ff' },
    { type: 'range', attr: 'size', label: 'Size', min: 80, max: 320, step: 4, value: 240, unit: 'px' },
    { type: 'range', attr: 'speed', label: 'Speed', min: 0, max: 3, step: 0.1, value: 1 },
    { type: 'select', attr: 'motion', label: 'Motion', options: ['auto', 'reduce', 'full'], value: 'auto' },
    { type: 'toggle', attr: 'interactive', label: 'Eyes follow the pointer', value: true },
  ],
  snippets: (attrs) => {
    const { state = 'idle', ...rest } = attrs;
    const html = attrString({ state, ...rest });
    const jsx = attrString(rest);
    return {
      HTML: `<script type="module" src="${CDN}/effects/thinking-buddy.js"></script>\n\n<ane-thinking-buddy${html}></ane-thinking-buddy>`,
      React: `import 'ai-native-effects/thinking-buddy';\n\nexport function AgentStatus({ state }: { state: string }) {\n  return <ane-thinking-buddy${jsx} state={state} />;\n}`,
      Vue: `<script setup lang="ts">\nimport 'ai-native-effects/thinking-buddy';\ndefineProps<{ state: string }>();\n</script>\n\n<template>\n  <ane-thinking-buddy${jsx} :state="state" />\n</template>`,
      'JS API': `import 'ai-native-effects/thinking-buddy';\n\nconst buddy = document.querySelector('ane-thinking-buddy');\n\nbuddy.addEventListener('ane-statechange', (e) => {\n  console.log(e.detail.previous, '→', e.detail.state);\n});\n\nbuddy.state = 'thinking';\nconst result = await runAgent();\nbuddy.state = result.ok ? 'success' : 'error';`,
    };
  },
  onChange: (attr, value) => {
    if (attr === 'state' && value) {
      status.textContent = value;
      pill.style.setProperty('--dot', COLORS[value as BuddyState] ?? '#5ef2ff');
    }
  },
});

buddy.addEventListener('ane-statechange', (event) => {
  log.innerHTML = `<code>ane-statechange</code> ${event.detail.previous} → <strong>${event.detail.state}</strong>`;
});

// Background switcher.
document.querySelectorAll<HTMLButtonElement>('.viewport-tools button').forEach((button) => {
  button.addEventListener('click', () => {
    viewport.dataset.bg = button.dataset.bg;
    document.querySelectorAll('.viewport-tools button').forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
  });
});

// A scripted agent run: what the buddy looks like inside a real product.
let run: number[] = [];
document.getElementById('simulate')!.addEventListener('click', () => {
  run.forEach(clearTimeout);
  const fail = Math.random() < 0.3;
  const steps: Array<[number, BuddyState]> = [
    [0, 'thinking'],
    [1800, 'waiting'],
    [3000, 'thinking'],
    [4200, fail ? 'error' : 'success'],
    [7000, 'idle'],
  ];
  run = steps.map(([at, state]) => window.setTimeout(() => playground.set('state', state), at));
});
document.getElementById('replay')!.addEventListener('click', () => buddy.replay());
document.getElementById('boop')!.addEventListener('click', () => buddy.boop());
