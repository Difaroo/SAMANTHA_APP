import { test, expect } from '@playwright/test';
import { mockPrismSeed, mockVoiceToken } from './helpers';

type PostedMutation = {
  id?: string;
  entityType?: string;
  entityId?: string;
  value?: { text?: string; nextRank?: string | null };
};

test.describe('Samantha App user outcome contracts', () => {
  test('offline task creation, Next prioritization, and sync recovery', async ({ page, context }) => {
    await mockPrismSeed(page);

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Next' })).toBeVisible();
    await expect(page.getByText('Implement WebRTC Bridge')).toBeVisible();

    await context.setOffline(true);
    await page.getByRole('button', { name: 'Projects' }).click();
    await page.getByRole('heading', { name: 'Samantha Audio Core' }).click();
    await page.getByRole('button', { name: 'Add Task' }).click();
    await page.getByRole('dialog', { name: 'Task detail' }).getByRole('button', { name: 'Edit' }).click();
    await page.locator('input[type="text"]').fill('Offline Contract Task');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('dialog', { name: 'Task detail' })).toContainText('Offline Contract Task');
    await page.getByRole('button', { name: 'Close task detail' }).click();
    await expect(page.getByText('Offline Contract Task')).toBeVisible();

    await page.getByRole('button', { name: 'Add to Next' }).last().click();
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Offline Contract Task', level: 3 })).toBeVisible();

    const persisted = await page.evaluate(() => localStorage.getItem('samantha-entity-storage') || '');
    expect(persisted).toContain('Offline Contract Task');

    let pushedMutations: PostedMutation[] = [];
    await page.route('**/api/v1/sync', async (route) => {
      const request = route.request().postDataJSON() as { mutations?: PostedMutation[] };
      pushedMutations = request.mutations || [];
      await route.fulfill({
        status: 200,
        headers: { 'Access-Control-Allow-Origin': '*' },
        contentType: 'application/json',
        body: JSON.stringify({
          schemaVersion: 1,
          revision: 2,
          cursor: 2,
          streams: [],
          acknowledgements: pushedMutations.map((mutation) => ({
            id: mutation.id,
            status: 'applied',
            entityType: mutation.entityType,
            entityId: mutation.entityId,
            version: 1,
          })),
          conflicts: [],
          hasMore: false,
        }),
      });
    });

    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event('online')));

    await expect.poll(() => {
      const task = pushedMutations.find((mutation) => mutation.value?.text === 'Offline Contract Task');
      return Boolean(task?.value?.nextRank);
    }).toBe(true);
  });

  test('voice bridge connect and push-to-talk control are accessible user flows', async ({ page }) => {
    await mockPrismSeed(page);
    await mockVoiceToken(page);

    await page.goto('/');
    await page.getByRole('button', { name: 'Voice', exact: true }).click();
    await page.getByRole('button', { name: 'Connect', exact: true }).click();

    await expect(page.getByRole('button', { name: 'Disconnect voice' })).toBeVisible();
    await expect(page.getByLabel('Voice transcript')).toBeVisible();
    await expect(page.getByRole('button', { name: /subtitles/i })).toHaveCount(0);
    await page.getByRole('button', { name: 'Enable push to talk' }).click();
    await expect(page.getByRole('button', { name: 'Disable push to talk' })).toBeVisible();

    const ptt = page.getByRole('button', { name: 'Push to Talk', exact: true });
    await ptt.dispatchEvent('pointerdown', { pointerType: 'touch' });
    await expect(page.getByRole('status', { name: 'Voice status' })).toHaveText('Listening');
    await ptt.dispatchEvent('pointerup', { pointerType: 'touch' });
    await expect(page.getByRole('status', { name: 'Voice status' })).toHaveText('Standby');
  });
});
