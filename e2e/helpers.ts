import { _electron as electron, type ElectronApplication, type Page } from 'playwright-core';
import path from 'path';
import fs from 'fs';

const APP_PATH = path.resolve(__dirname, '..');
const SCREENSHOT_DIR = path.resolve(__dirname, 'screenshots');
const MAIN_JS = path.resolve(APP_PATH, 'electron/main.js');

let app: ElectronApplication | null = null;
let window: Page | null = null;

/**
 * Launch the Electron app for testing
 */
export async function launchApp(): Promise<{ app: ElectronApplication; window: Page }> {
  // Ensure screenshot directory exists
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  app = await electron.launch({
    args: [MAIN_JS],
    env: {
      ...process.env,
      NODE_ENV: 'test',
      VIDCLAW_TEST: '1',
    },
  });

  window = await app.firstWindow();
  // Wait for app to be ready
  await window.waitForLoadState('domcontentloaded');

  return { app, window };
}

/**
 * Close the app after tests
 */
export async function closeApp(): Promise<void> {
  if (app) {
    await app.close();
    app = null;
    window = null;
  }
}

/**
 * Take a screenshot
 */
export async function screenshot(window: Page, name: string): Promise<void> {
  const filepath = path.join(SCREENSHOT_DIR, name);
  await window.screenshot({ path: filepath, fullPage: false });
  console.log(`📸 Screenshot saved: ${filepath}`);
}

/**
 * Get the screenshot directory
 */
export function getScreenshotDir(): string {
  return SCREENSHOT_DIR;
}
