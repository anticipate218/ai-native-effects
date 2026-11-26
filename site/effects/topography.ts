import '../shared/debug';
import '../../src/effects/topography';
import { TOPO_THEMES, type TopographyElement } from '../../src/effects/topography';
import { CDN } from '../shared/meta';
import { attrString, mountPlayground, type Playground } from '../shared/playground';

const el = document.getElementById('effect') as TopographyElement;
const copy = document.getElementById('copy')!;
const COLOR_ATTRS = ['background', 'color', 'accent'] as const;
let pg: Playground | null = null;

/** A theme switch resets the colour pickers to that theme (and drops the overrides). */
const syncTheme = (theme: string): void => {
  const preset = TOPO_THEMES[theme] ?? TOPO_THEMES.paper!;
  copy.classList.toggle('dark', theme !== 'paper');
  if (!pg) return;
  for (const attr of COLOR_ATTRS) {
    pg.set(attr, preset[attr]);
    pg.unset(attr);
  }
};

pg = mountPlayground({
  element: el,
  controlsHost: document.getElementById('controls')!,
  codeHost: document.getElementById('code')!,
  defaults: { theme: 'paper', levels: '14', 'line-width': '1.2', index: '5', scale: '1', relief: '1', ripples: 'on', fill: '0.5', shade: '0.4', grain: '0.35', speed: '1', motion: 'auto' },
  controls: [
    { type: 'select', attr: 'theme', label: 'Theme', options: Object.keys(TOPO_THEMES), value: 'paper' },
    { type: 'color', attr: 'background', label: 'Paper', value: TOPO_THEMES.paper!.background },
    { type: 'color', attr: 'color', label: 'Contours', value: TOPO_THEMES.paper!.color },
    { type: 'color', attr: 'accent', label: 'Index contours', value: TOPO_THEMES.paper!.accent },
    { type: 'range', attr: 'levels', label: 'Contour density', min: 4, max: 40, step: 1, value: 14, unit: '' },
    { type: 'range', attr: 'line-width', label: 'Line width', min: 0.5, max: 4, step: 0.1, value: 1.2, unit: '' },
    { type: 'range', attr: 'index', label: 'Index contour every', min: 0, max: 10, step: 1, value: 5, unit: '' },
    { type: 'range', attr: 'scale', label: 'Terrain scale', min: 0.3, max: 3, step: 0.05, value: 1, unit: '' },
    { type: 'range', attr: 'relief', label: 'Pointer hill', min: 0, max: 2, step: 0.05, value: 1, unit: '' },
    { type: 'segmented', attr: 'ripples', label: 'Click ripples', options: ['on', 'off'], value: 'on' },
    { type: 'range', attr: 'fill', label: 'Elevation tint', min: 0, max: 1, step: 0.05, value: 0.5, unit: '' },
    { type: 'range', attr: 'shade', label: 'Hillshade', min: 0, max: 1, step: 0.05, value: 0.4, unit: '' },
    { type: 'range', attr: 'grain', label: 'Paper grain', min: 0, max: 1, step: 0.05, value: 0.35, unit: '' },
    { type: 'range', attr: 'speed', label: 'Drift speed', min: 0, max: 3, step: 0.1, value: 1 },
    { type: 'select', attr: 'motion', label: 'Motion', options: ['auto', 'reduce', 'full'], value: 'auto' },
  ],
  onChange: (attr, value) => attr === 'theme' && value && syncTheme(value),
  snippets: (attrs) => {
    const html = attrString(attrs);
    return {
      HTML: `<script type="module" src="${CDN}/effects/topography.js"></script>\n\n<ane-topography${html} style="min-height:520px">\n  <h1>Read the land before you walk it.</h1>\n</ane-topography>`,
      React: `import 'ai-native-effects/topography';\n\nexport function Hero() {\n  return (\n    <ane-topography${html} style={{ minHeight: 520 }}>\n      <h1>Read the land before you walk it.</h1>\n    </ane-topography>\n  );\n}`,
      Vue: `<script setup lang="ts">\nimport 'ai-native-effects/topography';\n</script>\n\n<template>\n  <ane-topography${html} style="min-height:520px">\n    <h1>Read the land before you walk it.</h1>\n  </ane-topography>\n</template>`,
      'JS API': `import 'ai-native-effects/topography';\n\nconst map = document.querySelector('ane-topography');\nmap.setAttribute('theme', 'night');          // cross-fades to the dark preset\nmap.ripple(320, 180);                          // ripple from a point (CSS px)\nform.addEventListener('submit', () => map.ripple(map.clientWidth / 2, map.clientHeight / 2, 1.5));`,
    };
  },
});
syncTheme('paper');
