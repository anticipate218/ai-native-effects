/**
 * Quality gate for the showcase site and every effect: runtime errors, responsive
 * layout, accessibility (axe-core), a frame-time budget and reduced-motion support.
 * Runs against the production build (`npm run build`) on a desktop and a mobile profile.
 */
import { readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

interface Effect {
  id: string;
  tag: string;
  status: string;
}

const effects = (JSON.parse(readFileSync('effects.json', 'utf8')).effects as Effect[]).filter(
  (effect) => effect.status === 'stable',
);
const pages = ['index.html', ...effects.map((effect) => `effects/${effect.id}.html`)];

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  return errors;
}

for (const path of pages) {
  test.describe(path, () => {
    test('loads without errors', async ({ page }) => {
      const errors = collectErrors(page);
      await page.goto(path);
      await page.waitForTimeout(1000);
      expect(errors).toEqual([]);
    });

    test('has no horizontal overflow', async ({ page }) => {
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });

    test('passes axe WCAG 2.2 AA checks', async ({ page }) => {
      await page.goto(path);
      await page.waitForTimeout(600);
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze();
      const blocking = results.violations
        .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
        .map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`);
      expect(blocking).toEqual([]);
    });
  });
}

for (const effect of effects) {
  test.describe(`<${effect.tag}>`, () => {
    test('stays within the frame budget', async ({ page }) => {
      await page.goto(`effects/${effect.id}.html`);
      await page.waitForTimeout(300);
      await page.evaluate(() => window.__ane!.resetTickerStats());
      await page.waitForTimeout(2000);
      const stats = await page.evaluate(() => window.__ane!.getTickerStats());
      expect(stats.frames, 'animation loop should be running').toBeGreaterThan(30);
      expect(stats.averageWorkMs, 'mean JS time per frame (ms)').toBeLessThan(2);
    });

    test('respects prefers-reduced-motion', async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(`effects/${effect.id}.html`);
      const element = page.locator(effect.tag).first();
      await expect(element).toBeVisible();
      expect(await element.evaluate((el) => (el as HTMLElement & { reducedMotion: boolean }).reducedMotion)).toBe(true);
    });

    test('fits a 320px wide screen', async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 640 });
      await page.goto(`effects/${effect.id}.html`);
      const box = await page.locator(effect.tag).first().boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(320);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });

    test('pauses while off-screen', async ({ page }) => {
      await page.goto(`effects/${effect.id}.html`);
      await page.waitForTimeout(300);
      const visible = await page.evaluate(() => window.__ane!.getTickerStats().subscribers);
      expect(visible).toBeGreaterThan(0);
      await page.evaluate(() => {
        document.querySelectorAll('main > *').forEach((node) => ((node as HTMLElement).style.marginTop = '0'));
        const spacer = document.createElement('div');
        spacer.style.height = '5000px';
        document.querySelector('main')!.prepend(spacer);
        window.scrollTo(0, 0);
      });
      await page.waitForTimeout(400);
      expect(await page.evaluate(() => window.__ane!.getTickerStats().subscribers)).toBe(0);
    });
  });
}

test('gallery lists every stable effect', async ({ page }) => {
  await page.goto('index.html');
  await expect(page.locator('#effect-grid .card')).toHaveCount(effects.length);
});

test('thinking buddy playground drives the element and the snippet', async ({ page }) => {
  await page.goto('effects/thinking-buddy.html');
  const buddy = page.locator('#buddy');
  await page.getByRole('button', { name: 'success', exact: true }).click();
  await expect(buddy).toHaveAttribute('state', 'success');
  await expect(page.locator('#code-snippet')).toContainText('state="success"');
  await expect(page.locator('#event-log')).toContainText('thinking → success');

  await page.getByRole('tab', { name: 'React' }).click();
  await expect(page.locator('#code-snippet')).toContainText("import 'ai-native-effects/thinking-buddy'");

  await page.getByLabel('Speed').evaluate((input: HTMLInputElement) => {
    input.value = '2';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect(buddy).toHaveAttribute('speed', '2');
  const label = await buddy.evaluate((el) => el.shadowRoot!.querySelector('svg')!.getAttribute('aria-label'));
  expect(label).toBe('AI assistant finished successfully');
});

test('orbit loading screen playground drives progress, steps and full screen', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('effects/orbit-loading-screen.html');
  const screen = page.locator('#effect');
  const meter = screen.locator('[role="progressbar"]');
  await expect(meter).toHaveAttribute('aria-valuenow', '62');
  await expect(meter).toHaveAttribute('aria-labelledby', 'heading');

  await page.getByLabel('Active step').evaluate((input: HTMLInputElement) => {
    input.value = '3';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect(screen).toHaveAttribute('step', '3');
  await expect(screen.locator('.steps li').nth(3)).toHaveAttribute('data-status', 'active');
  await expect(page.locator('#code-snippet')).toContainText('step="3"');

  await page.getByRole('button', { name: 'Indeterminate' }).click();
  await expect(meter).not.toHaveAttribute('aria-valuenow');

  await page.getByRole('button', { name: 'Full screen', exact: true }).click();
  await expect(screen).toHaveAttribute('fullscreen', '');
  const viewport = page.viewportSize()!;
  const box = (await screen.boundingBox())!;
  expect(Math.round(box.width)).toBe(viewport.width);
  expect(Math.round(box.height)).toBe(viewport.height);
  await expect(page.getByRole('button', { name: 'Exit full screen' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(screen).not.toHaveAttribute('fullscreen');

  await screen.evaluate((el) => el.setAttribute('progress', '1'));
  await expect(page.locator('#event-log')).toContainText('ane-complete', { timeout: 5000 });
  await expect(meter).toHaveAttribute('aria-valuetext', 'Complete');
  expect(errors).toEqual([]);
});

test('token stream playground streams, skips and resets', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('effects/token-stream.html');
  const stream = page.locator('#effect');
  const body = stream.locator('.body');
  await expect(body).toHaveAttribute('aria-busy', 'true');
  await expect(body).toContainText('Flood extent grew by 38%', { timeout: 5000 });

  await page.getByRole('button', { name: 'Skip' }).click();
  await expect(body).toContainText('export the change map as a GeoTIFF.');
  await expect(body).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('#event-log')).toContainText('ane-stream-end');

  await page.getByRole('button', { name: 'char', exact: true }).click();
  await expect(stream).toHaveAttribute('granularity', 'char');
  await page.getByRole('button', { name: '中文回答' }).click();
  await expect(body).toContainText('洪水范围扩大了', { timeout: 8000 });
  await expect(page.locator('#code-snippet')).toContainText('granularity="char"');

  await page.getByRole('button', { name: 'Reset' }).click();
  await expect(body).toHaveText('');
  expect(errors).toEqual([]);
});

test('scan reveal playground autoplays, switches to manual control and replays', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('effects/scan-reveal.html');
  const scan = page.locator('#effect');
  await expect(scan).not.toHaveAttribute('progress');
  await expect(scan.locator('.phase')).toHaveText(/Acquiring|Analyzing|Complete/);

  const set = async (label: string, value: string): Promise<void> => {
    await page.getByLabel(label).evaluate((input: HTMLInputElement, v) => {
      input.value = v;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }, value);
  };
  await set('Acquisition (drive manually)', '0.5');
  await expect(scan).toHaveAttribute('progress', '0.5');
  await expect(scan.locator('.pct')).toHaveText('50%');
  await set('Ground-track angle (°)', '20');
  await expect(scan).toHaveAttribute('angle', '20');
  await expect(page.locator('#code-snippet')).toContainText('angle="20"');

  await set('Acquisition (drive manually)', '1');
  await expect(page.locator('#event-log')).toContainText('acquisition', { timeout: 5000 });

  await page.getByRole('button', { name: 'Replay autoplay' }).click();
  await expect(scan).not.toHaveAttribute('progress');
  await expect(scan).toBeInViewport();
  await expect(scan.locator('.phase')).toHaveText('Acquiring');
  expect(await scan.evaluate((el) => (el as HTMLElement & { webgl: boolean }).webgl)).toBe(true);
  expect(errors).toEqual([]);
});

test('agent flow playground simulates a run, expands steps and adapts its layout', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('effects/agent-flow.html');
  const flow = page.locator('#effect');
  const plan = flow.locator('li.node[data-kind="plan"]');
  await expect(plan).toHaveAttribute('data-status', 'done', { timeout: 5000 });
  await expect(flow.locator('li.node')).toHaveCount(7, { timeout: 12000 });
  await expect(flow.locator('li.node[data-status="done"]')).toHaveCount(7, { timeout: 12000 });

  // Steps are real buttons: keyboard expands them and reveals the output.
  const s1 = flow.locator('li.node[data-kind="retrieve"]');
  const button = s1.locator('button.card');
  await button.focus();
  await page.keyboard.press('Enter');
  await expect(button).toHaveAttribute('aria-expanded', 'true');
  await expect(s1.locator('.output')).toContainText('S1A_IW_GRDH');
  await expect(page.locator('#event-log')).toContainText('expanded');

  await page.getByRole('button', { name: 'Fail a step' }).click();
  await expect(flow.locator('li.node[data-status="error"]')).toHaveCount(1);

  await page.getByRole('button', { name: 'stack', exact: true }).click();
  await expect(flow).toHaveAttribute('layout', 'stack');
  expect(await flow.evaluate((el) => (el as HTMLElement & { stacked: boolean }).stacked)).toBe(true);
  await page.getByRole('button', { name: 'light', exact: true }).click();
  await expect(page.locator('#code-snippet')).toContainText('theme="light"');
  expect(errors).toEqual([]);
});

test('glass lens playground reads, highlights citations and follows the pointer', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('effects/glass-lens.html');
  const lens = page.locator('#effect');
  await expect(lens).toHaveAttribute('mode', 'read');
  await expect(page.locator('#event-log')).toContainText('#1:', { timeout: 15000 });
  expect(await lens.evaluate((el) => (el as HTMLElement & { found: Element[] }).found.length)).toBeGreaterThan(0);
  // The content stays real, selectable text.
  await expect(lens.locator('mark').first()).toHaveText('The river peaked on 11 June at 15.9 metres');

  await page.getByRole('button', { name: 'follow', exact: true }).click();
  await expect(lens).toHaveAttribute('mode', 'follow');
  const art = page.locator('.glass-art');
  await art.scrollIntoViewIfNeeded();
  const box = (await art.boundingBox())!;
  if (test.info().project.name === 'mobile') await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  else await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 5 });
  await expect
    .poll(() => lens.evaluate((el) => Number(getComputedStyle(el.shadowRoot!.querySelector('.lens')!).opacity)))
    .toBeGreaterThan(0.8);
  expect(await lens.evaluate((el) => (el.shadowRoot!.querySelector('.content') as HTMLElement).style.filter)).toContain('#ane-glass');
  expect(errors).toEqual([]);
});

test('image reveal playground denoises, compares and follows server steps', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('effects/image-reveal.html');
  const reveal = page.locator('#effect');
  await expect(reveal).toHaveAttribute('compare', '');
  await expect(reveal).toHaveAttribute('data-phase', 'done', { timeout: 8000 });
  await expect(page.locator('#event-log')).toContainText('ane-reveal-complete');
  expect(await reveal.evaluate((el) => (el as HTMLElement & { webgl: boolean }).webgl)).toBe(true);

  // The compare divider is a keyboard-operable slider.
  const knob = reveal.locator('[role="slider"]');
  await expect(knob).toHaveAttribute('aria-valuenow', '50', { timeout: 4000 });
  await knob.focus();
  await page.keyboard.press('Home');
  await expect(knob).toHaveAttribute('aria-valuenow', '0');
  await page.keyboard.press('ArrowRight');
  await expect(knob).toHaveAttribute('aria-valuenow', '2');

  // Driven mode: the counter reports the backend's step.
  await page.getByLabel('Progress (drive manually)').evaluate((input: HTMLInputElement) => {
    input.value = '0.5';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect(reveal).toHaveAttribute('progress', '0.5');
  await expect(reveal.locator('[role="progressbar"]')).toHaveAttribute('aria-valuetext', 'Step 15 of 30');
  expect(errors).toEqual([]);
});

test('aurora playground renders with WebGL, switches palettes and keeps content interactive', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('effects/aurora.html');
  const aurora = page.locator('#effect');
  expect(await aurora.evaluate((el) => (el as HTMLElement & { webgl: boolean }).webgl)).toBe(true);
  // The background fills its container.
  const host = (await aurora.boundingBox())!;
  const panel = (await page.locator('#viewport').boundingBox())!;
  expect(host.width).toBeGreaterThan(panel.width - 4);

  await page.getByRole('button', { name: 'ember', exact: true }).click();
  await expect(aurora).toHaveAttribute('palette', 'ember');
  await expect(page.locator('#code-snippet')).toContainText('palette="ember"');

  // Slotted hero content stays real, clickable HTML.
  await expect(aurora.getByRole('link', { name: 'Start for free' })).toBeVisible();
  await aurora.hover();
  expect(errors).toEqual([]);
});

test('decrypt text playground decodes, morphs custom text and stays jitter-free', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('effects/decrypt-text.html');
  const title = page.locator('#effect');
  await expect(title).toHaveAttribute('aria-label', 'Interfaces that');
  // Only the done handler writes the decoded text into the log.
  await expect(page.locator('#event-log')).toContainText('· Interfaces that', { timeout: 6000 });

  // The headline keeps its width while it re-decodes (no layout jitter).
  const before = (await title.boundingBox())!.width;
  await page.getByRole('button', { name: 'Decode again' }).click();
  await expect.poll(() => title.evaluate((el) => (el as HTMLElement & { decoding: boolean }).decoding), { timeout: 3000, intervals: [20] }).toBe(true);
  expect(Math.abs((await title.boundingBox())!.width - before)).toBeLessThan(1.5);

  await page.getByLabel('Your text').fill('Decode anything 你好');
  await page.getByRole('button', { name: 'Morph' }).click();
  await expect(title).toHaveAttribute('aria-label', 'Decode anything 你好');
  await expect(page.locator('#event-log')).toContainText('Decode anything 你好', { timeout: 6000 });

  await page.getByLabel('Charset').selectOption('hex');
  await expect(page.locator('#code-snippet')).toContainText('charset="hex"');
  expect(errors).toEqual([]);
});

test('magnet dock playground magnifies under the pointer, follows the keyboard and launches', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('effects/magnet-dock.html');
  const dock = page.locator('#effect');
  await expect(dock).toHaveAttribute('role', 'toolbar');
  const music = page.getByRole('button', { name: 'Music' });
  const files = page.getByRole('button', { name: 'Files' });
  const rest = (await music.boundingBox())!.width;
  const label = dock.locator('.label');

  // Hover: the icon under the pointer swells, its far neighbour barely moves, the label names it.
  const box = (await music.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await expect.poll(async () => (await music.boundingBox())!.width / rest, { timeout: 3000 }).toBeGreaterThan(1.6);
  expect((await files.boundingBox())!.width / rest).toBeLessThan(1.1);
  await expect(label).toHaveText('Music');
  await expect.poll(() => label.evaluate((el) => Number(getComputedStyle(el).opacity))).toBeGreaterThan(0.9);

  // Leaving the dock settles everything back.
  await page.mouse.move(box.x + box.width / 2, box.y - 260);
  await expect.poll(async () => (await music.boundingBox())!.width / rest, { timeout: 3000 }).toBeLessThan(1.02);

  // Keyboard: one tab stop, arrows move focus and the focused icon magnifies.
  await files.focus();
  await page.keyboard.press('ArrowRight');
  const messages = page.getByRole('button', { name: 'Messages' });
  await expect(messages).toBeFocused();
  await expect(messages).toHaveAttribute('tabindex', '0');
  await expect(files).toHaveAttribute('tabindex', '-1');
  await expect.poll(async () => (await messages.boundingBox())!.width / rest, { timeout: 3000 }).toBeGreaterThan(1.6);
  await expect(label).toHaveText('Messages');

  // Launch: the event fires and the playground shows the activity dot.
  await page.keyboard.press('ArrowRight');
  const mail = page.getByRole('button', { name: 'Mail' });
  await expect(mail).toBeFocused();
  await expect(mail).not.toHaveAttribute('data-active');
  await page.keyboard.press('Enter');
  await expect(page.locator('#event-log')).toContainText('Mail opened');
  await expect(mail).toHaveAttribute('data-active', '');

  await page.getByLabel('Magnify').fill('1');
  await expect(page.locator('#code-snippet')).toContainText('magnify="1"');
  expect(errors).toEqual([]);
});

test('magnet dock snaps without springs under reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('effects/magnet-dock.html');
  const music = page.getByRole('button', { name: 'Music' });
  const rest = (await music.boundingBox())!.width;
  const box = (await music.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await expect.poll(async () => (await music.boundingBox())!.width / rest, { timeout: 2000 }).toBeCloseTo(1.3, 1);
  const files = page.getByRole('button', { name: 'Files' });
  expect((await files.boundingBox())!.width / rest).toBeCloseTo(1, 2);
});

test('holographic tilt card follows the pointer, settles back to its sway and reacts to the controls', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('effects/tilt-holo-card.html');
  const card = page.locator('#effect');
  const angles = () => card.evaluate((el) => (el as HTMLElement & { tiltAngles: [number, number] }).tiltAngles);
  await card.evaluate((el) => el.setAttribute('idle', 'off'));
  await card.scrollIntoViewIfNeeded();
  const box = (await card.boundingBox())!;

  // Pointer near the top-right corner: the top and the right side dip away.
  await page.mouse.move(box.x + box.width * 0.9, box.y + box.height * 0.1);
  await expect.poll(async () => (await angles())[1], { timeout: 3000 }).toBeGreaterThan(10);
  expect((await angles())[0]).toBeGreaterThan(8);
  // Bottom-left: the opposite.
  await page.mouse.move(box.x + box.width * 0.1, box.y + box.height * 0.9);
  await expect.poll(async () => (await angles())[1], { timeout: 3000 }).toBeLessThan(-10);
  expect((await angles())[0]).toBeLessThan(-8);
  // The glare follows: --px near the left edge.
  expect(Number(await card.evaluate((el) => (el as HTMLElement).style.getPropertyValue('--px')))).toBeLessThan(25);

  // Leaving with idle off settles to the resting pose.
  await page.mouse.move(box.x - 200, box.y - 100);
  await expect.poll(async () => Math.abs((await angles())[1]), { timeout: 3000 }).toBeLessThan(5);

  // Keyboard: the card face is a link; focusing it tilts the card.
  await page.locator('.hc-link').focus();
  await expect.poll(async () => (await angles())[1], { timeout: 3000 }).toBeGreaterThan(5);

  await page.getByRole('button', { name: 'scales' }).click();
  await expect(card).toHaveAttribute('foil', 'scales');
  await expect(page.locator('#code-snippet')).toContainText('foil="scales"');
  expect(await card.evaluate((el) => (el as HTMLElement).style.getPropertyValue('--_pattern'))).toContain('data:image/png');
  expect(errors).toEqual([]);
});

test('holographic tilt card stays flat under reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('effects/tilt-holo-card.html');
  const card = page.locator('#effect');
  const box = (await card.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.9, box.y + box.height * 0.1);
  await page.waitForTimeout(500);
  expect(await card.evaluate((el) => (el as HTMLElement & { tiltAngles: [number, number] }).tiltAngles)).toEqual([0, 0]);
});

test('spotlight grid follows the pointer, lights neighbouring borders and sends a wave', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('effects/spotlight-grid.html');
  const grid = page.locator('#effect');
  await grid.evaluate((el) => el.setAttribute('idle', 'off'));
  await grid.scrollIntoViewIfNeeded();
  const cards = grid.locator('article');
  await expect(cards).toHaveCount(5);
  const b = (await cards.nth(1).boundingBox())!;
  const g = (await grid.boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  const v = (p: string) => grid.evaluate((el, prop) => parseFloat((el as HTMLElement).style.getPropertyValue(prop)), p);
  await expect.poll(() => v('--i'), { timeout: 3000 }).toBeGreaterThan(0.9);
  await expect.poll(async () => Math.abs((await v('--x')) - (b.x - g.x + b.width / 2)), { timeout: 3000 }).toBeLessThan(4);

  // Click: a wave runs through the wall and lights rings as it passes.
  await page.mouse.down();
  await page.mouse.up();
  await expect
    .poll(() => grid.evaluate((el) => Math.max(...[...el.shadowRoot!.querySelectorAll<HTMLElement>('.ring')].map((r) => parseFloat(r.style.getPropertyValue('--pulse') || '0')))), { timeout: 2000 })
    .toBeGreaterThan(0.2);

  // Keyboard: focusing a card moves the light to it.
  await page.mouse.move(g.x - 300, g.y - 200);
  await cards.nth(4).focus();
  const c = (await cards.nth(4).boundingBox())!;
  await expect.poll(async () => Math.abs((await v('--x')) - (c.x - g.x + c.width / 2)), { timeout: 3000 }).toBeLessThan(4);

  await page.getByRole('button', { name: 'off', exact: true }).first().click();
  await expect(page.locator('#code-snippet')).toContainText('dots="off"');
  expect(errors).toEqual([]);
});

test('ascii field renders with WebGL, morphs words and reacts to the pointer', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('effects/ascii-field.html');
  const field = page.locator('#effect');
  await field.scrollIntoViewIfNeeded();
  expect(await field.evaluate((el) => (el as HTMLElement & { webgl: boolean }).webgl)).toBe(true);
  expect(await field.evaluate((el) => (el as HTMLElement & { renderScale: number }).renderScale)).toBeGreaterThan(0);
  await expect(field).toHaveAttribute('text', 'HELLO');
  await expect(field.getByText('Characters with somewhere to be.')).toBeVisible();

  await page.getByLabel('Morph to').fill('Glyph');
  await page.getByRole('button', { name: 'Morph' }).click();
  await expect(field).toHaveAttribute('text', 'GLYPH', { timeout: 5000 });
  expect(await field.evaluate((el) => el.shadowRoot!.querySelector('.sr')!.textContent)).toBe('GLYPH');

  const box = (await field.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 3);
  await page.mouse.down();
  await page.mouse.up();
  await page.getByLabel('Charset').selectOption('blocks');
  await expect(page.locator('#code-snippet')).toContainText('charset="blocks"');
  expect(errors).toEqual([]);
});

test('dither gradient renders with WebGL, switches palettes, dithers an image and shows a lens', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('effects/dither-gradient.html');
  const el = page.locator('#effect');
  await el.scrollIntoViewIfNeeded();
  expect(await el.evaluate((n) => (n as HTMLElement & { webgl: boolean }).webgl)).toBe(true);
  await expect(el.getByText('Move the pointer to look through the lens.')).toBeVisible();

  await page.getByLabel('Palette').selectOption('gameboy');
  await expect(el).toHaveAttribute('palette', 'gameboy');
  expect(await el.evaluate((n) => (n as HTMLElement & { palette: number[][] }).palette.length)).toBe(4);
  await page.getByRole('button', { name: 'bayer4', exact: true }).click();
  await expect(page.locator('#code-snippet')).toContainText('dither="bayer4"');

  await page.getByRole('button', { name: 'Dither a photo' }).click();
  await expect(el).toHaveAttribute('src', /^data:image\/png/);
  await page.getByRole('button', { name: 'Back to gradient' }).click();
  await expect(el).not.toHaveAttribute('src');

  const box = (await el.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(300);
  expect(errors).toEqual([]);
});

test('glass tabs: click, keyboard and drag move the glass lens; the panel follows', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('effects/glass-tabs.html');
  const tabs = page.locator('#effect');
  await tabs.scrollIntoViewIfNeeded();
  await expect(tabs).toHaveAttribute('role', 'tablist');
  await expect(page.locator('#panel h3')).toHaveText('Week');
  const lensX = () =>
    tabs.evaluate((el) => {
      const lens = el.shadowRoot!.querySelector<HTMLElement>('.lens')!.getBoundingClientRect();
      return lens.left + lens.width / 2;
    });
  const tab = (name: string) => tabs.getByRole('tab', { name, exact: true });
  const centre = async (name: string) => {
    const b = (await tab(name).boundingBox())!;
    return b.x + b.width / 2;
  };

  await tab('Month').click();
  await expect(tab('Month')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#panel h3')).toHaveText('Month');
  await expect(page.locator('#event-log')).toContainText('Month');
  await expect.poll(async () => Math.abs((await lensX()) - (await centre('Month'))), { timeout: 3000 }).toBeLessThan(2);

  // Keyboard: selection follows focus.
  await page.keyboard.press('ArrowRight');
  await expect(tab('Year')).toBeFocused();
  await expect(page.locator('#panel h3')).toHaveText('Year');

  // Drag the lens back to "Day".
  const from = await centre('Year');
  const to = await centre('Day');
  const box = (await tabs.boundingBox())!;
  const y = box.y + box.height / 2;
  await page.mouse.move(from, y);
  await page.mouse.down();
  for (let k = 1; k <= 8; k++) await page.mouse.move(from + ((to - from) * k) / 8, y);
  await page.mouse.up();
  await expect(page.locator('#panel h3')).toHaveText('Day');
  await expect.poll(async () => Math.abs((await lensX()) - (await centre('Day'))), { timeout: 3000 }).toBeLessThan(2);

  // The refraction filter is attached to the tab content.
  expect(await tabs.evaluate((el) => (el.shadowRoot!.querySelector<HTMLElement>('.content')!.style.filter || '').startsWith('url('))).toBe(true);
  await page.getByLabel('Liquid stretch').fill('0.3');
  await expect(page.locator('#code-snippet')).toContainText('stretch="0.3"');
  expect(errors).toEqual([]);
});

test('hold button: early release drains back, a full hold confirms (mouse and keyboard)', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('effects/hold-button.html');
  const btn = page.locator('#effect');
  await btn.scrollIntoViewIfNeeded();
  await expect(btn).toHaveAttribute('role', 'button');
  await page.getByLabel('Hold time (ms)').fill('800');
  const progress = () => btn.evaluate((el) => (el as HTMLElement & { progress: number }).progress);
  const confirmed = () => btn.evaluate((el) => (el as HTMLElement & { confirmed: boolean }).confirmed);
  // The range control scrolls the page (smoothly on mobile): re-aim at the button before each press.
  const aim = async () => {
    await btn.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    const box = (await btn.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  };

  // Short press: progress rises, then drains back to zero.
  await aim();
  await page.mouse.down();
  await expect.poll(progress, { timeout: 2000 }).toBeGreaterThan(0.2);
  await page.mouse.up();
  await expect(page.locator('#event-log')).toContainText('ane-hold-cancel');
  await expect.poll(progress, { timeout: 3000 }).toBe(0);
  expect(await confirmed()).toBe(false);

  // Full hold: confirmed.
  await aim();
  await page.mouse.down();
  await expect.poll(confirmed, { timeout: 3000 }).toBe(true);
  await page.mouse.up();
  await expect(page.locator('#event-log')).toContainText('ane-hold-complete');
  await btn.evaluate((el) => (el as HTMLElement & { reset(): void }).reset());

  // Keyboard: hold Space on the second button.
  const pub = page.locator('#publish');
  await pub.focus();
  await page.keyboard.down('Space');
  await expect.poll(() => pub.evaluate((el) => (el as HTMLElement & { confirmed: boolean }).confirmed), { timeout: 3000 }).toBe(true);
  await page.keyboard.up('Space');
  expect(errors).toEqual([]);
});
