import '../shared/debug';
import '../../src/effects/hold-button';
import type { HoldButtonElement } from '../../src/effects/hold-button';
import { CDN } from '../shared/meta';
import { attrString, mountPlayground } from '../shared/playground';

const btn = document.getElementById('effect') as HoldButtonElement;
const log = document.getElementById('event-log')!;

mountPlayground({
  element: btn,
  controlsHost: document.getElementById('controls')!,
  codeHost: document.getElementById('code')!,
  defaults: { duration: '1500', color: '#ff4d5e', accent: '#2fd39a', 'reset-after': '2400', haptics: 'on', size: '48px', speed: '1', motion: 'auto' },
  controls: [
    { type: 'range', attr: 'duration', label: 'Hold time (ms)', min: 400, max: 4000, step: 100, value: 1500, unit: '' },
    { type: 'color', attr: 'color', label: 'Fill colour', value: '#ff4d5e' },
    { type: 'color', attr: 'accent', label: 'Confirmed colour', value: '#2fd39a' },
    { type: 'range', attr: 'reset-after', label: 'Reset after (ms, 0 = stay)', min: 0, max: 6000, step: 200, value: 2400, unit: '' },
    { type: 'segmented', attr: 'haptics', label: 'Haptics', options: ['on', 'off'], value: 'on' },
    { type: 'range', attr: 'size', label: 'Height', min: 36, max: 72, step: 2, value: 48, unit: 'px' },
    { type: 'range', attr: 'speed', label: 'Speed', min: 0.25, max: 3, step: 0.05, value: 1 },
    { type: 'select', attr: 'motion', label: 'Motion', options: ['auto', 'reduce', 'full'], value: 'auto' },
  ],
  snippets: (attrs) => {
    const html = attrString(attrs);
    return {
      HTML: `<script type="module" src="${CDN}/effects/hold-button.js"></script>\n\n<ane-hold-button${html} done-text="Deleted">Hold to delete</ane-hold-button>`,
      React: `import 'ai-native-effects/hold-button';\n\nexport function DeleteWorkspace({ onConfirm }: { onConfirm: () => void }) {\n  return (\n    <ane-hold-button${html} done-text="Deleted" onane-hold-complete={onConfirm}>\n      Hold to delete\n    </ane-hold-button>\n  );\n}`,
      Vue: `<script setup lang="ts">\nimport 'ai-native-effects/hold-button';\nconst emit = defineEmits<{ confirm: [] }>();\n</script>\n\n<template>\n  <ane-hold-button${html} done-text="Deleted" @ane-hold-complete="emit('confirm')">Hold to delete</ane-hold-button>\n</template>`,
      'JS API': `import 'ai-native-effects/hold-button';\n\nconst btn = document.querySelector('ane-hold-button');\nbtn.addEventListener('ane-hold-complete', () => deleteWorkspace());\nbtn.addEventListener('ane-hold-cancel', (e) => console.log('released at', e.detail.progress));\nbtn.reset();          // back to the start`,
    };
  },
});

for (const id of ['effect', 'publish', 'transfer']) {
  const el = document.getElementById(id) as HoldButtonElement;
  const name = el.textContent?.trim();
  el.addEventListener('ane-hold-start', () => (log.innerHTML = `<code>ane-hold-start</code> · ${name}`));
  el.addEventListener('ane-hold-cancel', (e) => (log.innerHTML = `<code>ane-hold-cancel</code> · released at ${Math.round(e.detail.progress * 100)}%`));
  el.addEventListener('ane-hold-complete', () => (log.innerHTML = `<code>ane-hold-complete</code> · <strong>${name}</strong>`));
}
