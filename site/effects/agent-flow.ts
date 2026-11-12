import '../shared/debug';
import '../../src/effects/agent-flow';
import { CDN } from '../shared/meta';
import { attrString, mountPlayground } from '../shared/playground';

const effect = document.getElementById('effect')!;
const viewport = document.getElementById('viewport')!;

mountPlayground({
  element: effect,
  controlsHost: document.getElementById('controls')!,
  codeHost: document.getElementById('code')!,
  defaults: { color: '#7c5cff', accent: '#5ef2ff', size: '240px', speed: '1', motion: 'auto' },
  controls: [
    { type: 'color', attr: 'color', label: 'Color', value: '#7c5cff' },
    { type: 'color', attr: 'accent', label: 'Accent', value: '#5ef2ff' },
    { type: 'range', attr: 'size', label: 'Size', min: 120, max: 360, step: 4, value: 280, unit: 'px' },
    { type: 'range', attr: 'speed', label: 'Speed', min: 0, max: 3, step: 0.1, value: 1 },
    { type: 'select', attr: 'motion', label: 'Motion', options: ['auto', 'reduce', 'full'], value: 'auto' },
  ],
  snippets: (attrs) => ({
    HTML: `<script type="module" src="${CDN}/effects/agent-flow.js"></script>\n\n<ane-agent-flow${attrString(attrs)}></ane-agent-flow>`,
    React: `import 'ai-native-effects/agent-flow';\n\nexport function Demo() {\n  return <ane-agent-flow${attrString(attrs)} />;\n}`,
    Vue: `<script setup lang="ts">\nimport 'ai-native-effects/agent-flow';\n</script>\n\n<template>\n  <ane-agent-flow${attrString(attrs)} />\n</template>`,
  }),
});

document.querySelectorAll<HTMLButtonElement>('.viewport-tools button').forEach((button) => {
  button.addEventListener('click', () => {
    viewport.dataset.bg = button.dataset.bg;
    document.querySelectorAll('.viewport-tools button').forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
  });
});
