import { test, expect } from '@playwright/test';

test.describe('Sprint Timer View', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Timer' }).click();
    await expect(page.getByText('Psionic Membrane')).toBeVisible({ timeout: 3000 });
  });

  test('Timer displays initial phase correctly', async ({ page }) => {
    await expect(page.getByText('Phase 1: Grounding')).toBeVisible();
    await expect(page.getByText('05:00')).toBeVisible();
  });

  test('INITIATE SEQUENCE button starts the timer', async ({ page }) => {
    await page.getByRole('button', { name: /INITIATE SEQUENCE/i }).click();
    
    // Timer should start counting down
    await expect(page.getByRole('button', { name: /PAUSE/i })).toBeVisible();
    
    // Wait 1.5s and verify time has changed
    await page.waitForTimeout(1500);
    await expect(page.getByText('04:5')).toBeVisible(); // 04:59 or 04:58
  });

  test('PAUSE button stops the timer', async ({ page }) => {
    await page.getByRole('button', { name: /INITIATE SEQUENCE/i }).click();
    await expect(page.getByRole('button', { name: /PAUSE/i })).toBeVisible();
    
    await page.getByRole('button', { name: /PAUSE/i }).click();
    
    // Should show RESUME SEQUENCE
    await expect(page.getByRole('button', { name: /RESUME SEQUENCE/i })).toBeVisible();
  });

  test('SKIP button advances to next phase', async ({ page }) => {
    await page.getByRole('button', { name: /INITIATE SEQUENCE/i }).click();
    
    // Click SKIP
    await page.getByRole('button', { name: 'SKIP' }).click();
    
    // Should advance to Phase 2 (SKIP sets timeLeft=1, takes ~2s to tick + transition)
    await expect(page.getByText('Phase 2: The Burn')).toBeVisible({ timeout: 5000 });
  });

  test('Settings button toggles config panel', async ({ page }) => {
    // Click settings
    await page.locator('button').filter({ has: page.locator('svg.lucide-settings') }).click();
    
    // Config panel should appear with phase duration inputs
    await expect(page.getByText('Cycle Config')).toBeVisible();
    
    // Close it
    await page.locator('button').filter({ has: page.locator('svg.lucide-settings') }).click();
    await expect(page.getByText('Cycle Config')).not.toBeVisible();
  });

  test('Config inputs reject invalid values (NaN guard)', async ({ page }) => {
    // Open config
    await page.locator('button').filter({ has: page.locator('svg.lucide-settings') }).click();
    
    // Find the Grounding input and clear it
    const inputs = page.locator('input[type="number"]');
    await inputs.first().fill('');
    
    // Timer should still display a valid time (not NaN:NaN)
    await expect(page.getByText('NaN')).not.toBeVisible();
  });
});
