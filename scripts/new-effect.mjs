#!/usr/bin/env node
/**
 * Scaffolds a new effect with everything the definition of done asks for.
 *
 *   npm run new -- scan-reveal --title "Satellite Scan Reveal" [--title-zh "卫星扫描揭示"] [--series "AI Native"]
 *
 * Creates (never overwrites):
 *   src/effects/<id>/{<id>.ts,index.ts,<id>.test.ts}   canvas component skeleton + tests
 *   site/effects/<id>.{html,ts}                          playground page
 *   site/scenes/<id>.ts                                  capture scene
 *   docs/effects/<id>.md, docs/zh-CN/effects/<id>.md     docs (EN primary, 中文 supplement)
 * and registers a `draft` entry in effects.json plus an export in src/index.ts.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const id = args.find((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')));
if (!id || !/^[a-z][a-z0-9]*(-[a-z0-9]+)+$|^[a-z][a-z0-9]+$/.test(id)) {
  console.error('Usage: npm run new -- <kebab-case-id> --title "Effect Title" [--title-zh "中文名"] [--series "AI Native"]');
  process.exit(1);
}
const pascal = id.replace(/(^|-)([a-z0-9])/g, (_, __, c) => c.toUpperCase());
const tag = `ane-${id}`;
const cls = `${pascal}Element`;
const title = opt('title', pascal.replace(/([a-z])([A-Z])/g, '$1 $2'));
const titleZh = opt('title-zh', title);
const series = opt('series', 'AI Native');
const today = new Date().toISOString().slice(0, 10);
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));

function write(rel, content) {
  const path = resolve(root, rel);
  if (existsSync(path)) {
    console.log(`  skip (exists) ${rel}`);
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content.replace(/^\n/, ''));
  console.log(`  create ${rel}`);
}

write(`src/effects/${id}/${id}.ts`, `
import { defineElement, EffectElement } from '../../core/effect-element';
import { createRandom, parseNumber } from '../../core/math';

const STYLE = /* css */ \`
:host {
  display: inline-block;
  position: relative;
  width: var(--ane-size, 240px);
  aspect-ratio: 1 / 1;
  vertical-align: middle;
  contain: layout style;
}
:host([hidden]) { display: none; }
canvas { display: block; width: 100%; height: 100%; }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
\`;

/**
 * \`<${tag}>\`: ${title}.
 *
 * @attr color - primary color (any CSS color)
 * @attr accent - secondary color (any CSS color)
 * @attr size - CSS length, default \`240px\`
 * @attr speed - animation time scale, \`0\`-\`5\`, default \`1\`
 * @attr motion - \`auto\` | \`reduce\` | \`full\`
 * @attr label - accessible label
 * @attr seed - integer seed for randomness
 * @cssprop --ane-size
 */
export class ${cls} extends EffectElement {
  static override get observedAttributes(): string[] {
    return [...super.observedAttributes, 'color', 'accent', 'label', 'seed'];
  }

  #canvas: HTMLCanvasElement | null = null;
  #ctx: CanvasRenderingContext2D | null = null;
  #resize: ResizeObserver | null = null;
  #width = 0;
  #height = 0;
  #colors = { primary: '#7c5cff', accent: '#5ef2ff' };
  #random = createRandom(7);

  protected build(root: ShadowRoot): void {
    root.innerHTML = \`<style>\${STYLE}</style><canvas role="img"></canvas>\`;
    this.#canvas = root.querySelector('canvas');
    this.#ctx = this.#canvas?.getContext('2d') ?? null;
    this.#random = createRandom(parseNumber(this.getAttribute('seed'), 7));
    this.#syncColors();
    this.#syncLabel();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (!this.#resize && typeof ResizeObserver === 'function') {
      this.#resize = new ResizeObserver(() => this.#fit());
      this.#resize.observe(this);
    }
    this.#fit();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#resize?.disconnect();
    this.#resize = null;
  }

  protected override attributeChanged(name: string): void {
    if (name === 'color' || name === 'accent') this.#syncColors();
    if (name === 'label') this.#syncLabel();
    if (name === 'seed') this.#random = createRandom(parseNumber(this.getAttribute('seed'), 7));
  }

  #syncColors(): void {
    // Resolve CSS colors (attributes or custom properties) once, not per frame.
    const style = getComputedStyle(this);
    this.#colors.primary = this.getAttribute('color') || style.getPropertyValue('--ane-primary').trim() || '#7c5cff';
    this.#colors.accent = this.getAttribute('accent') || style.getPropertyValue('--ane-accent').trim() || '#5ef2ff';
  }

  #syncLabel(): void {
    this.#canvas?.setAttribute('aria-label', this.getAttribute('label') || '${title}');
  }

  /** Matches the canvas backing store to its CSS size and devicePixelRatio. */
  #fit(): void {
    const canvas = this.#canvas;
    if (!canvas) return;
    const dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
    const rect = this.getBoundingClientRect();
    this.#width = rect.width;
    this.#height = rect.height;
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    this.#ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.tick(0);
  }

  protected tick(_deltaMs: number): void {
    const ctx = this.#ctx;
    if (!ctx || !this.#width) return;
    const w = this.#width;
    const h = this.#height;
    const t = this.elapsed / 1000;
    const pulse = this.reducedMotion ? 0.5 : 0.5 + 0.5 * Math.sin(t * Math.PI * 2 * 0.8);

    ctx.clearRect(0, 0, w, h);
    // TODO: replace this placeholder with the real effect.
    ctx.fillStyle = this.#colors.primary;
    ctx.globalAlpha = 0.25 + pulse * 0.5;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, Math.min(w, h) * (0.2 + pulse * 0.1), 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = this.#colors.accent;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    '${tag}': ${cls};
  }
}

/** Registers \`<${tag}>\` (or a custom tag name). Safe to call more than once. */
export function define${pascal}(tag = '${tag}'): void {
  defineElement(tag, ${cls});
}
`);

