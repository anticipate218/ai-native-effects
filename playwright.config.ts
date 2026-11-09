import { defineConfig, devices } from '@playwright/test';

const PORT = 4319; // dedicated port: never reuse an unrelated local server
// Locally on Windows we drive the system Edge (no browser download needed);
// CI installs Playwright's Chromium.
const channel = !process.env.CI && process.platform === 'win32' ? { channel: 'msedge' } : {};

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  // Frame-budget and off-screen checks measure requestAnimationFrame and IntersectionObserver
  // timing. Too many parallel browsers starve the compositor and make them flaky, so cap
  // local workers (CI runners are small and use the default).
  workers: process.env.CI ? undefined : 4,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}/`,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], ...channel } },
    { name: 'mobile', use: { ...devices['Pixel 7'], ...channel } },
  ],
  // Tests run against the production build (npm run build) served by `vite preview`.
  webServer: {
    command: `npx vite preview --port ${PORT} --strictPort --host 127.0.0.1`,
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
