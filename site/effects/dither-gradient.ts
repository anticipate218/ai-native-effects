import '../shared/debug';
import '../../src/effects/dither-gradient';
import type { DitherGradientElement } from '../../src/effects/dither-gradient';
import { CDN } from '../shared/meta';
import { attrString, mountPlayground } from '../shared/playground';

const el = document.getElementById('effect') as DitherGradientElement;

mountPlayground({
  element: el,
  controlsHost: document.getElementById('controls')!,
  codeHost: document.getElementById('code')!,
  defaults: { palette: 'auto', pixel: '3', dither: 'bayer8', spread: '1', scale: '1', lens: 'on', 'lens-size': '90', speed: '1', motion: 'auto' },
  controls: [
    { type: 'select', attr: 'palette', label: 'Palette', options: ['auto', 'sunset', 'paper', 'gameboy', 'mono', 'cga', 'ocean'], value: 'sunset' },
    { type: 'segmented', attr: 'dither', label: 'Dither', options: ['bayer8', 'bayer4', 'noise'], value: 'bayer8' },
    { type: 'range', attr: 'pixel', label: 'Pixel size', min: 1, max: 12, step: 1, value: 3, unit: '' },
    { type: 'range', attr: 'spread', label: 'Dither strength', min: 0, max: 2, step: 0.05, value: 1, unit: '' },
    { type: 'range', attr: 'scale', label: 'Flow scale', min: 0.3, max: 3, step: 0.05, value: 1, unit: '' },
    { type: 'segmented', attr: 'lens', label: 'Lens', options: ['on', 'off'], value: 'on' },
    { type: 'range', attr: 'lens-size', label: 'Lens size', min: 30, max: 240, step: 5, value: 90, unit: '' },
    { type: 'range', attr: 'speed', label: 'Speed', min: 0, max: 3, step: 0.1, value: 1 },
    { type: 'select', attr: 'motion', label: 'Motion', options: ['auto', 'reduce', 'full'], value: 'auto' },
  ],
  snippets: (attrs) => {
    const html = attrString(attrs);
    return {
      HTML: `<script type="module" src="${CDN}/effects/dither-gradient.js"></script>\n\n<ane-dither-gradient${html} style="min-height:480px">\n  <h1>Your hero, on a dithered gradient.</h1>\n</ane-dither-gradient>`,
      React: `import 'ai-native-effects/dither-gradient';\n\nexport function Hero() {\n  return (\n    <ane-dither-gradient${html} style={{ minHeight: 480 }}>\n      <h1>Your hero, on a dithered gradient.</h1>\n    </ane-dither-gradient>\n  );\n}`,
      Vue: `<script setup lang="ts">\nimport 'ai-native-effects/dither-gradient';\n</script>\n\n<template>\n  <ane-dither-gradient${html} style="min-height:480px">\n    <h1>Your hero, on a dithered gradient.</h1>\n  </ane-dither-gradient>\n</template>`,
      'JS API': `import 'ai-native-effects/dither-gradient';\n\nconst bg = document.querySelector('ane-dither-gradient');\nbg.setAttribute('colors', '#0b132b,#3a506b,#5bc0be,#f2f5ea');\nbg.setAttribute('palette', 'mono');      // print-like two-tone\nbg.setAttribute('src', '/poster.jpg');   // or dither a photo`,
    };
  },
});

/** A photo-like picture drawn in code (sun, hills, water), so the demo needs no image asset. */
function scenicImage(): string {
  const c = document.createElement('canvas');
  c.width = 640;
  c.height = 400;
  const g = c.getContext('2d')!;
  const sky = g.createLinearGradient(0, 0, 0, 400);
  sky.addColorStop(0, '#2b1e4f');
  sky.addColorStop(0.55, '#f08a5d');
  sky.addColorStop(1, '#fbd38d');
  g.fillStyle = sky;
  g.fillRect(0, 0, 640, 400);
  const sun = g.createRadialGradient(420, 200, 10, 420, 200, 90);
  sun.addColorStop(0, '#fff6d8');
  sun.addColorStop(1, 'rgba(255,214,140,0)');
  g.fillStyle = sun;
  g.fillRect(0, 0, 640, 400);
  const hill = (y: number, amp: number, color: string, seed: number): void => {
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(0, 400);
    for (let x = 0; x <= 640; x += 8) g.lineTo(x, y - amp * (0.6 * Math.sin(x / 90 + seed) + 0.4 * Math.sin(x / 37 + seed * 2)));
    g.lineTo(640, 400);
    g.fill();
  };
  hill(250, 40, '#7a3b69', 1);
  hill(290, 30, '#4a2550', 3);
  hill(330, 20, '#25163a', 5);
  return c.toDataURL('image/png');
}

document.getElementById('use-image')!.addEventListener('click', () => el.setAttribute('src', scenicImage()));
document.getElementById('use-gradient')!.addEventListener('click', () => el.removeAttribute('src'));
