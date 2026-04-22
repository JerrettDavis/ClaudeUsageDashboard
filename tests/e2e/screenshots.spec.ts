import path from 'node:path';
import { expect, test } from '@playwright/test';

const shouldCapture = process.env.CAPTURE_PRODUCT_SCREENSHOTS === '1';
const screenshotDir = path.join(process.cwd(), 'public', 'screenshots');

test.describe('product screenshots', () => {
  test.skip(!shouldCapture, 'Run through npm run screenshots to refresh committed product images.');

  test('captures the dashboard surfaces used in docs', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: 'SYSTEM METRICS' })).toBeVisible();
    await page.screenshot({
      path: path.join(screenshotDir, 'dashboard-overview.png'),
      fullPage: true,
      animations: 'disabled',
    });

    await page.goto('/sessions');
    await expect(page.getByRole('heading', { name: 'Sessions' })).toBeVisible();
    await page.screenshot({
      path: path.join(screenshotDir, 'sessions-list.png'),
      fullPage: true,
      animations: 'disabled',
    });

    await page.goto('/sessions/demo-session-active');
    await expect(page.getByText('SESSION SUMMARY')).toBeVisible();
    await page.screenshot({
      path: path.join(screenshotDir, 'session-detail.png'),
      fullPage: true,
      animations: 'disabled',
    });

    await page.goto('/monitoring/sessions');
    await expect(page.getByRole('heading', { name: 'SESSION MONITOR' })).toBeVisible();
    await page.screenshot({
      path: path.join(screenshotDir, 'tiling-monitor.png'),
      fullPage: true,
      animations: 'disabled',
    });

    await page.goto('/guides');
    await expect(page.getByRole('heading', { name: 'Learn the dashboard fast' })).toBeVisible();
    await page.screenshot({
      path: path.join(screenshotDir, 'guides-hub.png'),
      fullPage: true,
      animations: 'disabled',
    });
  });
});
