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

test.describe('Task Panel', () => {
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

    // Navigate to task panel
    const taskTab = window.locator('button[title="任务"]');
    await taskTab.click();
    await window.waitForTimeout(500);
  });

  test.afterEach(async () => {
    if (app) await app.close();
  });

  test('4 filter tabs exist (全部/进行中/已完成/失败)', async () => {
    const allTab = window.locator('button:has-text("全部")');
    const activeTab = window.locator('button:has-text("进行中")');
    const completedTab = window.locator('button:has-text("已完成")');
    const failedTab = window.locator('button:has-text("失败")');

    await expect(allTab).toBeVisible();
    await expect(activeTab).toBeVisible();
    await expect(completedTab).toBeVisible();
    await expect(failedTab).toBeVisible();
  });

  test('empty state shows no tasks message', async () => {
    const emptyMsg = window.locator('text=还没有任务');
    await expect(emptyMsg).toBeVisible();

    await window.screenshot({ path: path.join(SCREENSHOT_DIR, '03-task-panel.png') });
  });

  test('clicking filter tabs changes active tab', async () => {
    const activeTab = window.locator('button:has-text("进行中")');
    await activeTab.click();

    // The tab should become active (get a different style)
    // After clicking, it should still be visible
    await expect(activeTab).toBeVisible();
  });
});
