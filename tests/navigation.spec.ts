import { test, expect } from '@playwright/test';

test.describe('Navigation Control Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Default view is 'backlog'
    await expect(page.getByRole('heading', { name: 'Global Backlog' })).toBeVisible();
  });

  test('BottomNav routes correctly update the view', async ({ page }) => {
    // Navigate to Voice
    await page.getByRole('button', { name: 'Voice' }).click();
    await expect(page.getByRole('button', { name: 'Connect', exact: true })).toBeVisible({ timeout: 3000 });

    // Navigate to Projects
    await page.getByRole('button', { name: 'Projects' }).click();
    await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible({ timeout: 3000 });

    // Navigate to Timer
    await page.getByRole('button', { name: 'Timer' }).click();
    await expect(page.getByText('Psionic Membrane')).toBeVisible({ timeout: 3000 });

    // Navigate back to Backlog
    await page.getByRole('button', { name: 'Backlog' }).click();
    await expect(page.getByRole('heading', { name: 'Global Backlog' })).toBeVisible({ timeout: 3000 });
  });

  test('All four BottomNav buttons have accessible aria-labels', async ({ page }) => {
    for (const label of ['Voice', 'Projects', 'Backlog', 'Timer']) {
      await expect(page.getByRole('button', { name: label })).toBeVisible();
    }
  });

  test('Default view is Backlog on fresh load', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Global Backlog' })).toBeVisible();
  });
});
