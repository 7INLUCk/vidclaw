const https = require('https');
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();

chromium.use(stealth);

const JIMENG_URL = 'https://jimeng.jianying.com/ai-tool/home';
const USER_DATA_DIR = path.join(process.env.HOME, 'Library/Application Support/jimeng-desktop/jimeng-profile');

async function main() {
  // clean lock
  const lock = path.join(USER_DATA_DIR, 'SingletonLock');
  if (fs.existsSync(lock)) fs.unlinkSync(lock);

  const ctx = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: false, channel: 'chrome',
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
    viewport: { width: 1280, height: 720 },
  });

  const pages = ctx.pages();
  const page = pages[0];
  await page.goto(JIMENG_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 2000));

  // Detailed editor analysis
  const editorInfo = await page.evaluate(() => {
    const results = {};

    // Check all possible editor elements
    const selectors = [
      '#prompt-text-editor',
      '#prompt-text-editor p',
      '#prompt-text-editor .ProseMirror',
      'textarea',
      'textarea.lv-textarea',
      '[contenteditable="true"]',
      '[class*="prompt"] [class*="input"]',
      '[class*="editor"]',
      '[class*="text-input"]',
      '[class*="dimension-layout"]',
      '[class*="toolbar-actions"] button[class*="submit"]',
      'button[class*="submit"]',
      'input[type="file"]',
      '[class*="reference-item"]',
      '[class*="avatar"]',
      '[class*="user-info"]',
    ];

    for (const sel of selectors) {
      const els = document.querySelectorAll(sel);
      results[sel] = {
        count: els.length,
        visible: Array.from(els).some(el => el.offsetParent !== null),
        tagNames: Array.from(els).slice(0, 3).map(el => el.tagName),
        classes: Array.from(els).slice(0, 3).map(el => (el.className || '').toString().slice(0, 80)),
        text: Array.from(els).slice(0, 3).map(el => (el.textContent || '').slice(0, 50)),
      };
    }

    // Check for the actual input area by looking at the page structure
    const allContenteditables = document.querySelectorAll('[contenteditable]');
    results._contenteditables = Array.from(allContenteditables).map(el => ({
      tag: el.tagName,
      id: el.id,
      cls: (el.className || '').toString().slice(0, 80),
      ce: el.contentEditable,
      visible: el.offsetParent !== null,
      parentCls: (el.parentElement?.className || '').toString().slice(0, 80),
      grandparentCls: (el.parentElement?.parentElement?.className || '').toString().slice(0, 80),
    }));

    return results;
  });

  console.log(JSON.stringify(editorInfo, null, 2));
  await ctx.close();
}

main().catch(err => { console.error(err); process.exit(1); });
