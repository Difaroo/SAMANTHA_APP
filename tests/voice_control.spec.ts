import { test, expect, type Route } from '@playwright/test';
import { fulfillJson, mockPrismSeed, mockVoiceToken } from './helpers';

test.describe('Voice control surface', () => {
  test.beforeEach(async ({ page }) => {
    await mockPrismSeed(page);
    await page.goto('/');
    await page.getByRole('button', { name: 'Voice', exact: true }).click();
  });

  test('shows a clear connection affordance when disconnected', async ({ page }) => {
    const connect = page.getByRole('button', { name: 'Connect', exact: true });
    const lockup = page.getByTestId('samantha-lockup');
    await expect(connect).toBeVisible();
    await expect(connect).toHaveCSS('width', '96px');
    await expect(connect).toHaveCSS('height', '96px');
    await expect(connect.locator('svg.lucide-audio-lines')).toBeVisible();
    await expect(page.getByRole('button', { name: /Voice speed/ })).toHaveCount(0);
    const [connectBox, lockupBox] = await Promise.all([connect.boundingBox(), lockup.boundingBox()]);
    expect(connectBox).not.toBeNull();
    expect(lockupBox).not.toBeNull();
    expect(Math.abs(
      (lockupBox!.y + lockupBox!.height / 2) - connectBox!.y / 2,
    )).toBeLessThanOrEqual(1);
    await expect(page.getByRole('status', { name: 'Voice status' })).toHaveText('Disconnected');
    await expect(page.getByLabel('Voice connection progress')).toHaveCount(0);
    await expect(page.getByText('Connected & ready')).toHaveCount(0);
  });

  test('shows truthful live progress while a token request is pending', async ({ page }) => {
    let resolveTokenRequest!: (route: Route) => void;
    const tokenRequest = new Promise<Route>((resolve) => {
      resolveTokenRequest = resolve;
    });
    await page.route('**/api/voice/token**', (route) => resolveTokenRequest(route));

    await page.getByRole('button', { name: 'Connect', exact: true }).click();
    const route = await tokenRequest;
    expect(new URL(route.request().url()).search).toBe('');

    const status = page.getByRole('status', { name: 'Voice status' });
    await expect(status).toHaveText('Fetching token');

    await fulfillJson(route, {
      token: 'contract-test-token',
      serverUrl: 'mock://voice-bridge',
      room: 'samantha-room',
      identity: 'david',
    });

    await expect(status).toHaveText('Listening');
    await expect(page.getByText('Connected & ready')).toHaveCount(0);
  });

  test('connection failure leaves the rest of the app navigable', async ({ page }) => {
    await page.route('**/api/voice/token**', (route) => route.abort());

    await page.getByRole('button', { name: 'Connect', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText(/Token failed|Failed to fetch|Connection failed|Cannot reach/i, { timeout: 15000 });

    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByRole('heading', { name: 'Next' })).toBeVisible();
  });

  test('invalid production routing fails loudly without a silent retry loop', async ({ page }) => {
    await page.route('**/api/voice/token**', (route) => route.fulfill({ status: 404 }));

    await page.getByRole('button', { name: 'Connect', exact: true }).click();

    const alert = page.getByRole('alert');
    await expect(alert).toContainText('Voice sign-in failed (404)');
    await expect(page.getByRole('status', { name: 'Voice status' })).toHaveText('Error');
    await expect(page.getByRole('button', { name: 'Retry', exact: true })).toBeVisible();
  });

  test('central CTA owns disconnect and PTT mode while subtitles stay on', async ({ page }) => {
    await mockVoiceToken(page);

    await page.getByRole('button', { name: 'Connect', exact: true }).click();
    const disconnect = page.getByRole('button', { name: 'Disconnect voice' });
    await expect(disconnect).toBeVisible();
    await expect(disconnect.locator('svg.lucide-phone-off')).toBeVisible();
    await expect(page.getByLabel('Voice transcript')).toContainText('Connected to voice bridge test adapter.');
    await expect(page.getByTestId('subtitle-turn').first()).toHaveClass(/border-primary\/10/);
    await expect(page.getByLabel('Voice transcript')).toHaveCSS(
      'mask-image',
      /rgb\(0, 0, 0\) 69%, rgba\(0, 0, 0, 0\) calc\(100% - 64px\)/,
    );
    await expect(page.getByRole('button', { name: /subtitles/i })).toHaveCount(0);

    await page.getByRole('button', { name: 'Enable push to talk' }).click();
    await expect(page.getByRole('button', { name: 'Push to Talk', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Disconnect voice' })).toHaveCount(0);
    await expect(page.getByRole('status', { name: 'Voice status' })).toHaveText('Standby');
  });

  test('subtitle speaker colours identify Samantha in purple and the user in white', async ({ page }) => {
    await mockVoiceToken(page);
    await page.getByRole('button', { name: 'Connect', exact: true }).click();

    const samantha = page.getByTestId('subtitle-turn').filter({ hasText: 'Samantha subtitle colour sample.' });
    const user = page.getByTestId('subtitle-turn').filter({ hasText: 'User subtitle colour sample.' });
    await expect(samantha).toHaveClass(/text-primary\/90/);
    await expect(samantha.locator('div').first()).toHaveClass(/text-primary\/80/);
    await expect(user).toHaveClass(/text-foreground\/90/);
    await expect(user.locator('div').first()).toHaveClass(/text-foreground\/80/);
  });

  test('readouts align and the lockup stays dim after disconnect', async ({ page }) => {
    await mockVoiceToken(page);
    const lockup = page.getByTestId('samantha-lockup');
    await expect(lockup).toHaveCSS('opacity', '1');

    await page.getByRole('button', { name: 'Connect', exact: true }).click();
    await expect(lockup).toHaveCSS('opacity', '0.2');

    const speed = page.getByRole('button', { name: /Voice speed/ });
    const status = page.getByRole('status', { name: 'Voice status' });
    await expect(speed).toHaveText('0.90×');
    await expect(status).toHaveText('Listening');
    const [speedBox, statusBox] = await Promise.all([
      page.getByTestId('voice-speed-text').boundingBox(),
      page.getByTestId('voice-status-text').boundingBox(),
    ]);
    expect(speedBox).not.toBeNull();
    expect(statusBox).not.toBeNull();
    expect(Math.abs(
      (speedBox!.y + speedBox!.height / 2) - (statusBox!.y + statusBox!.height / 2),
    )).toBeLessThanOrEqual(1);

    await page.getByRole('button', { name: 'Disconnect voice' }).click();
    await expect(lockup).toHaveCSS('opacity', '0.2');
    await expect(page.getByRole('button', { name: /Voice speed/ })).toHaveCount(0);
    await expect(page.getByLabel('Voice transcript')).toContainText('Connected to voice bridge test adapter.');
  });

  test('manual transcript scrolling pauses auto-follow until latest is tapped', async ({ page }) => {
    await mockVoiceToken(page);
    await page.getByRole('button', { name: 'Connect', exact: true }).click();

    const transcript = page.getByLabel('Voice transcript');
    await transcript.evaluate((element) => {
      const spacer = element.firstElementChild as HTMLElement;
      spacer.style.minHeight = '1400px';
      element.scrollTop = element.scrollHeight;
    });
    await transcript.dispatchEvent('wheel', { deltaY: -120 });
    await transcript.evaluate((element) => {
      element.scrollTop = 0;
    });

    const latest = page.getByRole('button', { name: 'Jump to latest subtitles' });
    await expect(latest).toBeVisible();
    await latest.click();

    await expect(latest).toHaveCount(0);
    await expect.poll(() => transcript.evaluate((element) => (
      element.scrollHeight - element.scrollTop - element.clientHeight
    ))).toBeLessThanOrEqual(1);
  });

  test('speed is a compact Auto readout with a hold-only vertical control', async ({ page }) => {
    await mockVoiceToken(page);
    await page.getByRole('button', { name: 'Connect', exact: true }).click();

    const readout = page.getByRole('button', { name: /Voice speed/ });
    await expect(readout).toHaveText('0.90×');
    await expect(readout).toHaveClass(/text-primary/);
    await expect(page.getByRole('slider', { name: 'Samantha voice speed' })).toHaveCount(0);

    await readout.dispatchEvent('pointerdown');
    await page.waitForTimeout(500);
    await readout.dispatchEvent('pointerup');
    const slider = page.getByRole('slider', { name: 'Samantha voice speed' });
    await expect(slider).toBeVisible();

    await slider.fill('0.7');
    await expect(readout).toHaveText('0.70×');
    await expect(readout).toHaveClass(/text-white/);
    await expect.poll(() => page.evaluate(() => localStorage.getItem('samantha-voice-speed')))
      .toBe('0.7');

    await readout.dispatchEvent('pointerdown');
    await readout.dispatchEvent('pointerup');
    await expect(readout).toHaveText('0.90×');
    await expect(readout).toHaveClass(/text-primary/);
    await expect(slider).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => localStorage.getItem('samantha-voice-speed')))
      .toBeNull();
  });

  test('legacy floating-point speed values are normalized on startup', async ({ page }) => {
    await mockVoiceToken(page);
    await page.evaluate(() => localStorage.setItem(
      'samantha-voice-speed',
      '0.5499999999999999',
    ));
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible();
    await page.getByRole('button', { name: 'Voice', exact: true }).click();
    await page.getByRole('button', { name: 'Connect', exact: true }).click();

    await expect(page.getByRole('button', { name: /Voice speed/ })).toHaveText('0.55×');
    await expect.poll(() => page.evaluate(() => localStorage.getItem('samantha-voice-speed')))
      .toBe('0.55');
  });
});
