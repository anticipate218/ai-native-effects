import '../shared/debug';
import '../../src/effects/image-reveal';
import type { ImageRevealElement } from '../../src/effects/image-reveal';
import { CDN } from '../shared/meta';
import { attrString, mountPlayground } from '../shared/playground';

const reveal = document.getElementById('effect') as ImageRevealElement;
const log = document.getElementById('event-log')!;

const playground = mountPlayground({
  element: reveal,
  controlsHost: document.getElementById('controls')!,
  codeHost: document.getElementById('code')!,
  defaults: { steps: '30', duration: '4200', latent: '8', noise: 'color', seed: '7', accent: '#b48cff', speed: '1', motion: 'auto' },
  controls: [
    { type: 'range', attr: 'progress', label: 'Progress (drive manually)', min: 0, max: 1, step: 0.01, value: 0, unit: '' },
    { type: 'range', attr: 'steps', label: 'Sampler steps', min: 10, max: 60, step: 1, value: 30, unit: '' },
    { type: 'range', attr: 'duration', label: 'Autoplay length (ms)', min: 1500, max: 10000, step: 100, value: 4200, unit: '' },
    { type: 'segmented', attr: 'noise', label: 'Noise', options: ['color', 'mono'], value: 'color' },
    { type: 'range', attr: 'latent', label: 'Latent block (px)', min: 2, max: 24, step: 1, value: 8, unit: '' },
    { type: 'range', attr: 'seed', label: 'Seed', min: 1, max: 40, step: 1, value: 7, unit: '' },
    { type: 'color', attr: 'accent', label: 'Accent', value: '#b48cff' },
    { type: 'toggle', attr: 'compare', label: 'Compare slider when done', value: true },
    { type: 'toggle', attr: 'hud', label: 'HUD', value: true },
    { type: 'toggle', attr: 'loop', label: 'Loop autoplay', value: false },
    { type: 'range', attr: 'speed', label: 'Speed', min: 0, max: 3, step: 0.1, value: 1 },
    { type: 'select', attr: 'motion', label: 'Motion', options: ['auto', 'reduce', 'full'], value: 'auto' },
  ],
  snippets: (attrs) => {
    const { progress: _progress, ...rest } = attrs;
    const html = attrString(rest);
    return {
      HTML: `<script type="module" src="${CDN}/effects/image-reveal.js"></script>\n\n<ane-image-reveal${html}\n  src="/generated/result.png" caption="A lighthouse in fog, golden hour"\n  alt="Generated image: a lighthouse in fog"></ane-image-reveal>`,
      React: `import 'ai-native-effects/image-reveal';\n\nexport function Generation({ url, step, steps }: { url: string; step: number; steps: number }) {\n  return <ane-image-reveal${html} src={url} steps={steps} progress={step / steps} />;\n}`,
      Vue: `<script setup lang="ts">\nimport 'ai-native-effects/image-reveal';\ndefineProps<{ url: string; step: number; steps: number }>();\n</script>\n\n<template>\n  <ane-image-reveal${html} :src="url" :steps="steps" :progress="step / steps" />\n</template>`,
      'JS API': `import 'ai-native-effects/image-reveal';\n\nconst reveal = document.querySelector('ane-image-reveal');\nreveal.setAttribute('steps', String(job.steps));\n\n// Stream sampler progress from your backend:\njob.on('step', (i) => (reveal.progress = i / job.steps));\njob.on('done', (url) => reveal.setAttribute('src', url));\n\nreveal.addEventListener('ane-reveal-complete', () => enableDownload());\nreveal.split = 0.3; // compare divider (when \`compare\` is set)`,
    };
  },
});
// Start in autoplay; the progress slider switches to manual control once touched.
playground.unset('progress');

reveal.addEventListener('ane-reveal-complete', (event) => {
  log.innerHTML = `<code>ane-reveal-complete</code> · <strong>${event.detail.steps} steps</strong>`;
});

let timers: number[] = [];
const scrollToPreview = (): void => {
  const smooth = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  reveal.scrollIntoView({ block: 'nearest', behavior: smooth ? 'smooth' : 'auto' });
};
document.getElementById('generate')!.addEventListener('click', () => {
  timers.forEach(clearTimeout);
  playground.unset('progress');
  reveal.replay();
  scrollToPreview();
});
// A server-driven run: uneven step timings, like a real sampler queue.
document.getElementById('simulate')!.addEventListener('click', () => {
  timers.forEach(clearTimeout);
  const steps = reveal.steps;
  playground.set('progress', 0);
  reveal.replay();
  let at = 400;
  timers = Array.from({ length: steps }, (_, i) => {
    at += 70 + Math.random() * 160;
    return window.setTimeout(() => playground.set('progress', Math.round(((i + 1) / steps) * 1000) / 1000), at);
  });
  scrollToPreview();
});
