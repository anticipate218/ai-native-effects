#!/usr/bin/env node
/**
 * Full-page screenshots of the built site for design review (desktop + mobile).
 *
 *   npm run build && node scripts/shots.mjs                 # gallery + every playground
 *   node scripts/shots.mjs index.html effects/foo.html      # selected pages
 *
 * Writes .capture/shots/<page>-<viewport>.png and prints console errors, if any.
 */
import { mkdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { preview } from 'vite';

const root = resolve(import.meta.dirname, '..');
const outDir = join(root, '.capture/shots');
await mkdir(outDir, { recursive: true });

const manifest = JSON.parse(await readFile(join(root, 'effects.json'), 'utf8'));
const args = process.argv.slice(2);
const pages = args.length ? args : ['index.html', ...manifest.effects.map((e) => `effects/${e.id}.html`)];
const viewports = [
  { name: 'desktop', width: 1366, height: 900, scale: 1 },
  { name: 'mobile', width: 390, height: 844, scale: 2 },
];

const server = await preview({ configFile: join(root, 'vite.config.ts'), preview: { port: 4181, strictPort: false }, logLevel: 'warn' });
const base = server.resolvedUrls.local[0];
const channel = process.env.CAPTURE_CHANNEL ?? (process.platform === 'win32' ? 'msedge' : undefined);
const browser = await chromium.launch(channel ? { channel } : {});
try {
  for (const page of pages) {
    for (const vp of viewports) {
      const tab = await browser.newPage({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.scale });
      const errors = [];
      tab.on('console', (msg) => msg.type() === 'error' && errors.push(msg.text()));
      tab.on('pageerror', (err) => errors.push(err.message));
      await tab.goto(base + page, { waitUntil: 'networkidle' });
      await tab.waitForTimeout(1200);
      const overflow = await tab.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      const file = join(outDir, `${page.replace(/[\\/]/g, '_').replace('.html', '')}-${vp.name}.png`);
      await tab.screenshot({ path: file, fullPage: true });
      console.log(`${file}${overflow > 0 ? `  ⚠ horizontal overflow ${overflow}px` : ''}${errors.length ? `\n  errors: ${errors.join(' | ')}` : ''}`);
      await tab.close();
    }
  }
} finally {
  await browser.close();
  await new Promise((done) => server.httpServer.close(done));
}
