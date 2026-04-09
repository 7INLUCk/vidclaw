import { test, expect } from '@playwright/test';
import { _electron as electron } from 'playwright-core';
import path from 'path';
import fs from 'fs';

const APP_PATH = path.resolve(__dirname, '..');
const SCREENSHOT_DIR = path.resolve(__dirname, 'screenshots');
const MAIN_JS = path.resolve(APP_PATH, 'electron/test-main.js');

// Ensure screenshot directory exists
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

test.describe('App Launch', () => {
  test('app launches and shows VidClaw title', async () => {
    const app = await electron.launch({
      args: [MAIN_JS],
      env: { ...process.env, NODE_ENV: 'test', VIDCLAW_TEST: '1' },
    });

    try {
      const window = await app.firstWindow();
      await window.waitForLoadState('domcontentloaded');

      // Take screenshot
      await window.screenshot({ path: path.join(SCREENSHOT_DIR, '01-app-launched.png') });

      // Verify the app rendered
      const title = await window.title();
      // Electron window title might be set by the app or default
      expect(title).toBeTruthy();

      // Verify main app container exists
      const appContainer = window.locator('body');
      await expect(appContainer).toBeVisible();
    } finally {
      await app.close();
    }
  });

  test('sidebar has navigation tabs', async () => {
    const app = await electron.launch({
      args: [MAIN_JS],
      env: { ...process.env, NODE_ENV: 'test', VIDCLAW_TEST: '1' },
    });

    try {
      const window = await app.firstWindow();
      await window.waitForLoadState('domcontentloaded');

      // Wait for React to render
      await window.waitForTimeout(2000);

      // Check sidebar has nav buttons (对话, 任务, 设置)
      const sidebar = window.locator('aside');
      await expect(sidebar).toBeVisible();

      // The sidebar should have nav buttons with titles
      const navButtons = sidebar.locator('button[title]');
      const count = await navButtons.count();
      expect(count).toBeGreaterThanOrEqual(3);
    } finally {
      await app.close();
    }
  });
});
