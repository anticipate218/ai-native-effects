import '../shared/debug';
import '../../src/effects/ascii-field';
import type { AsciiFieldElement } from '../../src/effects/ascii-field';
import { CDN } from '../shared/meta';
import { attrString, mountPlayground } from '../shared/playground';

const field = document.getElementById('effect') as AsciiFieldElement;
const input = document.getElementById('custom-text') as HTMLInputElement;

mountPlayground({
  element: field,
  controlsHost: document.getElementById('controls')!,
  codeHost: document.getElementById('code')!,
  defaults: { charset: 'classic', cell: '13', color: '#4de2c5', accent: '#8f7bff', reveal: '1', 'text-y': '0.5', contrast: '1', scale: '1', interactive: 'on', speed: '1', motion: 'auto' },
  controls: [
    { type: 'select', attr: 'charset', label: 'Charset', options: ['classic', 'blocks', 'binary', 'dots', 'lines', 'katakana'], value: 'classic' },
    { type: 'range', attr: 'cell', label: 'Glyph size', min: 8, max: 28, step: 1, value: 12, unit: '' },
    { type: 'color', attr: 'color', label: 'Colour', value: '#4de2c5' },
    { type: 'color', attr: 'accent', label: 'Accent', value: '#8f7bff' },
    { type: 'range', attr: 'reveal', label: 'Text reveal', min: 0, max: 1, step: 0.05, value: 1, unit: '' },
    { type: 'range', attr: 'text-y', label: 'Text position', min: 0.2, max: 0.8, step: 0.02, value: 0.4, unit: '' },
    { type: 'range', attr: 'contrast', label: 'Contrast', min: 0.4, max: 2, step: 0.05, value: 1, unit: '' },
    { type: 'range', attr: 'scale', label: 'Flow scale', min: 0.3, max: 3, step: 0.05, value: 1, unit: '' },
    { type: 'segmented', attr: 'interactive', label: 'Interactive', options: ['on', 'off'], value: 'on' },
    { type: 'range', attr: 'speed', label: 'Speed', min: 0, max: 3, step: 0.1, value: 1 },
    { type: 'select', attr: 'motion', label: 'Motion', options: ['auto', 'reduce', 'full'], value: 'auto' },
  ],
  snippets: (attrs) => {
    const html = attrString(attrs);
    return {
      HTML: `<script type="module" src="${CDN}/effects/ascii-field.js"></script>\n\n<ane-ascii-field${html} text="HELLO" style="min-height:420px;background:#05070c">\n  <h1>Your hero, on top of the field.</h1>\n</ane-ascii-field>`,
      React: `import 'ai-native-effects/ascii-field';\n\nexport function Hero() {\n  return (\n    <ane-ascii-field${html} text="HELLO" style={{ minHeight: 420, background: '#05070c' }}>\n      <h1>Your hero, on top of the field.</h1>\n    </ane-ascii-field>\n  );\n}`,
      Vue: `<script setup lang="ts">\nimport 'ai-native-effects/ascii-field';\n</script>\n\n<template>\n  <ane-ascii-field${html} text="HELLO" style="min-height:420px;background:#05070c">\n    <h1>Your hero, on top of the field.</h1>\n  </ane-ascii-field>\n</template>`,
      'JS API': `import 'ai-native-effects/ascii-field';\n\nconst field = document.querySelector('ane-ascii-field');\nawait field.morph('SHIP');   // dissolve, then gather into a new word\nfield.shockwave();           // ripple from the centre\nawait field.dissolve();      // melt back into the field`,
    };
  },
});

const inView = (action: () => void): void => {
  field.scrollIntoView({ block: 'nearest' });
  requestAnimationFrame(() => requestAnimationFrame(action));
};
document.getElementById('custom')!.addEventListener('submit', (event) => {
  event.preventDefault();
  const value = input.value.trim().toUpperCase();
  if (value) inView(() => void field.morph(value));
});
document.getElementById('wave')!.addEventListener('click', () => inView(() => field.shockwave()));
document.getElementById('dissolve')!.addEventListener('click', () => inView(() => void field.dissolve()));
