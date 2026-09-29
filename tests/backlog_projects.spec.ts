import { test, expect, type Page } from '@playwright/test';
import { mockPrismSeed } from './helpers';

async function dragTo(page: Page, source: ReturnType<Page['getByRole']>, target: ReturnType<Page['locator']>) {
  await source.scrollIntoViewIfNeeded();
  await target.scrollIntoViewIfNeeded();
  await expect(source).toBeInViewport();
  await expect(target).toBeInViewport();
  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();
  if (!sourceBox || !targetBox) throw new Error('Drag source or target is not visible');

  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 12 });
  await page.mouse.up();
}

async function touchHoldDragTo(page: Page, source: ReturnType<Page['getByRole']>, target: ReturnType<Page['locator']>) {
  await source.scrollIntoViewIfNeeded();
  await target.scrollIntoViewIfNeeded();
  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();
  if (!sourceBox || !targetBox) throw new Error('Touch drag source or target is not visible');

  const client = await page.context().newCDPSession(page);
  await client.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
  const start = { x: sourceBox.x + sourceBox.width / 2, y: sourceBox.y + sourceBox.height / 2 };
  const end = { x: targetBox.x + targetBox.width / 2, y: targetBox.y + targetBox.height / 2 };
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] });
  await page.waitForTimeout(300);
  for (let step = 1; step <= 12; step += 1) {
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{
        x: start.x + ((end.x - start.x) * step) / 12,
        y: start.y + ((end.y - start.y) * step) / 12,
      }],
    });
  }
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await client.detach();
}

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

  test('drag reorder updates and persists Next ranks', async ({ page, context }) => {
    await expect(page.getByText('Implement WebRTC Bridge')).toBeVisible();
    await context.setOffline(true);
    const handle = page.getByRole('button', { name: 'Drag Implement WebRTC Bridge' });
    await expect(handle).toHaveCSS('touch-action', 'none');
    await dragTo(page, handle, page.locator('[data-task-id="task-contract-tests"]'));

    await expect.poll(async () => page.locator('[data-task-id] h3').allTextContents()).toEqual([
      'Write Contract Tests',
      'Implement WebRTC Bridge',
    ]);
    await expect.poll(async () => page.evaluate(() => {
      const persisted = JSON.parse(localStorage.getItem('samantha-entity-storage') || '{}');
      return persisted.state.epics
        .filter((epic: { nextRank?: string | null }) => epic.nextRank)
        .sort((a: { nextRank: string }, b: { nextRank: string }) => a.nextRank.localeCompare(b.nextRank))
        .map((epic: { title: string }) => epic.title);
    })).toEqual(['Write Contract Tests', 'Implement WebRTC Bridge']);
  });

  test('touch hold reorder activates on the drag handle', async ({ page, context }) => {
    await expect(page.getByText('Implement WebRTC Bridge')).toBeVisible();
    await context.setOffline(true);
    await touchHoldDragTo(
      page,
      page.getByRole('button', { name: 'Drag Implement WebRTC Bridge' }),
      page.locator('[data-task-id="task-contract-tests"]'),
    );

    await expect.poll(async () => page.locator('[data-task-id] h3').allTextContents()).toEqual([
      'Write Contract Tests',
      'Implement WebRTC Bridge',
    ]);
  });

  test('opening a task shows Task detail', async ({ page }) => {
    await page.getByText('Implement WebRTC Bridge').click();
    await expect(page.getByRole('dialog', { name: 'Task detail' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Edit/i })).toBeVisible();
  });

  test('focused edit field remains visible when the Android viewport resizes', async ({ page }) => {
    await page.getByText('Implement WebRTC Bridge').click();
    await page.getByRole('button', { name: /Edit/i }).click();

    const outcomes = page.getByTestId('task-outcomes-field');
    await outcomes.focus();
    await page.setViewportSize({ width: 390, height: 420 });

    await expect.poll(async () => {
      const bounds = await outcomes.boundingBox();
      return bounds ? bounds.y + bounds.height : Number.POSITIVE_INFINITY;
    }).toBeLessThanOrEqual(page.viewportSize()?.height ?? 420);
    await expect(outcomes).toBeFocused();
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

  test('drag reorder updates and persists project ranks', async ({ page, context }) => {
    await expect(page.getByRole('heading', { name: 'Samantha Audio Core' })).toBeVisible();
    await context.setOffline(true);
    const handle = page.getByRole('button', { name: 'Drag Samantha Audio Core' });
    await expect(handle).toHaveCSS('touch-action', 'none');
    await dragTo(page, handle, page.locator('[data-project-id="prism-dispatch"]'));

    await expect.poll(async () => page.locator('[data-project-id] h3').allTextContents()).toEqual([
      'PRISM Dispatch',
      'Samantha Audio Core',
    ]);
    await expect.poll(async () => page.evaluate(() => {
      const persisted = JSON.parse(localStorage.getItem('samantha-entity-storage') || '{}');
      return persisted.state.projects
        .slice()
        .sort((a: { rank: string }, b: { rank: string }) => a.rank.localeCompare(b.rank))
        .map((project: { name: string }) => project.name);
    })).toEqual(['PRISM Dispatch', 'Samantha Audio Core']);
  });

  test('project dragging is locked to the vertical axis and current view', async ({ page }) => {
    const handle = page.getByRole('button', { name: 'Drag Samantha Audio Core' });
    const card = page.locator('[data-project-id="samantha-audio-core"]');
    const box = await handle.boundingBox();
    if (!box) throw new Error('Project drag handle is not visible');

    const client = await page.context().newCDPSession(page);
    await client.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
    const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] });
    await page.waitForTimeout(300);
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: start.x - 180, y: start.y }],
    });

    const horizontalOffset = await card.evaluate((element) => {
      const transform = getComputedStyle(element).transform;
      return transform === 'none' ? 0 : new DOMMatrixReadOnly(transform).m41;
    });
    expect(horizontalOffset).toBe(0);
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await client.detach();

    await expect(page.getByRole('button', { name: 'Projects' })).toHaveClass(/text-primary/);
  });

  test('drills into one project screen with a draggable task list', async ({ page }) => {
    await page.getByRole('heading', { name: 'Samantha Audio Core' }).click();

    await expect(page.getByRole('heading', { name: 'Samantha Audio Core' })).toBeVisible();
    await expect(page.getByText('Verify Android Audio Route')).toBeVisible();
    await expect(page.locator('svg.lucide-grip-vertical').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add Task' })).toBeVisible();
  });
});
