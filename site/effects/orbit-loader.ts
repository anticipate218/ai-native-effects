import '../shared/debug';
import '../../src/effects/orbit-loader';
import type { OrbitLoaderElement } from '../../src/effects/orbit-loader';
import { CDN } from '../shared/meta';
import { attrString, mountPlayground } from '../shared/playground';

const loader = document.getElementById('effect') as OrbitLoaderElement;
const viewport = document.getElementById('viewport')!;
const log = document.getElementById('event-log')!;
const status = document.getElementById('status')!;
const pill = status.parentElement!;

const describe = (): void => {
  const progress = loader.progress;
  const [text, color] = loader.error
    ? ['failed', '#ff5d6c']
    : progress == null
      ? ['indeterminate', '#5ef2ff']
      : progress >= 1
        ? ['complete', '#3ddc97']
        : [`downloading · ${Math.round(progress * 100)}%`, '#5ef2ff'];
  status.textContent = text;
  pill.style.setProperty('--dot', color);
};

const playground = mountPlayground({
  element: loader,
  controlsHost: document.getElementById('controls')!,
  codeHost: document.getElementById('code')!,
  defaults: { satellites: '3', color: '#7c5cff', accent: '#5ef2ff', size: '240px', speed: '1', motion: 'auto' },
  controls: [
    { type: 'range', attr: 'progress', label: 'Progress', min: 0, max: 1, step: 0.01, value: 0.42, unit: '' },
    { type: 'range', attr: 'satellites', label: 'Satellites', min: 1, max: 6, step: 1, value: 3, unit: '' },
    { type: 'toggle', attr: 'show-value', label: 'Show percentage', value: true },
    { type: 'toggle', attr: 'error', label: 'Failed state', value: false },
    { type: 'color', attr: 'color', label: 'Planet color', value: '#7c5cff' },
    { type: 'color', attr: 'accent', label: 'Accent', value: '#5ef2ff' },
    { type: 'range', attr: 'size', label: 'Size', min: 120, max: 360, step: 4, value: 240, unit: 'px' },
    { type: 'range', attr: 'speed', label: 'Speed', min: 0, max: 3, step: 0.1, value: 1 },
    { type: 'select', attr: 'motion', label: 'Motion', options: ['auto', 'reduce', 'full'], value: 'auto' },
  ],
  snippets: (attrs) => {
    const { progress: _progress, ...rest } = attrs;
    const html = attrString(attrs);
    const jsx = attrString(rest);
    return {
      HTML: `<script type="module" src="${CDN}/effects/orbit-loader.js"></script>\n\n<ane-orbit-loader${html}></ane-orbit-loader>`,
      React: `import 'ai-native-effects/orbit-loader';\n\nexport function Download({ progress }: { progress?: number }) {\n  // Leave progress undefined for an indeterminate loader.\n  return <ane-orbit-loader${jsx} progress={progress} />;\n}`,
      Vue: `<script setup lang="ts">\nimport 'ai-native-effects/orbit-loader';\ndefineProps<{ progress?: number }>();\n</script>\n\n<template>\n  <ane-orbit-loader${jsx} :progress="progress" />\n</template>`,
      'JS API': `import 'ai-native-effects/orbit-loader';\n\nconst loader = document.querySelector('ane-orbit-loader');\nloader.addEventListener('ane-complete', () => console.log('all tiles downloaded'));\n\nloader.progress = null; // indeterminate while connecting\nfor await (const chunk of download(url)) {\n  loader.progress = chunk.loaded / chunk.total; // 0 … 1\n}\n// on failure: loader.error = true;`,
    };
  },
  onChange: () => describe(),
});

loader.addEventListener('ane-complete', () => {
  log.innerHTML = '<code>ane-complete</code> fired: <strong>download finished</strong>';
  describe();
});

document.querySelectorAll<HTMLButtonElement>('.viewport-tools button').forEach((button) => {
  button.addEventListener('click', () => {
    viewport.dataset.bg = button.dataset.bg;
    document.querySelectorAll('.viewport-tools button').forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
  });
});

// A scripted download: connect (indeterminate), stream chunks, finish.
let run: number[] = [];
const stop = (): void => {
  run.forEach(clearTimeout);
  run = [];
};
document.getElementById('simulate')!.addEventListener('click', () => {
  stop();
  playground.set('error', false);
  playground.unset('progress');
  let at = 1200;
  let value = 0;
  while (value < 1) {
    value = Math.min(1, value + 0.04 + Math.random() * 0.1);
    const v = Math.round(value * 100) / 100;
    run.push(window.setTimeout(() => playground.set('progress', v), at));
    at += 250 + Math.random() * 350;
  }
});
document.getElementById('indeterminate')!.addEventListener('click', () => {
  stop();
  playground.unset('progress');
});
document.getElementById('fail')!.addEventListener('click', () => {
  stop();
  playground.set('error', true);
});
