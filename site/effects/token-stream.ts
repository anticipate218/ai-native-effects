import '../shared/debug';
import '../../src/effects/token-stream';
import type { TokenStreamElement } from '../../src/effects/token-stream';
import { CDN } from '../shared/meta';
import { attrString, mountPlayground } from '../shared/playground';
import { burstyChunks, SAMPLE_ANSWER } from '../scenes/token-stream';

const stream = document.getElementById('effect') as TokenStreamElement;
const viewport = document.getElementById('viewport')!;
const log = document.getElementById('event-log')!;

const SAMPLE_ZH =
  '**两次 Sentinel-1 过境之间，洪水范围扩大了 38%。**\n\n' +
  '新增水体主要分布在莱茵河下游，那里的后向散射降到了 `-18 dB` 以下。奈梅亨和阿纳姆附近的两个聚集区贡献了 61% 的变化，更像是河流漫溢，而不是降雨积水。\n\n' +
  '下一步，我可以用 `JRC GSW` 图层去除常年水体，并把变化图导出为 GeoTIFF。';

mountPlayground({
  element: stream,
  controlsHost: document.getElementById('controls')!,
  codeHost: document.getElementById('code')!,
  defaults: { rate: '60', granularity: 'word', caret: 'auto', accent: '#7c5cff', size: '16px', speed: '1', motion: 'auto' },
  controls: [
    { type: 'range', attr: 'rate', label: 'Base rate (chars/s)', min: 10, max: 200, step: 5, value: 60, unit: '' },
    { type: 'segmented', attr: 'granularity', label: 'Granularity', options: ['word', 'char'], value: 'word' },
    { type: 'select', attr: 'caret', label: 'Caret', options: ['auto', 'persist', 'none'], value: 'auto' },
    { type: 'color', attr: 'accent', label: 'Accent', value: '#7c5cff' },
    { type: 'range', attr: 'size', label: 'Font size', min: 12, max: 28, step: 1, value: 16, unit: 'px' },
    { type: 'range', attr: 'speed', label: 'Speed', min: 0, max: 3, step: 0.1, value: 1 },
    { type: 'select', attr: 'motion', label: 'Motion', options: ['auto', 'reduce', 'full'], value: 'auto' },
  ],
  snippets: (attrs) => {
    const html = attrString(attrs);
    return {
      HTML: `<script type="module" src="${CDN}/effects/token-stream.js"></script>\n\n<ane-token-stream${html}></ane-token-stream>\n\n<script type="module">\n  const answer = document.querySelector('ane-token-stream');\n  const response = await fetch('/api/chat', { method: 'POST', body: prompt });\n  await answer.stream(response.body.pipeThrough(new TextDecoderStream()));\n</script>`,
      React: `import { useEffect, useRef } from 'react';\nimport 'ai-native-effects/token-stream';\n\nexport function Answer({ chunks }: { chunks: AsyncIterable<string> }) {\n  const ref = useRef<HTMLElement & { stream(s: AsyncIterable<string>): Promise<void> }>(null);\n  useEffect(() => {\n    ref.current?.stream(chunks);\n  }, [chunks]);\n  return <ane-token-stream${html} ref={ref} />;\n}`,
      Vue: `<script setup lang="ts">\nimport { onMounted, ref } from 'vue';\nimport 'ai-native-effects/token-stream';\nconst props = defineProps<{ chunks: AsyncIterable<string> }>();\nconst el = ref();\nonMounted(() => el.value.stream(props.chunks));\n</script>\n\n<template>\n  <ane-token-stream${html} ref="el" />\n</template>`,
      'JS API': `import 'ai-native-effects/token-stream';\n\nconst answer = document.querySelector('ane-token-stream');\nanswer.addEventListener('ane-stream-end', (e) => save(e.detail.text));\n\n// Server-sent chunks, one at a time:\nfor await (const delta of llm.stream(prompt)) answer.write(delta);\nanswer.done();\n\n// Or hand over a whole stream:\nawait answer.stream(response.body); // bytes or strings\n\nanswer.skip();  // reveal the rest now\nanswer.reset(); // clear for the next turn`,
    };
  },
});

stream.addEventListener('ane-stream-end', (event) => {
  log.innerHTML = `<code>ane-stream-end</code> fired: <strong>${(event as CustomEvent<{ text: string }>).detail.text.length} characters</strong>`;
});

document.querySelectorAll<HTMLButtonElement>('.viewport-tools button').forEach((button) => {
  button.addEventListener('click', () => {
    viewport.dataset.bg = button.dataset.bg;
    document.querySelectorAll('.viewport-tools button').forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
  });
});

// Simulated bursty network: small deltas plus the occasional big chunk.
let timers: number[] = [];
let unsent: string[] = [];
const play = (text: string, seed: number): void => {
  timers.forEach(clearTimeout);
  stream.reset();
  log.textContent = 'Streaming…';
  const chunks = burstyChunks(text, seed);
  unsent = chunks.map((c) => c.text);
  timers = chunks.map(({ at, text: chunk }) =>
    window.setTimeout(() => {
      unsent.shift();
      stream.write(chunk);
    }, 500 + at),
  );
  timers.push(window.setTimeout(() => stream.done(), 500 + chunks[chunks.length - 1]!.at + 60));
};
document.getElementById('play-en')!.addEventListener('click', () => play(SAMPLE_ANSWER, Math.floor(Math.random() * 1000)));
document.getElementById('play-zh')!.addEventListener('click', () => play(SAMPLE_ZH, Math.floor(Math.random() * 1000)));
document.getElementById('skip')!.addEventListener('click', () => {
  // The simulated network delivers whatever is left at once, then the reveal catches up instantly.
  timers.forEach(clearTimeout);
  if (unsent.length) stream.write(unsent.join(''));
  unsent = [];
  if (stream.streaming) stream.done();
  stream.skip();
});
document.getElementById('reset')!.addEventListener('click', () => {
  timers.forEach(clearTimeout);
  stream.reset();
});
play(SAMPLE_ANSWER, 3);