write(`src/effects/${id}/index.ts`, `
import { define${pascal} } from './${id}';

export * from './${id}';

// Importing this module registers <${tag}>.
define${pascal}();
`);

write(`src/effects/${id}/${id}.test.ts`, `
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getTickerStats } from '../../core/ticker';
import { ${cls} } from './index';

describe('<${tag}>', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.useRealTimers();
  });

  it('registers and renders an accessible canvas', () => {
    const el = document.createElement('${tag}');
    document.body.append(el);
    expect(el).toBeInstanceOf(${cls});
    const canvas = el.shadowRoot!.querySelector('canvas')!;
    expect(canvas.getAttribute('role')).toBe('img');
    expect(canvas.getAttribute('aria-label')).toBeTruthy();
  });

  it('honours the label attribute', () => {
    const el = document.createElement('${tag}');
    el.setAttribute('label', 'Custom label');
    document.body.append(el);
    expect(el.shadowRoot!.querySelector('canvas')!.getAttribute('aria-label')).toBe('Custom label');
  });

  it('animates without errors and cleans up when removed', () => {
    const errors = vi.spyOn(console, 'error');
    const el = document.createElement('${tag}');
    document.body.append(el);
    vi.advanceTimersByTime(500);
    expect(errors).not.toHaveBeenCalled();
    el.remove();
    expect(getTickerStats().subscribers).toBe(0);
  });
});
`);

const header = (depth) => `
    <header class="site-header">
      <div class="wrap">
        <a class="logo" href="${depth}">
          <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 7V3.5" stroke="#b9a8ff" stroke-width="2" stroke-linecap="round" /><circle cx="16" cy="3.5" r="2.2" fill="#5ef2ff" /><rect x="3" y="7" width="26" height="22" rx="9" fill="#8f75ff" /><rect x="7" y="11" width="18" height="13" rx="6" fill="#0b0e24" /><rect x="11" y="14" width="3" height="6" rx="1.5" fill="#5ef2ff" /><rect x="18" y="14" width="3" height="6" rx="1.5" fill="#5ef2ff" /></svg>
          AI Native Effects
        </a>
        <nav class="nav" aria-label="Main">
          <a href="${depth}#effects">Effects</a>
          <a class="hide-sm" href="https://github.com/anticipate218/ai-native-effects/blob/main/docs/zh-CN/effects/${id}.md" lang="zh-CN">中文文档</a>
          <a href="https://github.com/anticipate218/ai-native-effects">GitHub</a>
        </nav>
      </div>
    </header>`;

