import { expect, test } from '@playwright/test';

test('shows seeded analytics metrics, charts, and hotspots', async ({ page }) => {
  await page.goto('/analytics');

  await expect(
    page.getByRole('heading', {
      name: 'Real usage, workflow health, and where the agent spends time',
    })
  ).toBeVisible();
  await expect(page.getByText('Operator Analytics')).toBeVisible();
  await expect(page.getByText('Completion Rate')).toBeVisible();
  await expect(page.getByText('Tool Mix')).toBeVisible();
  await expect(page.getByText('Project Leaderboard')).toBeVisible();
  await expect(
    page.getByRole('table').getByText('ClaudeUsageDashboard', { exact: true })
  ).toBeVisible();
  await expect(page.getByText('.github/workflows')).toBeVisible();
  await expect(
    page
      .locator('section')
      .filter({ has: page.getByRole('heading', { name: 'Tool Mix' }) })
      .getByText('edit')
      .first()
  ).toBeVisible();
});

test('opens analytics from the main dashboard quick actions', async ({ page }) => {
  await page.goto('/dashboard');

  await page.getByRole('button', { name: 'Open Analytics' }).click();

  await expect(page).toHaveURL(/\/analytics$/);
  await expect(page.getByText('Operator Analytics')).toBeVisible();
});
