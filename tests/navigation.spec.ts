import { test, expect, type Page } from '@playwright/test';
import { mockPrismSeed } from './helpers';

async function swipeHorizontally(page: Page, fromX: number, toX: number, y = 350) {
  const client = await page.context().newCDPSession(page);
  await client.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: fromX, y }],
  });
  for (let step = 1; step <= 10; step += 1) {
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: fromX + ((toX - fromX) * step) / 10, y }],
    });
  }
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await client.detach();
}

test.describe('Navigation Control Flow', () => {
  test.beforeEach(async ({ page }) => {
    await mockPrismSeed(page);
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Connect', exact: true })).toBeVisible();
  });

  test('BottomNav routes correctly update the view', async ({ page }) => {
    // Navigate to Voice
    await page.getByRole('button', { name: 'Voice', exact: true }).click();
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
      await expect(page.getByRole('button', { name: label, exact: true })).toBeVisible();
    }
  });

  test('Default view is Voice on fresh load', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Connect', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Voice', exact: true }))
      .toHaveClass(/text-primary/);
  });

  test('horizontal swipes navigate between adjacent main views', async ({ page }) => {
    await swipeHorizontally(page, 330, 60);
    await expect(page.getByRole('button', { name: 'Projects' })).toHaveClass(/text-primary/);

    await swipeHorizontally(page, 330, 60);
    await expect(page.getByRole('button', { name: 'Next' })).toHaveClass(/text-primary/);

    await swipeHorizontally(page, 60, 330);
    await expect(page.getByRole('button', { name: 'Projects' })).toHaveClass(/text-primary/);
    await expect(page.getByTestId('view-viewport')).toHaveJSProperty('scrollLeft', 0);
  });

  test('release version is visible in the app shell', async ({ page }) => {
    await expect(page.getByText('v2.4.15', { exact: true })).toBeVisible();
  });

  test('launch cover yields to the painted app without leaving an overlay', async ({ page }) => {
    await expect(page.getByTestId('samantha-lockup')).toBeVisible();
    await expect(page.locator('#launch-cover')).toHaveCount(0);
  });
});
