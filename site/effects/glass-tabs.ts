import '../shared/debug';
import '../../src/effects/glass-tabs';
import type { GlassTabsElement } from '../../src/effects/glass-tabs';
import { APP_TAB_BUTTONS, RANGE_BUTTONS } from '../scenes/glass-tabs';
import { CDN } from '../shared/meta';
import { attrString, mountPlayground } from '../shared/playground';

const range = document.getElementById('effect') as GlassTabsElement;
const app = document.getElementById('app-tabs') as GlassTabsElement;
const panel = document.getElementById('panel')!;
const log = document.getElementById('event-log')!;
range.innerHTML = RANGE_BUTTONS;
app.innerHTML = APP_TAB_BUTTONS;

// Wire the time-range tabs to the panel (tabs pattern: aria-controls / aria-labelledby).
const COPY: Record<string, string> = {
  Day: 'Revenue is up 3.1% on yesterday.',
  Week: 'Revenue is up 12.4% on the previous week.',
  Month: 'Best month this year, led by renewals.',
  Year: 'Annual revenue crossed $2.1M.',
};
// Read the children directly: `tabs` fills in once the slot has updated (asynchronously).
const rangeTabs = [...range.children] as HTMLElement[];
rangeTabs.forEach((t, i) => {
  t.id = `range-tab-${i}`;
  t.setAttribute('aria-controls', 'panel');
});
const show = (i: number): void => {
  const label = rangeTabs[i]?.textContent?.trim() ?? '';
  panel.setAttribute('aria-labelledby', `range-tab-${i}`);
  panel.innerHTML = `<h3>${label}</h3><p>${COPY[label] ?? ''}</p>`;
};
show(range.selected);
range.addEventListener('ane-tab-change', (e) => {
  show(e.detail.index);
  log.innerHTML = `<code>ane-tab-change</code> · <strong>${e.detail.tab.textContent?.trim()}</strong> (index ${e.detail.index})`;
});

mountPlayground({
  element: range,
  controlsHost: document.getElementById('controls')!,
  codeHost: document.getElementById('code')!,
  defaults: { accent: '#ffffff', strength: '0.6', curvature: '0.85', dispersion: '0.35', stretch: '0.8', speed: '1', motion: 'auto' },
  controls: [
    { type: 'color', attr: 'accent', label: 'Accent', value: '#ffffff' },
    { type: 'range', attr: 'strength', label: 'Refraction', min: 0, max: 1, step: 0.05, value: 0.6, unit: '' },
    { type: 'range', attr: 'curvature', label: 'Magnification', min: 0, max: 1, step: 0.05, value: 0.85, unit: '' },
    { type: 'range', attr: 'dispersion', label: 'Dispersion', min: 0, max: 1, step: 0.05, value: 0.35, unit: '' },
    { type: 'range', attr: 'stretch', label: 'Liquid stretch', min: 0, max: 1, step: 0.05, value: 0.8, unit: '' },
    { type: 'range', attr: 'speed', label: 'Speed', min: 0, max: 3, step: 0.1, value: 1 },
    { type: 'select', attr: 'motion', label: 'Motion', options: ['auto', 'reduce', 'full'], value: 'auto' },
  ],
  snippets: (attrs) => {
    const html = attrString(attrs);
    const tabs = `\n  <button>Day</button>\n  <button>Week</button>\n  <button>Month</button>\n  <button>Year</button>\n`;
    return {
      HTML: `<script type="module" src="${CDN}/effects/glass-tabs.js"></script>\n\n<ane-glass-tabs${html} selected="1" aria-label="Time range">${tabs}</ane-glass-tabs>`,
      React: `import { useEffect, useRef } from 'react';\nimport 'ai-native-effects/glass-tabs';\n\nexport function Range({ value, onChange }: { value: number; onChange: (i: number) => void }) {\n  const ref = useRef<HTMLElement>(null);\n  useEffect(() => {\n    const el = ref.current!;\n    const h = (e: Event) => onChange((e as CustomEvent).detail.index);\n    el.addEventListener('ane-tab-change', h);\n    return () => el.removeEventListener('ane-tab-change', h);\n  }, [onChange]);\n  return (\n    <ane-glass-tabs ref={ref}${html} selected={value} aria-label="Time range">\n      <button>Day</button><button>Week</button><button>Month</button><button>Year</button>\n    </ane-glass-tabs>\n  );\n}`,
      Vue: `<script setup lang="ts">\nimport 'ai-native-effects/glass-tabs';\nconst range = defineModel<number>({ default: 1 });\n</script>\n\n<template>\n  <ane-glass-tabs${html} :selected="range" aria-label="Time range" @ane-tab-change="range = $event.detail.index">\n    <button>Day</button><button>Week</button><button>Month</button><button>Year</button>\n  </ane-glass-tabs>\n</template>`,
      'JS API': `import 'ai-native-effects/glass-tabs';\n\nconst tabs = document.querySelector('ane-glass-tabs');\ntabs.selected = 2;   // the lens slides there\ntabs.addEventListener('ane-tab-change', (e) => console.log(e.detail.index, e.detail.tab));`,
    };
  },
});

// Keep the app bar's look in sync with the controls.
const mirror = ['accent', 'strength', 'curvature', 'dispersion', 'stretch', 'speed', 'motion'];
new MutationObserver(() => {
  for (const a of mirror) {
    const v = range.getAttribute(a);
    if (v == null) app.removeAttribute(a);
    else if (app.getAttribute(a) !== v) app.setAttribute(a, v);
  }
}).observe(range, { attributes: true, attributeFilter: mirror });
