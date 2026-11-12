import '../shared/debug';
import '../../src/effects/scan-reveal';
import type { ScanRevealElement } from '../../src/effects/scan-reveal';
import { CDN } from '../shared/meta';
import { attrString, mountPlayground } from '../shared/playground';

const scan = document.getElementById('effect') as ScanRevealElement;
const log = document.getElementById('event-log')!;

const playground = mountPlayground({
  element: scan,
  controlsHost: document.getElementById('controls')!,
  codeHost: document.getElementById('code')!,
  defaults: { analysis: '0', accent: '#5ef2ff', angle: '-9', ghost: '0.18', duration: '3600', seed: '7', speed: '1', motion: 'auto' },
  controls: [
    { type: 'range', attr: 'progress', label: 'Acquisition (drive manually)', min: 0, max: 1, step: 0.01, value: 0, unit: '' },
    { type: 'range', attr: 'analysis', label: 'Inference (drive manually)', min: 0, max: 1, step: 0.01, value: 0, unit: '' },
    { type: 'color', attr: 'accent', label: 'Scan line', value: '#5ef2ff' },
    { type: 'range', attr: 'angle', label: 'Ground-track angle (°)', min: -30, max: 30, step: 1, value: -9, unit: '' },
    { type: 'range', attr: 'ghost', label: 'Preview ghost', min: 0, max: 0.6, step: 0.02, value: 0.18, unit: '' },
    { type: 'range', attr: 'duration', label: 'Autoplay pass (ms)', min: 1500, max: 8000, step: 100, value: 3600, unit: '' },
    { type: 'range', attr: 'seed', label: 'Scene seed', min: 1, max: 40, step: 1, value: 7, unit: '' },
    { type: 'toggle', attr: 'hud', label: 'HUD', value: true },
    { type: 'toggle', attr: 'loop', label: 'Loop autoplay', value: true },
    { type: 'range', attr: 'speed', label: 'Speed', min: 0, max: 3, step: 0.1, value: 1 },
    { type: 'select', attr: 'motion', label: 'Motion', options: ['auto', 'reduce', 'full'], value: 'auto' },
  ],
  snippets: (attrs) => {
    const { progress, analysis, ...rest } = attrs;
    const html = attrString({ src: 'scene.jpg', mask: 'landcover.png', ...rest });
    const auto = attrString(rest);
    return {
      HTML: `<script type="module" src="${CDN}/effects/scan-reveal.js"></script>\n\n<!-- Your imagery and model output (CORS-enabled URLs) -->\n<ane-scan-reveal${html}\n  alt="Sentinel-2 scene with a land-cover mask"></ane-scan-reveal>\n\n<!-- Or no assets at all: a procedural scene -->\n<ane-scan-reveal${auto}></ane-scan-reveal>`,
      React: `import 'ai-native-effects/scan-reveal';\n\nexport function SceneLoader({ loaded, inferred }: { loaded: number; inferred: number }) {\n  return <ane-scan-reveal${attrString(rest)} src="/scene.jpg" mask="/mask.png" progress={loaded} analysis={inferred} />;\n}`,
      Vue: `<script setup lang="ts">\nimport 'ai-native-effects/scan-reveal';\ndefineProps<{ loaded: number; inferred: number }>();\n</script>\n\n<template>\n  <ane-scan-reveal${attrString(rest)} src="/scene.jpg" mask="/mask.png" :progress="loaded" :analysis="inferred" />\n</template>`,
      'JS API': `import 'ai-native-effects/scan-reveal';\n\nconst scan = document.querySelector('ane-scan-reveal');\nscan.addEventListener('ane-scan-complete', (e) => console.log(e.detail.pass));\n\n// Drive it from real work (any value 0..1):\nscan.progress = tilesLoaded / tilesTotal;${progress ? ` // now ${progress}` : ''}\nscan.analysis = inferenceStep / inferenceSteps;${analysis ? ` // now ${analysis}` : ''}\n\n// Or remove progress to autoplay, and replay on demand:\nscan.progress = null;\nscan.replay();`,
    };
  },
});
// Start in autoplay: the sliders switch to manual control once touched.
playground.unset('progress');
playground.unset('analysis');

scan.addEventListener('ane-scan-complete', (event) => {
  log.innerHTML = `<code>ane-scan-complete</code> · <strong>${event.detail.pass}</strong>`;
});

document.getElementById('replay')!.addEventListener('click', () => {
  playground.unset('progress');
  playground.unset('analysis');
  scan.replay();
  // The scan pauses while off-screen; bring it into view so the replay is actually seen
  // (on phones the button sits far below the preview).
  const smooth = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  scan.scrollIntoView({ block: 'nearest', behavior: smooth ? 'smooth' : 'auto' });
});
