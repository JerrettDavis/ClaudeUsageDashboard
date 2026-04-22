import { expect, test } from '@playwright/test';

test('shows seeded dashboard metrics and recent activity', async ({ page }) => {
  await page.goto('/dashboard');

  await expect(page.getByRole('heading', { name: 'SYSTEM METRICS' })).toBeVisible();
  await expect(page.getByText('Total Sessions')).toBeVisible();
  await expect(page.getByRole('link', { name: 'ClaudeUsageDashboard', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sync Claude Data' })).toBeVisible();
});

test('filters sessions and opens a seeded detail page', async ({ page }) => {
  await page.goto('/sessions');

  await expect(page.getByRole('heading', { name: 'Sessions' })).toBeVisible();
  await page.getByRole('button', { name: 'Completed' }).click();
  await expect(page.getByText('API Playground')).toBeVisible();
  await expect(page.getByText('Docs Portal')).not.toBeVisible();

  await page.getByRole('button', { name: 'All' }).click();
  await page.getByRole('link', { name: 'View' }).first().click();

  await expect(page.getByText('SESSION SUMMARY')).toBeVisible();
  await expect(page.getByText('FILES')).toBeVisible();
  await expect(page.getByText('CONVERSATION')).toBeVisible();
  await expect(
    page.getByText('The new e2e suite now covers the highest-value product flows.')
  ).toBeVisible();
});

test('boots the tiling monitor from seeded active sessions', async ({ page }) => {
  await page.goto('/monitoring/sessions');

  await expect(page.getByRole('heading', { name: 'SESSION MONITOR' })).toBeVisible();
  await expect(page.getByText('demo-ses...').first()).toBeVisible();
  await expect(
    page.getByText('Add a guide page for new users and capture screenshots for the docs.')
  ).toBeVisible();
});
