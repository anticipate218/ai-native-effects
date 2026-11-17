import '../shared/debug';
import '../../src/effects/aurora';
import type { AuroraElement } from '../../src/effects/aurora';
import { CDN } from '../shared/meta';
import { attrString, mountPlayground } from '../shared/playground';

const aurora = document.getElementById('effect') as AuroraElement;

mountPlayground({
  element: aurora,
  controlsHost: document.getElementById('controls')!,
  codeHost: document.getElementById('code')!,
  defaults: { palette: 'borealis', intensity: '1', rays: '0.8', stars: '1', horizon: '1', grain: '0.22', quality: '0.75', seed: '7', speed: '1', motion: 'auto' },
  controls: [
    { type: 'segmented', attr: 'palette', label: 'Palette', options: ['borealis', 'dusk', 'glacier', 'ember'], value: 'borealis' },
    { type: 'range', attr: 'intensity', label: 'Intensity', min: 0, max: 2, step: 0.05, value: 1, unit: '' },
    { type: 'range', attr: 'rays', label: 'Rays', min: 0, max: 1, step: 0.05, value: 0.8, unit: '' },
    { type: 'range', attr: 'stars', label: 'Stars', min: 0, max: 2, step: 0.1, value: 1, unit: '' },
    { type: 'range', attr: 'horizon', label: 'Mountains', min: 0, max: 1, step: 0.05, value: 1, unit: '' },
    { type: 'range', attr: 'grain', label: 'Film grain', min: 0, max: 1, step: 0.02, value: 0.22, unit: '' },
    { type: 'range', attr: 'seed', label: 'Shape seed', min: 1, max: 40, step: 1, value: 7, unit: '' },
    { type: 'toggle', attr: 'interactive', label: 'Lean towards the pointer', value: true },
    { type: 'range', attr: 'quality', label: 'Render scale', min: 0.25, max: 1, step: 0.05, value: 0.75, unit: '' },
    { type: 'range', attr: 'speed', label: 'Speed', min: 0, max: 3, step: 0.1, value: 1 },
    { type: 'select', attr: 'motion', label: 'Motion', options: ['auto', 'reduce', 'full'], value: 'auto' },
  ],
  snippets: (attrs) => {
    const html = attrString(attrs);
    return {
      HTML: `<script type="module" src="${CDN}/effects/aurora.js"></script>\n\n<ane-aurora${html} style="min-height: 100vh">\n  <header>…</header>\n  <h1>Light up the quiet hours.</h1>\n  <a class="cta" href="/signup">Start for free</a>\n</ane-aurora>`,
      React: `import 'ai-native-effects/aurora';\n\nexport function Hero() {\n  return (\n    <ane-aurora${html} style={{ minHeight: '100vh' }}>\n      <h1>Light up the quiet hours.</h1>\n      <a href="/signup">Start for free</a>\n    </ane-aurora>\n  );\n}`,
      Vue: `<script setup lang="ts">\nimport 'ai-native-effects/aurora';\n</script>\n\n<template>\n  <ane-aurora${html} style="min-height: 100vh">\n    <h1>Light up the quiet hours.</h1>\n    <a href="/signup">Start for free</a>\n  </ane-aurora>\n</template>`,
    };
  },
});
