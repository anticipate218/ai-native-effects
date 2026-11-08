// Builds the library when the package is installed from Git (npm runs `prepare`).
// Skips quietly when build tooling is unavailable (e.g. `npm install --omit=dev`).
import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

if (process.env.ANE_SKIP_PREPARE) process.exit(0);
if (!existsSync('node_modules/vite') || !existsSync('node_modules/typescript')) {
  console.log('[ai-native-effects] build tooling not installed, skipping library build');
  process.exit(0);
}
execSync('npm run build:lib', { stdio: 'inherit' });
