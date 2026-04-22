import path from 'node:path';
import { defineConfig } from '@playwright/test';

const databasePath = path.join(process.cwd(), 'data', 'claude-dashboard.e2e.db');
const e2eHomeDir = path.join(process.cwd(), 'data', 'e2e-home');
const runAllBrowsers = process.env.PLAYWRIGHT_ALL_BROWSERS === '1';

process.env.DATABASE_URL = databasePath;
process.env.CLAUDE_USAGE_DASHBOARD_HOME = e2eHomeDir;
process.env.NEXT_TELEMETRY_DISABLED = '1';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI
    ? [['html', { open: 'never' }], ['github']]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:3000',
    colorScheme: 'dark',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    viewport: { width: 1440, height: 960 },
  },
  projects: runAllBrowsers
    ? [{ name: 'chromium' }, { name: 'firefox' }, { name: 'webkit' }]
    : [{ name: 'chromium' }],
  outputDir: 'test-results/playwright',
  webServer: {
    command: 'npm run e2e:seed && npm run dev -- --hostname 127.0.0.1 --port 3000',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    env: {
      ...process.env,
      DATABASE_URL: databasePath,
      CLAUDE_USAGE_DASHBOARD_HOME: e2eHomeDir,
      NEXT_TELEMETRY_DISABLED: '1',
    },
  },
});