write(`site/effects/${id}.html`, `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title} · AI Native Effects</title>
    <meta name="description" content="TODO: one-sentence description of ${title}." />
    <meta property="og:title" content="${title} · AI Native Effects" />
    <meta property="og:image" content="https://anticipate218.github.io/ai-native-effects/media/${id}.png" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="theme-color" content="#070914" />
    <link rel="icon" href="../favicon.svg" type="image/svg+xml" />
    <link rel="stylesheet" href="../shared/site.css" />
  </head>
  <body>
    <a class="skip" href="#main">Skip to content</a>${header('../')}

    <main id="main" class="wrap">
      <div class="pg-head">
        <div class="crumbs"><a href="../">Effects</a> / ${series}</div>
        <h1>${title}</h1>
        <p class="lead">TODO: what problem this effect solves in an AI product, in one or two sentences.</p>
      </div>

      <div class="pg">
        <div class="panel viewport" id="viewport" data-bg="dark">
          <${tag} id="effect"></${tag}>
          <div class="viewport-tools" role="group" aria-label="Preview background">
            <button type="button" class="btn small" data-bg="dark" aria-pressed="true">Dark</button>
            <button type="button" class="btn small" data-bg="light" aria-pressed="false">Light</button>
            <button type="button" class="btn small" data-bg="checker" aria-pressed="false">Grid</button>
          </div>
        </div>
        <aside class="panel controls" aria-label="Controls">
          <div id="controls" style="display: grid; gap: 18px"></div>
        </aside>
        <div class="panel code" id="code"></div>
      </div>

      <section class="api" aria-labelledby="api-title">
        <h2 id="api-title">API</h2>
        <div class="table-wrap" tabindex="0" role="region" aria-label="Attributes table">
          <table>
            <thead><tr><th scope="col">Attribute</th><th scope="col">Values</th><th scope="col">Default</th><th scope="col">Description</th></tr></thead>
            <tbody>
              <tr><td><code>color</code></td><td>any CSS color</td><td><code>#7c5cff</code></td><td>Primary color.</td></tr>
              <tr><td><code>accent</code></td><td>any CSS color</td><td><code>#5ef2ff</code></td><td>Secondary color.</td></tr>
              <tr><td><code>size</code></td><td>CSS length</td><td><code>240px</code></td><td>Width and height.</td></tr>
              <tr><td><code>speed</code></td><td><code>0</code>–<code>5</code></td><td><code>1</code></td><td>Animation time scale.</td></tr>
              <tr><td><code>motion</code></td><td><code>auto</code> <code>reduce</code> <code>full</code></td><td><code>auto</code></td><td>Reduced-motion override.</td></tr>
            </tbody>
          </table>
        </div>
        <div class="downloads">
          <a class="btn small" href="../media/${id}.gif">GIF</a>
          <a class="btn small" href="../media/${id}.mp4">MP4</a>
          <a class="btn small" href="https://github.com/anticipate218/ai-native-effects/blob/main/docs/effects/${id}.md">Full docs</a>
        </div>
      </section>
    </main>

    <footer class="site-footer">
      <div class="wrap">
        <span>MIT License · © ${today.slice(0, 4)} anticipate218</span>
        <span><a href="https://github.com/anticipate218/ai-native-effects/tree/main/src/effects/${id}">View source</a></span>
      </div>
    </footer>
    <script type="module" src="./${id}.ts"></script>
  </body>
</html>
`);

write(`site/effects/${id}.ts`, `
import '../shared/debug';
import '../../src/effects/${id}';
import { CDN } from '../shared/meta';
import { attrString, mountPlayground } from '../shared/playground';

const effect = document.getElementById('effect')!;
const viewport = document.getElementById('viewport')!;

mountPlayground({
  element: effect,
  controlsHost: document.getElementById('controls')!,
  codeHost: document.getElementById('code')!,
  defaults: { color: '#7c5cff', accent: '#5ef2ff', size: '240px', speed: '1', motion: 'auto' },
  controls: [
    { type: 'color', attr: 'color', label: 'Color', value: '#7c5cff' },
    { type: 'color', attr: 'accent', label: 'Accent', value: '#5ef2ff' },
    { type: 'range', attr: 'size', label: 'Size', min: 120, max: 360, step: 4, value: 280, unit: 'px' },
    { type: 'range', attr: 'speed', label: 'Speed', min: 0, max: 3, step: 0.1, value: 1 },
    { type: 'select', attr: 'motion', label: 'Motion', options: ['auto', 'reduce', 'full'], value: 'auto' },
  ],
  snippets: (attrs) => ({
    HTML: \`<script type="module" src="\${CDN}/effects/${id}.js"></script>\\n\\n<${tag}\${attrString(attrs)}></${tag}>\`,
    React: \`import 'ai-native-effects/${id}';\\n\\nexport function Demo() {\\n  return <${tag}\${attrString(attrs)} />;\\n}\`,
    Vue: \`<script setup lang="ts">\\nimport 'ai-native-effects/${id}';\\n</script>\\n\\n<template>\\n  <${tag}\${attrString(attrs)} />\\n</template>\`,
  }),
});

document.querySelectorAll<HTMLButtonElement>('.viewport-tools button').forEach((button) => {
  button.addEventListener('click', () => {
    viewport.dataset.bg = button.dataset.bg;
    document.querySelectorAll('.viewport-tools button').forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
  });
});
`);

