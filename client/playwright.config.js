import { defineConfig, devices } from '@playwright/test';
import { PORT } from './e2e/settings.mjs';

// Browser smoke tests. Run `npm run test:e2e` from the repository root: it builds the client first,
// because the test server serves client/dist.
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    // The Chrome already on the machine (and on GitHub's runners), so no browser download is needed
    channel: 'chrome',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1280, height: 800 } } },
    { name: 'phone', use: { ...devices['Pixel 7'], channel: 'chrome' } },
  ],
  webServer: {
    command: 'node e2e/start-server.mjs',
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
