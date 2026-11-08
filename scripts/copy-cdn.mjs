// Publishes the library build (dist/) under dist-site/cdn/ so GitHub Pages can serve
// ready-to-import ES modules: <script type="module" src=".../cdn/effects/<id>.js">.
import { cpSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const from = resolve(root, 'dist');
const to = resolve(root, 'dist-site/cdn');
if (!existsSync(resolve(from, 'index.js'))) throw new Error('Run `npm run build:lib` first.');
cpSync(from, to, { recursive: true, filter: (src) => !src.includes('types') });
console.log('› copied library build to dist-site/cdn');
