import { test, expect } from '@playwright/test';
import { mockPrismSeed, mockVoiceToken } from './helpers';

test.describe('Voice control surface', () => {
  test.beforeEach(async ({ page }) => {
    await mockPrismSeed(page);
    await page.goto('/');
    await page.getByRole('button', { name: 'Voice' }).click();
  });

  test('shows a clear connection affordance when disconnected', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Connect', exact: true })).toBeVisible();
    await expect(page.getByText('Disconnected')).toBeVisible();
  });

  test('connection failure leaves the rest of the app navigable', async ({ page }) => {
    await page.route('**/api/voice/token**', (route) => route.abort());

    await page.getByRole('button', { name: 'Connect', exact: true }).click();
    await expect(page.getByText(/Token failed|Failed to fetch|Connection failed|Cannot reach/i)).toBeVisible({ timeout: 15000 });

    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByRole('heading', { name: 'Next' })).toBeVisible();
  });

  test('connected voice session exposes PTT mode and disconnect controls', async ({ page }) => {
    await mockVoiceToken(page);

    await page.getByRole('button', { name: 'Connect', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Disconnect voice' })).toBeVisible();
    await expect(page.getByLabel('Voice transcript')).toContainText('Connected to voice bridge test adapter.');

    await page.getByRole('button', { name: 'Enable push to talk' }).click();
    await expect(page.getByRole('button', { name: 'Push to Talk', exact: true })).toBeVisible();
  });
});