write(`site/scenes/${id}.ts`, `
import '../../src/effects/${id}';
import { timeline, type Scene } from '../shared/scene';

const scene: Scene = {
  width: 640,
  height: 400,
  duration: 6000,
  poster: 3000,
  play(stage) {
    stage.innerHTML = \`
      <div class="stage-tag">&lt;${tag}&gt;</div>
      <div style="position:absolute;inset:0;display:grid;place-items:center">
        <${tag} size="300px" seed="11"></${tag}>
      </div>
      <div class="stage-brand">AI Native Effects</div>\`;
    // Schedule state changes with timeline([[ms, () => { ... }], ...]) so captures stay deterministic.
    return timeline([]);
  },
};

export default scene;
`);

write(`docs/effects/${id}.md`, `
# ${title} · \`<${tag}>\`

<img src="../../site/public/media/${id}.gif" width="480" alt="${title} preview">

TODO: one-paragraph pitch. What AI product moment does this effect make legible?

**[Open the playground →](https://anticipate218.github.io/ai-native-effects/effects/${id}.html)** · [中文文档](../zh-CN/effects/${id}.md)

## When to use it

- TODO

## Install

\`\`\`html
<script type="module" src="https://anticipate218.github.io/ai-native-effects/cdn/effects/${id}.js"></script>
<${tag}></${tag}>
\`\`\`

\`\`\`ts
import 'ai-native-effects/${id}';
\`\`\`

## API

| Attribute | Values | Default | Description |
| --- | --- | --- | --- |
| \`color\` | any CSS color | \`#7c5cff\` | Primary color. |
| \`accent\` | any CSS color | \`#5ef2ff\` | Secondary color. |
| \`size\` | CSS length | \`240px\` | Width and height. |
| \`speed\` | \`0\`–\`5\` | \`1\` | Animation time scale. |
| \`motion\` | \`auto\` \`reduce\` \`full\` | \`auto\` | \`auto\` follows \`prefers-reduced-motion\`. |
| \`label\` | string | \`${title}\` | Accessible label. |

## Accessibility

- TODO: role and label, what the reduced-motion variant shows.

## Performance

- TODO: rendering approach and per-frame cost.
`);

write(`docs/zh-CN/effects/${id}.md`, `
# ${titleZh} · \`<${tag}>\`

<img src="../../../site/public/media/${id}.gif" width="480" alt="${titleZh} 预览">

TODO：一句话说明它让 AI 产品中的哪个时刻变得可感知。

**[打开交互调参页 →](https://anticipate218.github.io/ai-native-effects/effects/${id}.html)** · [English](../../effects/${id}.md)（主文档）

## 使用

\`\`\`html
<script type="module" src="https://anticipate218.github.io/ai-native-effects/cdn/effects/${id}.js"></script>
<${tag}></${tag}>
\`\`\`

## 主要参数

| 属性 | 默认值 | 说明 |
| --- | --- | --- |
| \`color\` | \`#7c5cff\` | 主色 |
| \`accent\` | \`#5ef2ff\` | 辅色 |
| \`size\` | \`240px\` | 尺寸 |
| \`speed\` | \`1\` | 速度倍率 |
| \`motion\` | \`auto\` | 跟随系统「减少动态效果」设置 |
`);

// Manifest entry (draft until the definition of done is met).
const manifestPath = resolve(root, 'effects.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
if (!manifest.effects.some((effect) => effect.id === id)) {
  manifest.effects.push({
    id,
    tag,
    title,
    titleZh,
    series,
    summary: 'TODO: one sentence for the gallery and README.',
    summaryZh: 'TODO：一句话中文简介。',
    tech: ['Canvas', 'Web Component'],
    added: today,
    since: pkg.version,
    status: 'draft',
    preview: `<${tag} size="180px"></${tag}>`,
  });
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log('  update effects.json (status: draft)');
}

const indexPath = resolve(root, 'src/index.ts');
const exportLine = `export * from './effects/${id}';`;
const index = readFileSync(indexPath, 'utf8');
if (!index.includes(exportLine)) {
  writeFileSync(indexPath, `${index.trimEnd()}\n${exportLine}\n`);
  console.log('  update src/index.ts');
}

console.log(`\nNext: npm run dev → http://localhost:5173/effects/${id}.html
When done: set "status": "stable" in effects.json, npm run capture -- ${id}, npm run sync, npm run check.`);
