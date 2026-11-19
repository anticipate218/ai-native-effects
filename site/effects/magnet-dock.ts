import '../shared/debug';
import '../../src/effects/magnet-dock';
import type { MagnetDockElement } from '../../src/effects/magnet-dock';
import { DOCK_ICONS, WALLPAPER } from '../scenes/magnet-dock';
import { CDN } from '../shared/meta';
import { attrString, mountPlayground } from '../shared/playground';

const dock = document.getElementById('effect') as MagnetDockElement;
const log = document.getElementById('event-log')!;
document.getElementById('desk')!.innerHTML = WALLPAPER;
dock.innerHTML = DOCK_ICONS;

mountPlayground({
  element: dock,
  controlsHost: document.getElementById('controls')!,
  codeHost: document.getElementById('code')!,
  defaults: { size: '52px', magnify: '1.85', range: '2.6', lean: '0.35', gap: '10px', accent: '#ffffff', labels: 'auto', speed: '1', motion: 'auto' },
  controls: [
    { type: 'range', attr: 'size', label: 'Icon size', min: 32, max: 72, step: 2, value: 52, unit: 'px' },
    { type: 'range', attr: 'magnify', label: 'Magnify', min: 1, max: 3, step: 0.05, value: 1.85 },
    { type: 'range', attr: 'range', label: 'Range (icons)', min: 1, max: 6, step: 0.1, value: 2.6, unit: '' },
    { type: 'range', attr: 'lean', label: 'Lean', min: 0, max: 1, step: 0.05, value: 0.35, unit: '' },
    { type: 'range', attr: 'gap', label: 'Gap', min: 0, max: 24, step: 1, value: 10, unit: 'px' },
    { type: 'color', attr: 'accent', label: 'Accent', value: '#ffffff' },
    { type: 'segmented', attr: 'labels', label: 'Labels', options: ['auto', 'none'], value: 'auto' },
    { type: 'range', attr: 'speed', label: 'Speed', min: 0, max: 3, step: 0.1, value: 1 },
    { type: 'select', attr: 'motion', label: 'Motion', options: ['auto', 'reduce', 'full'], value: 'auto' },
  ],
  snippets: (attrs) => {
    const html = attrString(attrs);
    const items = `\n  <button aria-label="Files"><img src="/icons/files.svg" alt=""></button>\n  <button aria-label="Mail" data-active><img src="/icons/mail.svg" alt=""></button>\n  <a href="/settings" aria-label="Settings"><img src="/icons/settings.svg" alt=""></a>\n`;
    return {
      HTML: `<script type="module" src="${CDN}/effects/magnet-dock.js"></script>\n\n<ane-magnet-dock${html} aria-label="Apps">${items}</ane-magnet-dock>`,
      React: `import 'ai-native-effects/magnet-dock';\n\nexport function Dock({ apps }: { apps: { id: string; name: string; icon: string; open: boolean }[] }) {\n  return (\n    <ane-magnet-dock${html} aria-label="Apps">\n      {apps.map((app) => (\n        <button key={app.id} aria-label={app.name} data-active={app.open || undefined}>\n          <img src={app.icon} alt="" />\n        </button>\n      ))}\n    </ane-magnet-dock>\n  );\n}`,
      Vue: `<script setup lang="ts">\nimport 'ai-native-effects/magnet-dock';\ndefineProps<{ apps: { id: string; name: string; icon: string; open: boolean }[] }>();\n</script>\n\n<template>\n  <ane-magnet-dock${html} aria-label="Apps">\n    <button v-for="app in apps" :key="app.id" :aria-label="app.name" :data-active="app.open || undefined">\n      <img :src="app.icon" alt="" />\n    </button>\n  </ane-magnet-dock>\n</template>`,
      'JS API': `import 'ai-native-effects/magnet-dock';\n\nconst dock = document.querySelector('ane-magnet-dock');\ndock.addEventListener('ane-dock-launch', (e) => {\n  e.detail.item.toggleAttribute('data-active', true); // show its activity dot\n});\ndock.launch(dock.items[0]); // bounce without a click`,
    };
  },
});

// Launching an app shows its dot; launching it again "quits" it.
dock.addEventListener('ane-dock-launch', (event) => {
  const item = event.detail.item as HTMLElement;
  const name = item.getAttribute('aria-label') ?? '';
  const open = !item.hasAttribute('data-active');
  window.setTimeout(() => item.toggleAttribute('data-active', open), 450);
  log.innerHTML = `<code>ane-dock-launch</code> · <strong>${name}</strong> ${open ? 'opened' : 'quit'}`;
});
