import { test, expect } from '@playwright/test';
import { mockPrismSeed } from './helpers';

test.describe('Navigation Control Flow', () => {
  test.beforeEach(async ({ page }) => {
    await mockPrismSeed(page);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Next' })).toBeVisible();
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

    // Navigate back to Next
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByRole('heading', { name: 'Next' })).toBeVisible({ timeout: 3000 });
  });

  test('All four BottomNav buttons have accessible aria-labels', async ({ page }) => {
    for (const label of ['Voice', 'Projects', 'Next', 'Timer']) {
      await expect(page.getByRole('button', { name: label })).toBeVisible();
    }
  });

  test('Default view is Next on fresh load', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Next' })).toBeVisible();
  });

  test('release version is visible in the app shell', async ({ page }) => {
    await expect(page.getByText('v2.4.0', { exact: true })).toBeVisible();
  });
});
