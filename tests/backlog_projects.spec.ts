import { test, expect } from '@playwright/test';
import { mockPrismSeed } from './helpers';

test.describe('Next view', () => {
  test.beforeEach(async ({ page }) => {
    await mockPrismSeed(page);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Next' })).toBeVisible();
  });

  test('renders prioritized tasks from PRISM state', async ({ page }) => {
    await expect(page.getByText('Implement WebRTC Bridge')).toBeVisible();
    await expect(page.getByText('Write Contract Tests')).toBeVisible();
  });

  test('opening a task shows Task detail', async ({ page }) => {
    await page.getByText('Implement WebRTC Bridge').click();
    await expect(page.getByRole('dialog', { name: 'Task detail' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Edit/i })).toBeVisible();
  });

  test('Play starts the timer with the selected task context', async ({ page }) => {
    await page.getByRole('button', { name: 'Start Implement WebRTC Bridge' }).click();

    await expect(page.getByRole('heading', { name: 'Implement WebRTC Bridge', level: 1 })).toBeVisible({ timeout: 3000 });
    await expect(page.getByText('Phase 1: Grounding')).toBeVisible();
  });
});

test.describe('Projects view', () => {
  test.beforeEach(async ({ page }) => {
    await mockPrismSeed(page);
    await page.goto('/');
    await page.getByRole('button', { name: 'Projects' }).click();
    await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible({ timeout: 3000 });
  });

  test('lists projects and task counts', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Samantha Audio Core' })).toBeVisible();
    await expect(page.getByText('2 Tasks')).toBeVisible();
  });

  test('drills into one project screen with a draggable task list', async ({ page }) => {
    await page.getByRole('heading', { name: 'Samantha Audio Core' }).click();

    await expect(page.getByRole('heading', { name: 'Samantha Audio Core' })).toBeVisible();
    await expect(page.getByText('Verify Android Audio Route')).toBeVisible();
    await expect(page.locator('svg.lucide-grip-vertical').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add Task' })).toBeVisible();
  });
});
