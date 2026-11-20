import '../shared/debug';
import '../../src/effects/tilt-holo-card';
import type { TiltHoloCardElement } from '../../src/effects/tilt-holo-card';
import { CARD_FACE } from '../scenes/tilt-holo-card';
import { CDN } from '../shared/meta';
import { attrString, mountPlayground } from '../shared/playground';

const card = document.getElementById('effect') as TiltHoloCardElement;
// The face is a link, so keyboard users can reach the card (focus tilts it too).
card.innerHTML = `<a href="#api-title" class="hc-link" style="display:block;color:inherit;text-decoration:none;outline-offset:-5px">${CARD_FACE}</a>`;

mountPlayground({
  element: card,
  controlsHost: document.getElementById('controls')!,
  codeHost: document.getElementById('code')!,
  defaults: { size: '300px', tilt: '16', foil: 'sparkle', 'foil-strength': '0.85', sheen: '0.55', glare: '0.8', blend: 'color-dodge', hue: '0', radius: '18px', idle: 'on', speed: '1', motion: 'auto' },
  controls: [
    { type: 'segmented', attr: 'foil', label: 'Foil', options: ['sparkle', 'lines', 'scales', 'none'], value: 'sparkle' },
    { type: 'range', attr: 'tilt', label: 'Max tilt (°)', min: 0, max: 35, step: 1, value: 16, unit: '' },
    { type: 'range', attr: 'foil-strength', label: 'Foil strength', min: 0, max: 1, step: 0.05, value: 0.85, unit: '' },
    { type: 'range', attr: 'sheen', label: 'Sheen', min: 0, max: 1, step: 0.05, value: 0.55, unit: '' },
    { type: 'range', attr: 'glare', label: 'Glare', min: 0, max: 1, step: 0.05, value: 0.8, unit: '' },
    { type: 'select', attr: 'blend', label: 'Foil blend', options: ['color-dodge', 'screen', 'overlay', 'soft-light', 'hard-light', 'plus-lighter'], value: 'color-dodge' },
    { type: 'range', attr: 'hue', label: 'Hue shift (°)', min: -180, max: 180, step: 5, value: 0, unit: '' },
    { type: 'range', attr: 'size', label: 'Width', min: 200, max: 360, step: 4, value: 300, unit: 'px' },
    { type: 'range', attr: 'radius', label: 'Radius', min: 0, max: 36, step: 1, value: 18, unit: 'px' },
    { type: 'segmented', attr: 'idle', label: 'Idle sway', options: ['on', 'off'], value: 'on' },
    { type: 'range', attr: 'speed', label: 'Speed', min: 0, max: 3, step: 0.1, value: 1 },
    { type: 'select', attr: 'motion', label: 'Motion', options: ['auto', 'reduce', 'full'], value: 'auto' },
  ],
  snippets: (attrs) => {
    const html = attrString(attrs);
    return {
      HTML: `<script type="module" src="${CDN}/effects/tilt-holo-card.js"></script>\n\n<ane-tilt-holo-card${html} ratio="5/7">\n  <img src="/pass.png" alt="Founder pass for Mira Sol" style="width:100%;height:100%;object-fit:cover">\n</ane-tilt-holo-card>`,
      React: `import 'ai-native-effects/tilt-holo-card';\n\nexport function Pass({ name }: { name: string }) {\n  return (\n    <ane-tilt-holo-card${html} ratio="5/7">\n      <a href="/pass" className="pass-face">\n        <span>Founder pass</span>\n        <strong>{name}</strong>\n      </a>\n    </ane-tilt-holo-card>\n  );\n}`,
      Vue: `<script setup lang="ts">\nimport 'ai-native-effects/tilt-holo-card';\ndefineProps<{ name: string }>();\n</script>\n\n<template>\n  <ane-tilt-holo-card${html} ratio="5/7">\n    <a href="/pass" class="pass-face"><span>Founder pass</span><strong>{{ name }}</strong></a>\n  </ane-tilt-holo-card>\n</template>`,
      'JS API': `import 'ai-native-effects/tilt-holo-card';\n\nconst card = document.querySelector('ane-tilt-holo-card');\ncard.setAttribute('gyro', '');      // follow the phone's tilt (iOS asks on first tap)\ncard.setAttribute('foil', 'scales');\nconsole.log(card.tiltAngles);         // [rotateX, rotateY] in degrees`,
    };
  },
});
