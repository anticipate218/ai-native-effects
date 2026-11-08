#!/usr/bin/env node
/**
 * Regenerates the effect gallery tables in README.md and README.zh-CN.md from effects.json.
 * Content between `<!-- effects:start -->` and `<!-- effects:end -->` is replaced.
 *
 *   npm run sync           # write
 *   npm run sync -- --check  # exit 1 when the READMEs are out of date (used by tests/CI)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const SITE = 'https://anticipate218.github.io/ai-native-effects';
const { effects } = JSON.parse(readFileSync(resolve(root, 'effects.json'), 'utf8'));
const stable = effects.filter((effect) => effect.status === 'stable');
const check = process.argv.includes('--check');

const escape = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function cell(effect, zh) {
  const playground = `${SITE}/effects/${effect.id}.html`;
  const title = zh ? effect.titleZh : effect.title;
  const summary = zh ? effect.summaryZh : effect.summary;
  const docs = zh ? `docs/zh-CN/effects/${effect.id}.md` : `docs/effects/${effect.id}.md`;
  const labels = zh ? ['在线演示', '文档', '源码'] : ['Playground', 'Docs', 'Source'];
  return [
    `    <td width="50%" valign="top">`,
    `      <a href="${playground}"><img src="site/public/media/${effect.id}.gif" alt="${escape(title)}" width="100%"></a>`,
    `      <br><b><a href="${playground}">${escape(title)}</a></b> · <code>&lt;${effect.tag}&gt;</code> · <sub>${escape(effect.series)}</sub>`,
    `      <br><sub>${escape(summary)}</sub>`,
    `      <br><sub><a href="${playground}">${labels[0]}</a> · <a href="${docs}">${labels[1]}</a> · <a href="src/effects/${effect.id}">${labels[2]}</a></sub>`,
    `    </td>`,
  ].join('\n');
}

function table(zh) {
  const rows = [];
  for (let i = 0; i < stable.length; i += 2) {
    const pair = stable.slice(i, i + 2).map((effect) => cell(effect, zh));
    if (pair.length === 1) pair.push('    <td width="50%"></td>');
    rows.push(`  <tr>\n${pair.join('\n')}\n  </tr>`);
  }
  return `<table>\n${rows.join('\n')}\n</table>`;
}

let stale = false;
for (const [file, zh] of [
  ['README.md', false],
  ['README.zh-CN.md', true],
]) {
  const path = resolve(root, file);
  const source = readFileSync(path, 'utf8');
  const pattern = /(<!-- effects:start -->)[\s\S]*?(<!-- effects:end -->)/;
  if (!pattern.test(source)) throw new Error(`${file} is missing the effects markers`);
  const next = source.replace(pattern, `$1\n${table(zh)}\n$2`);
  if (next !== source) {
    stale = true;
    if (!check) writeFileSync(path, next);
    console.log(`${check ? '✗ out of date' : '✓ updated'}: ${file}`);
  }
}
if (check && stale) process.exit(1);
if (!stale) console.log('READMEs are up to date');
