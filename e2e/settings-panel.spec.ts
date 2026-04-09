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

test.describe('Settings Panel', () => {
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

    // Navigate to settings panel
    const settingsTab = window.locator('button[title="设置"]');
    await settingsTab.click();
    await window.waitForTimeout(500);
  });

  test.afterEach(async () => {
    if (app) await app.close();
  });

  test('API key input exists', async () => {
    const apiKeyInput = window.locator('input[type="password"]');
    await expect(apiKeyInput).toBeVisible();

    await window.screenshot({ path: path.join(SCREENSHOT_DIR, '04-settings.png') });
  });

  test('model select exists', async () => {
    const modelSelect = window.locator('select');
    await expect(modelSelect).toBeVisible();

    // Verify default model is MiMo
    const value = await modelSelect.inputValue();
    expect(value).toContain('mimo');
  });

  test('download directory input exists', async () => {
    const dirInput = window.locator('input[type="text"]').first();
    await expect(dirInput).toBeVisible();
  });

  test('save button exists', async () => {
    const saveButton = window.locator('button:has-text("保存设置")');
    await expect(saveButton).toBeVisible();
  });

  test('auto download toggle exists', async () => {
    const toggleSection = window.locator('text=完成后自动下载');
    await expect(toggleSection).toBeVisible();
  });

  test('about section shows version', async () => {
    const versionText = window.locator('text=VidClaw');
    await expect(versionText).toBeVisible();
  });

  test('usage statistics section exists', async () => {
    const usageSection = window.locator('text=用量统计');
    await expect(usageSection).toBeVisible();

    // Check stat cards
    const totalTasks = window.locator('text=总任务');
    await expect(totalTasks).toBeVisible();
  });
});
