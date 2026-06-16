import { test, expect } from '@playwright/test';

test.describe('Backlog View', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Global Backlog' })).toBeVisible();
  });

  test('Initial epics render correctly', async ({ page }) => {
    // Verify at least one epic card is visible
    await expect(page.getByText('Implement WebRTC Bridge')).toBeVisible();
  });

  test('Clicking an epic card opens the detail overlay', async ({ page }) => {
    // Click the first epic card
    await page.getByText('Implement WebRTC Bridge').click();
    
    // The EpicDetailView overlay should appear with edit capability
    await expect(page.getByRole('button', { name: /Edit/i })).toBeVisible({ timeout: 3000 });
  });

  test('Play button navigates to timer and sets active epic', async ({ page }) => {
    // The play button should be inside an epic card
    const playButtons = page.locator('button').filter({ has: page.locator('svg.lucide-play') });
    await expect(playButtons.first()).toBeVisible();
    
    await playButtons.first().click();
    
    // Should navigate to timer view
    await expect(page.getByText('Psionic Membrane').or(page.getByText('Phase 1:'))).toBeVisible({ timeout: 3000 });
  });
});

test.describe('Projects View', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Projects' }).click();
    await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible({ timeout: 3000 });
  });

  test('Projects list renders', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Samantha Audio Core' })).toBeVisible();
  });

  test('Clicking a project drills into its epics', async ({ page }) => {
    await page.getByRole('heading', { name: 'Samantha Audio Core' }).click();
    
    // Should show project detail with back button
    await expect(page.locator('svg.lucide-arrow-left').first()).toBeVisible({ timeout: 3000 });
  });
});
