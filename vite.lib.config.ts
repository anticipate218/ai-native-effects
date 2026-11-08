import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// Library build: one ES module per effect (dist/effects/<id>.js) plus an
// all-in-one entry (dist/index.js). Shared core code lands in dist/chunks/.
const root = import.meta.dirname;
const effectsDir = resolve(root, 'src/effects');

const entry: Record<string, string> = { index: resolve(root, 'src/index.ts') };
for (const id of readdirSync(effectsDir)) {
  const file = resolve(effectsDir, id, 'index.ts');
  if (existsSync(file)) entry[`effects/${id}`] = file;
}

export default defineConfig({
  publicDir: false,
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2020',
    sourcemap: true,
    minify: true,
    lib: { entry, formats: ['es'] },
    rolldownOptions: {
      output: { chunkFileNames: 'chunks/[name]-[hash].js' },
    },
  },
});
