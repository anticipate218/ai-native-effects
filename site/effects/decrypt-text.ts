import '../shared/debug';
import '../../src/effects/decrypt-text';
import type { DecryptTextElement } from '../../src/effects/decrypt-text';
import { CDN } from '../shared/meta';
import { attrString, mountPlayground } from '../shared/playground';

const headline = document.getElementById('effect') as DecryptTextElement;
const word = document.getElementById('word') as DecryptTextElement;
const input = document.getElementById('custom-text') as HTMLInputElement;
const log = document.getElementById('event-log')!;

mountPlayground({
  element: headline,
  controlsHost: document.getElementById('controls')!,
  codeHost: document.getElementById('code')!,
  defaults: { charset: 'latin', order: 'ltr', stagger: '600', scramble: '450', accent: '#5ef2ff', glow: '1', seed: '7', trigger: 'view', speed: '1', motion: 'auto' },
  controls: [
    { type: 'select', attr: 'charset', label: 'Charset', options: ['latin', 'upper', 'hex', 'binary', 'digits', 'blocks', 'symbols', 'katakana'], value: 'latin' },
    { type: 'segmented', attr: 'order', label: 'Reveal order', options: ['ltr', 'rtl', 'center', 'random'], value: 'ltr' },
    { type: 'range', attr: 'stagger', label: 'Stagger (ms)', min: 0, max: 2000, step: 50, value: 600, unit: '' },
    { type: 'range', attr: 'scramble', label: 'Scramble per char (ms)', min: 0, max: 1500, step: 50, value: 450, unit: '' },
    { type: 'color', attr: 'accent', label: 'Accent', value: '#5ef2ff' },
    { type: 'range', attr: 'glow', label: 'Lock glow', min: 0, max: 2, step: 0.1, value: 1, unit: '' },
    { type: 'range', attr: 'seed', label: 'Seed', min: 1, max: 40, step: 1, value: 7, unit: '' },
    { type: 'select', attr: 'trigger', label: 'Trigger', options: ['view', 'hover', 'manual'], value: 'view' },
    { type: 'range', attr: 'speed', label: 'Speed', min: 0, max: 3, step: 0.1, value: 1 },
    { type: 'select', attr: 'motion', label: 'Motion', options: ['auto', 'reduce', 'full'], value: 'auto' },
  ],
  snippets: (attrs) => {
    const html = attrString(attrs);
    return {
      HTML: `<script type="module" src="${CDN}/effects/decrypt-text.js"></script>\n\n<h1><ane-decrypt-text${html}>Interfaces that remember.</ane-decrypt-text></h1>`,
      React: `import 'ai-native-effects/decrypt-text';\n\nexport function Headline({ word }: { word: string }) {\n  // Changing \`text\` decodes from the old word to the new one.\n  return <h1>Interfaces that <ane-decrypt-text${html} text={word} /></h1>;\n}`,
      Vue: `<script setup lang="ts">\nimport 'ai-native-effects/decrypt-text';\ndefineProps<{ word: string }>();\n</script>\n\n<template>\n  <h1>Interfaces that <ane-decrypt-text${html} :text="word" /></h1>\n</template>`,
      'JS API': `import 'ai-native-effects/decrypt-text';\n\nconst title = document.querySelector('ane-decrypt-text');\ntitle.decode();               // play again\ntitle.text = 'feel alive.';   // morph to new text\ntitle.addEventListener('ane-decrypt-done', (e) => console.log(e.detail.text));`,
    };
  },
});

// Keep the rotating word in sync with the controls that matter for the look.
const mirror = ['charset', 'order', 'accent', 'glow', 'seed', 'speed', 'motion'];
new MutationObserver(() => {
  for (const a of mirror) {
    const v = headline.getAttribute(a);
    if (v == null) word.removeAttribute(a);
    else if (word.getAttribute(a) !== v) word.setAttribute(a, v);
  }
}).observe(headline, { attributes: true, attributeFilter: mirror });

headline.addEventListener('ane-decrypt-done', (event) => {
  log.innerHTML = `<code>ane-decrypt-done</code> · <strong>${event.detail.text}</strong>`;
});

const words = ['remember.', 'react.', 'feel alive.'];
let i = 0;
window.setInterval(() => {
  if (document.hidden || input === document.activeElement) return;
  i = (i + 1) % words.length;
  word.text = words[i]!;
}, 3200);

/** Brings the preview into view, then runs the action once the element knows it is visible. */
const inView = (action: () => void): void => {
  headline.scrollIntoView({ block: 'nearest', behavior: 'auto' });
  requestAnimationFrame(() => requestAnimationFrame(action));
};
document.getElementById('replay')!.addEventListener('click', () =>
  inView(() => {
    headline.decode();
    word.decode();
  }),
);
document.getElementById('custom')!.addEventListener('submit', (event) => {
  event.preventDefault();
  const value = input.value.trim();
  if (value) inView(() => (headline.text = value));
});
