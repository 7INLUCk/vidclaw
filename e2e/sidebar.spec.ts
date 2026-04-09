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

test.describe('Sidebar Navigation', () => {
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

  test('click 对话 tab shows chat panel', async () => {
    // Click the chat tab (对话)
    const chatTab = window.locator('button[title="对话"]');
    await chatTab.click();

    // Chat panel should show header with "VidClaw"
    const header = window.locator('h1:has-text("VidClaw")');
    await expect(header).toBeVisible();

    await window.screenshot({ path: path.join(SCREENSHOT_DIR, '02-chat-panel.png') });
  });

  test('click 任务 tab shows task panel', async () => {
    const taskTab = window.locator('button[title="任务"]');
    await taskTab.click();

    // Task panel header
    const taskHeader = window.locator('h1:has-text("任务管理")');
    await expect(taskHeader).toBeVisible();

    await window.screenshot({ path: path.join(SCREENSHOT_DIR, '03-task-panel.png') });
  });

  test('click 设置 tab shows settings panel', async () => {
    const settingsTab = window.locator('button[title="设置"]');
    await settingsTab.click();

    // Settings panel header
    const settingsHeader = window.locator('h1:has-text("设置")');
    await expect(settingsHeader).toBeVisible();

    await window.screenshot({ path: path.join(SCREENSHOT_DIR, '04-settings-panel.png') });
  });

  test('click 作品 tab shows history panel', async () => {
    const historyTab = window.locator('button[title="作品"]');
    await historyTab.click();

    // History panel should be visible
    const historyHeader = window.locator('h1:has-text("作品历史")');
    await expect(historyHeader).toBeVisible();
  });
});
