import '../shared/debug';
import '../../src/effects/orbit-loading-screen';
import type { OrbitLoadingScreenElement } from '../../src/effects/orbit-loading-screen';
import { CDN } from '../shared/meta';
import { attrString, mountPlayground } from '../shared/playground';

const screen = document.getElementById('effect') as OrbitLoadingScreenElement;
const log = document.getElementById('event-log')!;
const STEPS = 'Authenticate|Query catalog|Download tiles|Build mosaic';

const playground = mountPlayground({
  element: screen,
  controlsHost: document.getElementById('controls')!,
  codeHost: document.getElementById('code')!,
  defaults: { step: '0', satellites: '2', accent: '#5ef2ff', color: '#6aa6ff', size: '480px', speed: '1', motion: 'auto' },
  controls: [
    { type: 'range', attr: 'progress', label: 'Progress', min: 0, max: 1, step: 0.01, value: 0.62, unit: '' },
    { type: 'range', attr: 'step', label: 'Active step', min: 0, max: 3, step: 1, value: 2, unit: '' },
    { type: 'range', attr: 'satellites', label: 'Satellites', min: 0, max: 4, step: 1, value: 2, unit: '' },
    { type: 'toggle', attr: 'error', label: 'Failed state', value: false },
    { type: 'color', attr: 'accent', label: 'Accent', value: '#5ef2ff' },
    { type: 'color', attr: 'color', label: 'Atmosphere', value: '#6aa6ff' },
    { type: 'range', attr: 'size', label: 'Height', min: 360, max: 720, step: 10, value: 480, unit: 'px' },
    { type: 'range', attr: 'speed', label: 'Speed', min: 0, max: 3, step: 0.1, value: 1 },
    { type: 'select', attr: 'motion', label: 'Motion', options: ['auto', 'reduce', 'full'], value: 'auto' },
  ],
  snippets: (attrs) => {
    const { progress: _progress, step: _step, error: _error, ...rest } = attrs;
    const html = attrString({ heading: 'Downloading imagery', steps: STEPS, ...attrs });
    const jsx = attrString({ heading: 'Downloading imagery', steps: STEPS, ...rest });
    return {
      HTML: `<script type="module" src="${CDN}/effects/orbit-loading-screen.js"></script>\n\n<ane-orbit-loading-screen${html}>\n  <button slot="actions">Cancel</button>\n</ane-orbit-loading-screen>`,
      React: `import 'ai-native-effects/orbit-loading-screen';\n\nexport function Loading({ progress, step }: { progress?: number; step: number }) {\n  // Leave progress undefined while the total size is unknown.\n  return <ane-orbit-loading-screen${jsx} progress={progress} step={step} />;\n}`,
      Vue: `<script setup lang="ts">\nimport 'ai-native-effects/orbit-loading-screen';\ndefineProps<{ progress?: number; step: number }>();\n</script>\n\n<template>\n  <ane-orbit-loading-screen${jsx} :progress="progress" :step="step" />\n</template>`,
      'JS API': `import 'ai-native-effects/orbit-loading-screen';\n\nconst screen = document.querySelector('ane-orbit-loading-screen');\nscreen.steps = ['Authenticate', 'Query catalog', 'Download tiles', 'Build mosaic'];\nscreen.addEventListener('ane-complete', () => openWorkspace());\n\nscreen.step = 2;\nscreen.progress = null; // indeterminate until the size is known\nfor await (const chunk of download(url)) {\n  screen.progress = chunk.loaded / chunk.total;\n  screen.setAttribute('detail', \`\${gb(chunk.loaded)} of \${gb(chunk.total)}\`);\n}\n// on failure: screen.error = true;`,
    };
  },
});

screen.addEventListener('ane-complete', () => {
  log.innerHTML = '<code>ane-complete</code> fired: <strong>download finished</strong>';
});

// Full-screen preview: the component covers the viewport; Esc or the slotted button exits.
const exit = document.createElement('button');
exit.type = 'button';
exit.slot = 'actions';
exit.className = 'btn small';
exit.textContent = 'Exit full screen';
const setFullscreen = (on: boolean): void => {
  screen.toggleAttribute('fullscreen', on);
  if (on) {
    screen.append(exit);
    // The actions area un-hides on slotchange (async), so focus on the next frame.
    requestAnimationFrame(() => exit.focus());
  } else {
    exit.remove();
    document.getElementById('fullscreen')!.focus();
  }
};
document.getElementById('fullscreen')!.addEventListener('click', () => setFullscreen(true));
exit.addEventListener('click', () => setFullscreen(false));
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && screen.hasAttribute('fullscreen')) setFullscreen(false);
});

// A scripted download: search (indeterminate), stream chunks, build the mosaic, done.
let run: number[] = [];
const stop = (): void => {
  run.forEach(clearTimeout);
  run = [];
};
const at = (ms: number, action: () => void): void => {
  run.push(window.setTimeout(action, ms));
};
document.getElementById('simulate')!.addEventListener('click', () => {
  stop();
  playground.set('error', false);
  playground.set('step', 1);
  playground.unset('progress');
  screen.setAttribute('eyebrow', 'Sentinel-2 · Level-2A');
  screen.setAttribute('heading', 'Searching the catalog');
  screen.setAttribute('detail', 'Western Europe · Jun 2026 · cloud < 10%');
  screen.setAttribute('status', 'GET /odata/v1/Products?$filter=… 200');
  let t = 1600;
  at(t, () => {
    playground.set('step', 2);
    playground.set('progress', 0);
    screen.setAttribute('heading', 'Downloading imagery');
  });
  let value = 0;
  let i = 0;
  while (value < 1) {
    value = Math.min(1, Math.round((value + 0.03 + Math.random() * 0.08) * 100) / 100);
    const v = value;
    const n = ++i;
    t += 260 + Math.random() * 320;
    at(t, () => {
      if (v >= 0.9) playground.set('step', 3);
      playground.set('progress', v);
      screen.setAttribute('detail', `${(v * 1.94).toFixed(2)} GB of 1.94 GB · ${36 + (n % 5) * 2} MB/s`);
      screen.setAttribute('status', `tile T3${n % 3}U${'FGL'[n % 3]}U · cloud ${(n * 7) % 9}% · ${Math.round(v * 142)}/142`);
    });
  }
  at(t + 900, () => {
    screen.setAttribute('eyebrow', 'Ready');
    screen.setAttribute('heading', 'Mosaic ready to explore');
    screen.setAttribute('detail', '142 tiles · 1.94 GB');
    screen.setAttribute('status', '');
  });
});
document.getElementById('indeterminate')!.addEventListener('click', () => {
  stop();
  playground.unset('progress');
});
document.getElementById('fail')!.addEventListener('click', () => {
  stop();
  playground.set('error', true);
  screen.setAttribute('heading', 'Download interrupted');
  screen.setAttribute('detail', 'Connection reset by the archive · retrying in 30 s');
});
