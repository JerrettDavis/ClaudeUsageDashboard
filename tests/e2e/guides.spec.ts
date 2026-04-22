import { expect, test } from '@playwright/test';

test('renders the guides hub with linked screenshots', async ({ page }) => {
  await page.goto('/guides');

  await expect(page.getByRole('heading', { name: 'Learn the dashboard fast' })).toBeVisible();
  await expect(page.getByText('Get started quickly')).toBeVisible();
  await expect(page.getByText('Browse and filter sessions')).toBeVisible();
  await expect(
    page
      .getByAltText('Dashboard overview showing metrics, quick actions, and recent sessions.')
      .first()
  ).toBeVisible();
  await expect(
    page
      .getByAltText('Tiling monitor showing an active Claude session and terminal-style history.')
      .first()
  ).toBeVisible();
});
