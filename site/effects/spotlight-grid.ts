import '../shared/debug';
import '../../src/effects/spotlight-grid';
import type { SpotlightGridElement } from '../../src/effects/spotlight-grid';
import { FEATURES, GRID_STYLE } from '../scenes/spotlight-grid';
import { CDN } from '../shared/meta';
import { attrString, mountPlayground } from '../shared/playground';

const grid = document.getElementById('effect') as SpotlightGridElement;
grid.setAttribute('style', GRID_STYLE);
grid.innerHTML = FEATURES;

mountPlayground({
  element: grid,
  controlsHost: document.getElementById('controls')!,
  codeHost: document.getElementById('code')!,
  defaults: { color: '#8ab4ff', accent: '#c58bff', radius: '340px', intensity: '1', border: '1.5px', sheen: '0.75', dots: 'on', 'dot-gap': '22px', idle: 'on', speed: '1', motion: 'auto' },
  controls: [
    { type: 'color', attr: 'color', label: 'Light colour', value: '#8ab4ff' },
    { type: 'color', attr: 'accent', label: 'Accent', value: '#c58bff' },
    { type: 'range', attr: 'radius', label: 'Radius', min: 120, max: 700, step: 10, value: 340, unit: 'px' },
    { type: 'range', attr: 'intensity', label: 'Intensity', min: 0, max: 1, step: 0.05, value: 1, unit: '' },
    { type: 'range', attr: 'border', label: 'Border', min: 0.5, max: 4, step: 0.5, value: 1.5, unit: 'px' },
    { type: 'range', attr: 'sheen', label: 'Surface sheen', min: 0, max: 1, step: 0.05, value: 0.75, unit: '' },
    { type: 'segmented', attr: 'dots', label: 'Dot grid', options: ['on', 'off'], value: 'on' },
    { type: 'range', attr: 'dot-gap', label: 'Dot gap', min: 10, max: 40, step: 1, value: 22, unit: 'px' },
    { type: 'segmented', attr: 'idle', label: 'Idle drift', options: ['on', 'off'], value: 'on' },
    { type: 'range', attr: 'speed', label: 'Speed', min: 0, max: 3, step: 0.1, value: 1 },
    { type: 'select', attr: 'motion', label: 'Motion', options: ['auto', 'reduce', 'full'], value: 'auto' },
  ],
  snippets: (attrs) => {
    const html = attrString(attrs);
    const cards = `\n  <article class="card">…</article>\n  <article class="card">…</article>\n  <article class="card">…</article>\n`;
    return {
      HTML: `<script type="module" src="${CDN}/effects/spotlight-grid.js"></script>\n\n<ane-spotlight-grid${html} style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;padding:14px">${cards}</ane-spotlight-grid>`,
      React: `import 'ai-native-effects/spotlight-grid';\n\nexport function Features({ items }: { items: { title: string; body: string }[] }) {\n  return (\n    <ane-spotlight-grid${html} class="features">\n      {items.map((f) => (\n        <article key={f.title} className="card"><h3>{f.title}</h3><p>{f.body}</p></article>\n      ))}\n    </ane-spotlight-grid>\n  );\n}`,
      Vue: `<script setup lang="ts">\nimport 'ai-native-effects/spotlight-grid';\ndefineProps<{ items: { title: string; body: string }[] }>();\n</script>\n\n<template>\n  <ane-spotlight-grid${html} class="features">\n    <article v-for="f in items" :key="f.title" class="card"><h3>{{ f.title }}</h3><p>{{ f.body }}</p></article>\n  </ane-spotlight-grid>\n</template>`,
      'JS API': `import 'ai-native-effects/spotlight-grid';\n\nconst wall = document.querySelector('ane-spotlight-grid');\nwall.pulse();            // light wave from the centre\nwall.pulse(120, 80);     // …or from a point (element coordinates)`,
    };
  },
});

document.getElementById('wave')!.addEventListener('click', () => {
  grid.scrollIntoView({ block: 'nearest' });
  grid.pulse();
});
