import '../shared/debug';
import '../../src/effects/orbit-gallery';
import type { OrbitGalleryElement } from '../../src/effects/orbit-gallery';
import { CDN } from '../shared/meta';
import { attrString, mountPlayground } from '../shared/playground';
import { ALBUMS, COVER_CSS, covers } from '../scenes/orbit-gallery';

const el = document.getElementById('effect') as OrbitGalleryElement;
const now = document.getElementById('now')!;
const log = document.getElementById('event-log')!;

const style = document.createElement('style');
style.textContent = COVER_CSS;
document.head.append(style);
el.innerHTML = covers();

const show = (i: number): void => {
  const a = ALBUMS[i]!;
  now.innerHTML = `${a.title}<small>${a.artist} · ${a.year}</small>`;
};
show(0);
el.addEventListener('ane-orbit-change', (e) => {
  show(e.detail.index);
  log.innerHTML = `<code>ane-orbit-change</code> · index ${e.detail.index}`;
});
document.getElementById('prev')!.addEventListener('click', () => el.prev());
document.getElementById('next')!.addEventListener('click', () => el.next());
// The covers are links: on the front card they would navigate; in the demo, just log it.
el.addEventListener('click', (e) => {
  const a = (e.target as HTMLElement).closest('a');
  if (!a) return;
  e.preventDefault();
  log.innerHTML = `Opened <strong>${a.getAttribute('aria-label')}</strong> (the front card's link fires; side cards turn instead)`;
});

mountPlayground({
  element: el,
  controlsHost: document.getElementById('controls')!,
  codeHost: document.getElementById('code')!,
  defaults: { 'card-width': '200', tilt: '10', facing: '0.6', pop: '0.12', dim: '0.6', perspective: '1400', autoplay: '0', wheel: 'horizontal', reflect: '', accent: '#8b7bff', speed: '1', motion: 'auto' },
  controls: [
    { type: 'range', attr: 'card-width', label: 'Card width', min: 100, max: 280, step: 5, value: 170, unit: '' },
    { type: 'range', attr: 'tilt', label: 'Tilt (degrees)', min: -30, max: 30, step: 1, value: 10, unit: '' },
    { type: 'range', attr: 'facing', label: 'Facing', min: 0, max: 1, step: 0.05, value: 0.6, unit: '' },
    { type: 'range', attr: 'pop', label: 'Front card pop', min: 0, max: 0.5, step: 0.01, value: 0.12, unit: '' },
    { type: 'range', attr: 'dim', label: 'Dim towards the back', min: 0, max: 1, step: 0.05, value: 0.6, unit: '' },
    { type: 'range', attr: 'perspective', label: 'Perspective', min: 400, max: 3000, step: 50, value: 1400, unit: '' },
    { type: 'range', attr: 'autoplay', label: 'Autoplay (ms, 0 = off)', min: 0, max: 6000, step: 250, value: 0, unit: '' },
    { type: 'segmented', attr: 'wheel', label: 'Wheel', options: ['horizontal', 'on', 'off'], value: 'horizontal' },
    { type: 'toggle', attr: 'reflect', label: 'Floor reflection', value: true },
    { type: 'color', attr: 'accent', label: 'Accent', value: '#8b7bff' },
    { type: 'select', attr: 'motion', label: 'Motion', options: ['auto', 'reduce', 'full'], value: 'auto' },
  ],
  snippets: (attrs) => {
    const html = attrString(attrs);
    const cards = `  <a href="/albums/night-swim"><img src="night-swim.jpg" alt="Night Swim"></a>\n  <a href="/albums/static-bloom"><img src="static-bloom.jpg" alt="Static Bloom"></a>\n  <!-- … any elements: images, cards, links -->`;
    return {
      HTML: `<script type="module" src="${CDN}/effects/orbit-gallery.js"></script>\n\n<ane-orbit-gallery${html} aria-label="New releases">\n${cards}\n</ane-orbit-gallery>`,
      React: `import 'ai-native-effects/orbit-gallery';\n\nexport function Releases({ albums }: { albums: Album[] }) {\n  return (\n    <ane-orbit-gallery${html} aria-label="New releases">\n      {albums.map((a) => (\n        <a key={a.id} href={a.url}><img src={a.cover} alt={a.title} /></a>\n      ))}\n    </ane-orbit-gallery>\n  );\n}`,
      Vue: `<script setup lang="ts">\nimport 'ai-native-effects/orbit-gallery';\ndefineProps<{ albums: Album[] }>();\n</script>\n\n<template>\n  <ane-orbit-gallery${html} aria-label="New releases">\n    <a v-for="a in albums" :key="a.id" :href="a.url"><img :src="a.cover" :alt="a.title" /></a>\n  </ane-orbit-gallery>\n</template>`,
      'JS API': `import 'ai-native-effects/orbit-gallery';\n\nconst ring = document.querySelector('ane-orbit-gallery');\nring.addEventListener('ane-orbit-change', (e) => showDetails(e.detail.index));\nring.next();          // or ring.prev(), ring.goTo(3), ring.index = 3`,
    };
  },
});
