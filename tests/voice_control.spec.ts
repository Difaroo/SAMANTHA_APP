import { test, expect } from '@playwright/test';

test.describe('Voice Control Surface', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Voice' }).click();
    await expect(page.getByRole('button', { name: 'Connect', exact: true })).toBeVisible({ timeout: 3000 });
  });

  test('Connect button is visible when disconnected', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Connect', exact: true })).toBeVisible();
  });

  test('Connection failure gracefully handles error', async ({ page }) => {
    // Abort the token request to simulate network failure
    await page.route('**/api/voice/token**', route => route.abort());
    
    await page.getByRole('button', { name: 'Connect', exact: true }).click();
    
    // Should show error message with 'text-destructive' class
    await expect(page.locator('.text-destructive')).toBeVisible({ timeout: 5000 });
  });

  test('Can navigate away from voice view after connection failure', async ({ page }) => {
    await page.route('**/api/voice/token**', route => route.abort());
    
    await page.getByRole('button', { name: 'Connect', exact: true }).click();
    await expect(page.locator('.text-destructive')).toBeVisible({ timeout: 5000 });
    
    // Navigate to Backlog — app should not crash
    await page.getByRole('button', { name: 'Backlog' }).click();
    await expect(page.getByRole('heading', { name: 'Global Backlog' })).toBeVisible({ timeout: 3000 });
  });
});
