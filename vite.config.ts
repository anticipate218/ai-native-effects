import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// Showcase site: a multi-page app (gallery, one playground per effect, and a
// bare "stage" page used by scripts/capture.mjs to record previews).
const repoRoot = import.meta.dirname;
const siteRoot = resolve(repoRoot, 'site');

const pages: Record<string, string> = {
  index: resolve(siteRoot, 'index.html'),
  stage: resolve(siteRoot, 'stage.html'),
};
for (const file of readdirSync(resolve(siteRoot, 'effects'))) {
  if (file.endsWith('.html')) pages[`effects/${file.slice(0, -5)}`] = resolve(siteRoot, 'effects', file);
}

export default defineConfig({
  root: siteRoot,
  // Relative base: the same build works on GitHub Pages (/ai-native-effects/) and locally (/).
  base: './',
  server: { fs: { allow: [repoRoot] } },
  build: {
    outDir: resolve(repoRoot, 'dist-site'),
    emptyOutDir: true,
    target: 'es2022',
    rolldownOptions: { input: pages },
  },
  preview: { port: 4173 },
});
