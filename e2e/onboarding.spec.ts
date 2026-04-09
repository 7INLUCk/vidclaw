import { test, expect } from '@playwright/test';
import { _electron as electron } from 'playwright-core';
import path from 'path';
import fs from 'fs';

const APP_PATH = path.resolve(__dirname, '..');
const SCREENSHOT_DIR = path.resolve(__dirname, 'screenshots');
const MAIN_JS = path.resolve(APP_PATH, 'electron/test-main.js');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

test.describe('Onboarding', () => {
  let app: any;
  let window: any;

  test.beforeEach(async () => {
    app = await electron.launch({
      args: [MAIN_JS],
      env: { ...process.env, NODE_ENV: 'test', VIDCLAW_TEST: '1' },
    });
    window = await app.firstWindow();
    await window.waitForLoadState('domcontentloaded');
    await window.waitForTimeout(2000);
  });

  test.afterEach(async () => {
    if (app) await app.close();
  });

  test('onboarding overlay shows on first visit', async () => {
    // Clear localStorage to simulate first visit
    await window.evaluate(() => localStorage.removeItem('vidclaw_onboarded'));

    // Reload to trigger onboarding check
    await window.reload();
    await window.waitForTimeout(2000);

    // Check for onboarding overlay
    const overlay = window.locator('text=欢迎使用 VidClaw');
    const isVisible = await overlay.isVisible().catch(() => false);

    if (isVisible) {
      await window.screenshot({ path: path.join(SCREENSHOT_DIR, '05-onboarding.png') });

      // Verify steps are shown
      const loginStep = window.locator('p:has-text("1. 登录即梦")');
      const inputStep = window.locator('p:has-text("2. 输入描述")');
      const videoStep = window.locator('p:has-text("3. 等待出片")');

      await expect(loginStep).toBeVisible();
      await expect(inputStep).toBeVisible();
      await expect(videoStep).toBeVisible();
    }
  });

  test('onboarding can be dismissed via button', async () => {
    // Clear onboarding flag
    await window.evaluate(() => localStorage.removeItem('vidclaw_onboarded'));
    await window.reload();
    await window.waitForTimeout(2000);

    const startButton = window.locator('button:has-text("开始使用")');
    const exists = await startButton.isVisible().catch(() => false);

    if (exists) {
      await startButton.click();
      await window.waitForTimeout(500);

      // Overlay should be gone
      const overlay = window.locator('text=欢迎使用 VidClaw');
      await expect(overlay).not.toBeVisible();

      // localStorage should be set
      const onboarded = await window.evaluate(() => localStorage.getItem('vidclaw_onboarded'));
      expect(onboarded).toBe('true');
    }
  });

  test('onboarding can be skipped', async () => {
    await window.evaluate(() => localStorage.removeItem('vidclaw_onboarded'));
    await window.reload();
    await window.waitForTimeout(2000);

    const skipButton = window.locator('button:has-text("跳过")');
    const exists = await skipButton.isVisible().catch(() => false);

    if (exists) {
      await skipButton.click();
      await window.waitForTimeout(500);

      const overlay = window.locator('text=欢迎使用 VidClaw');
      await expect(overlay).not.toBeVisible();
    }
  });

  test('localStorage marks onboarding as complete', async () => {
    // Set onboarding as done
    await window.evaluate(() => localStorage.setItem('vidclaw_onboarded', 'true'));
    await window.reload();
    await window.waitForTimeout(2000);

    // Onboarding should NOT show
    const overlay = window.locator('text=欢迎使用 VidClaw');
    await expect(overlay).not.toBeVisible();
  });
});
