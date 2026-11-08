#!/usr/bin/env node
/**
 * Records deterministic previews of every effect from its scene (site/scenes/<id>.ts).
 *
 *   npm run capture                      # all stable effects
 *   npm run capture -- thinking-buddy    # selected effects
 *   npm run capture -- thinking-buddy --shots 0,1500,5600   # design review stills only
 *
 * Outputs (site/public/media/):
 *   <id>.gif        looping README preview (480px, 20 fps)
 *   <id>.mp4        H.264 video (2x)
 *   <id>.png        poster frame (2x)
 *   <id>-thumb.png  640px-wide thumbnail
 *
 * Time is virtual: Playwright's clock is paused and advanced exactly one frame
 * between screenshots, so recordings are smooth and reproducible on any machine.
 * Requires ffmpeg on PATH (or FFMPEG_PATH). Uses the system Edge on Windows,
 * Playwright's Chromium elsewhere (override with CAPTURE_CHANNEL).
 */
import { execFile } from 'node:child_process';
import { copyFile, mkdir, readFile, rm, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { chromium } from 'playwright';
import { build, preview } from 'vite';

const run = promisify(execFile);
const root = resolve(import.meta.dirname, '..');
const mediaDir = join(root, 'site/public/media');
const workDir = join(root, '.capture');
const ffmpeg = process.env.FFMPEG_PATH || 'ffmpeg';

const argv = process.argv.slice(2);
const option = (name, fallback) => {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 ? argv[index + 1] : fallback;
};
const flag = (name) => argv.includes(`--${name}`);
const valueArgs = new Set(['--fps', '--shots', '--gif-width', '--gif-fps'].flatMap((name) => [argv.indexOf(name) + 1]).filter((i) => i > 0));
const fps = Number(option('fps', 25));
// README GIFs are tuned for size (~1.5 MB): narrower, 20 fps, ordered dithering.
const gifWidth = Number(option('gif-width', 480));
const gifFps = Number(option('gif-fps', 20));
const shots = option('shots', '')
  .split(',')
  .filter(Boolean)
  .map(Number);

const manifest = JSON.parse(await readFile(join(root, 'effects.json'), 'utf8'));
const requested = argv.filter((arg, i) => !arg.startsWith('--') && !valueArgs.has(i));
const ids = requested.length ? requested : manifest.effects.filter((e) => e.status === 'stable').map((e) => e.id);
const unknown = ids.filter((id) => !manifest.effects.some((e) => e.id === id));
if (unknown.length) throw new Error(`Unknown effect id(s): ${unknown.join(', ')}`);

if (!flag('skip-build')) {
  console.log('› building site');
  await build({ configFile: join(root, 'vite.config.ts'), logLevel: 'warn' });
}
const server = await preview({ configFile: join(root, 'vite.config.ts'), preview: { port: 4180, strictPort: false }, logLevel: 'warn' });
const baseUrl = server.resolvedUrls.local[0];

const channel = process.env.CAPTURE_CHANNEL ?? (process.platform === 'win32' ? 'msedge' : undefined);
const browser = await chromium.launch(channel ? { channel } : {});

const kb = async (file) => `${Math.round((await stat(file)).size / 1024)} KB`;

try {
  for (const id of ids) {
    const frameDir = join(workDir, id);
    await rm(frameDir, { recursive: true, force: true });
    await mkdir(frameDir, { recursive: true });

    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
    page.on('pageerror', (error) => console.error(`  [${id}] page error:`, error.message));
    await page.clock.install({ time: 0 });
    await page.goto(`${baseUrl}stage.html?effect=${id}&capture`);
    await page.waitForFunction(() => window.__stageReady === true);
    const scene = await page.evaluate(() => window.__scene);
    const box = await page.locator('#stage').boundingBox();
    if (!scene || !box) throw new Error(`Scene for ${id} did not load`);
    const clip = { x: box.x, y: box.y, width: scene.width, height: scene.height };

    const now = await page.evaluate(() => Date.now());
    await page.clock.pauseAt(now + 1000);
    await page.evaluate(() => window.__startScene?.());

    if (shots.length) {
      let at = 0;
      for (const target of [...shots].sort((a, b) => a - b)) {
        if (target > at) await page.clock.runFor(target - at);
        at = target;
        const file = join(frameDir, `shot-${String(target).padStart(5, '0')}.png`);
        await page.screenshot({ path: file, clip });
        console.log(`  ${file}`);
      }
      await page.close();
      continue;
    }

    const frameMs = 1000 / fps;
    const total = Math.round(scene.duration / frameMs);
    const posterFrame = Math.min(total - 1, Math.round(scene.poster / frameMs));
    console.log(`› ${id}: ${total} frames @ ${fps} fps (${scene.width}×${scene.height})`);
    for (let frame = 0; frame < total; frame++) {
      if (frame > 0) await page.clock.runFor(frameMs);
      await page.screenshot({ path: join(frameDir, `${String(frame).padStart(4, '0')}.png`), clip });
    }
    await page.close();

    await mkdir(mediaDir, { recursive: true });
    const input = ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', join(frameDir, '%04d.png')];
    const mp4 = join(mediaDir, `${id}.mp4`);
    const gif = join(mediaDir, `${id}.gif`);
    const poster = join(mediaDir, `${id}.png`);
    const thumb = join(mediaDir, `${id}-thumb.png`);
    await run(ffmpeg, [...input, '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4]);
    await run(ffmpeg, [
      ...input,
      '-vf',
      `fps=${gifFps},scale=${Math.min(gifWidth, scene.width)}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=3:diff_mode=rectangle`,
      '-loop',
      '0',
      gif,
    ]);
    await copyFile(join(frameDir, `${String(posterFrame).padStart(4, '0')}.png`), poster);
    await run(ffmpeg, ['-y', '-loglevel', 'error', '-i', poster, '-vf', 'scale=640:-1:flags=lanczos', thumb]);
    console.log(`  gif ${await kb(gif)} · mp4 ${await kb(mp4)} · poster ${await kb(poster)} · thumb ${await kb(thumb)}`);
    if (!flag('keep-frames')) await rm(frameDir, { recursive: true, force: true });
  }
} finally {
  await browser.close();
  await new Promise((done) => server.httpServer.close(done));
}
