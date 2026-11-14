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
