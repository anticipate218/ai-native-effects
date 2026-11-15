import '../shared/debug';
import '../../src/effects/glass-lens';
import type { GlassLensElement } from '../../src/effects/glass-lens';
import { CDN } from '../shared/meta';
import { attrString, mountPlayground } from '../shared/playground';

const lens = document.getElementById('effect') as GlassLensElement;
const log = document.getElementById('event-log')!;

mountPlayground({
  element: lens,
  controlsHost: document.getElementById('controls')!,
  codeHost: document.getElementById('code')!,
  defaults: { mode: 'follow', rate: '320', strength: '0.5', dispersion: '0.4', curvature: '0.55', bend: '0.45', accent: '#7c5cff', speed: '1', motion: 'auto' },
  controls: [
    { type: 'segmented', attr: 'mode', label: 'Mode', options: ['read', 'follow', 'static'], value: 'read' },
    { type: 'range', attr: 'strength', label: 'Refraction', min: 0, max: 1, step: 0.05, value: 0.5, unit: '' },
    { type: 'range', attr: 'dispersion', label: 'Dispersion', min: 0, max: 1, step: 0.05, value: 0.4, unit: '' },
    { type: 'range', attr: 'curvature', label: 'Curvature (magnify)', min: 0, max: 1, step: 0.05, value: 0.55, unit: '' },
    { type: 'range', attr: 'bend', label: 'Rim bend', min: 0, max: 1, step: 0.05, value: 0.45, unit: '' },
    { type: 'range', attr: 'rate', label: 'Reading speed (px/s)', min: 80, max: 900, step: 20, value: 320, unit: '' },
    { type: 'color', attr: 'accent', label: 'Highlight', value: '#7c5cff' },
    { type: 'toggle', attr: 'loop', label: 'Loop reading', value: true },
    { type: 'range', attr: 'speed', label: 'Speed', min: 0, max: 3, step: 0.1, value: 1 },
    { type: 'select', attr: 'motion', label: 'Motion', options: ['auto', 'reduce', 'full'], value: 'auto' },
  ],
  snippets: (attrs) => {
    const html = attrString(attrs);
    return {
      HTML: `<script type="module" src="${CDN}/effects/glass-lens.js"></script>\n\n<ane-glass-lens${html}>\n  <article>\n    <p>Discharge rose after heavy rain. <mark>The river peaked on 11 June</mark> …</p>\n  </article>\n</ane-glass-lens>`,
      React: `import 'ai-native-effects/glass-lens';\n\nexport function SourceCard({ children }: { children: React.ReactNode }) {\n  // Wrap the passage the assistant is reading; <mark> marks its citations.\n  return <ane-glass-lens${html}>{children}</ane-glass-lens>;\n}`,
      Vue: `<script setup lang="ts">\nimport 'ai-native-effects/glass-lens';\n</script>\n\n<template>\n  <ane-glass-lens${html}>\n    <slot />\n  </ane-glass-lens>\n</template>`,
      'JS API': `import 'ai-native-effects/glass-lens';\n\nconst lens = document.querySelector('ane-glass-lens');\nlens.addEventListener('ane-lens-mark', (e) => cite(e.detail.element));\nlens.addEventListener('ane-lens-done', (e) => console.log(e.detail.found, 'citations'));\n\nlens.read();                        // start a reading pass\nlens.focusOn(document.querySelector('#figure-2')); // glance at an element\nlens.stop();`,
    };
  },
});

let found = 0;
lens.addEventListener('ane-lens-mark', (event) => {
  found += 1;
  log.innerHTML = `<code>ane-lens-mark</code> #${event.detail.index + 1}: <strong>${(event.detail.element.textContent ?? '').trim().slice(0, 48)}</strong>`;
});
lens.addEventListener('ane-lens-done', () => {
  log.innerHTML = `<code>ane-lens-done</code> · <strong>${found} citations</strong>`;
});
document.getElementById('read')!.addEventListener('click', () => {
  found = 0;
  lens.setAttribute('mode', 'read');
  lens.read();
});
