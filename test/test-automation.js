/**
 * 即梦自动化 - 独立测试脚本
 * 直接用 Playwright 跑，不经过 Electron，不需要打 DMG
 *
 * 用法：node test-automation.js
 * 前提：Chrome 已登录即梦（用 userDataDir 保持登录态）
 */

const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
const path = require('path');
const fs = require('fs');

chromium.use(stealth);

const JIMENG_URL = 'https://jimeng.jianying.com/ai-tool/generate';
const USER_DATA_DIR = path.join(process.env.HOME, 'Library/Application Support/jimeng-desktop/jimeng-profile');
// 测试用临时 profile（避免和正式 app 冲突）
const TEST_PROFILE_DIR = path.join(process.env.HOME, 'Library/Application Support/jimeng-desktop/jimeng-test-profile');

// ===== 日志 =====
const logFile = path.join(process.env.HOME, 'Downloads', '即梦', 'test-automation.log');
function log(msg) {
  const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const line = `[${ts}] ${msg}`;
  console.log(line);
  try { fs.appendFileSync(logFile, line + '\n'); } catch {}
}

// ===== 工具函数 =====
function sleep(ms) { return new Promise(r => setTimeout(r, ms + Math.random() * 300)); }
function randomDelay(min = 500, max = 1500) { return new Promise(r => setTimeout(r, Math.floor(Math.random() * (max - min + 1)) + min)); }

async function waitForVisible(page, text, timeout = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const found = await page.evaluate((t) => {
      const els = document.querySelectorAll('button, a, span, div, li');
      for (const el of els) {
        if (el.offsetParent !== null && (el.textContent || '').trim().includes(t)) return true;
      }
      return false;
    }, text);
    if (found) return true;
    await sleep(400);
  }
  return false;
}

async function safeClick(page, text, selector = 'button, a, [class*="tab"], span', timeout = 5000) {
  log(`[safeClick] 查找: "${text}"`);
  const found = await waitForVisible(page, text, timeout);
  if (!found) {
    const debugTexts = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('button, a, [role="button"], [class*="tab"], [class*="dropdown"]'))
        .filter(el => el.offsetParent !== null)
        .map(el => `[${el.tagName}.${(el.className || '').toString().slice(0, 30)}] "${(el.textContent || '').trim().slice(0, 40)}"`)
        .slice(0, 20);
    });
    log(`[safeClick] 页面元素:\n${debugTexts.join('\n')}`);
    throw new Error(`未找到包含「${text}」的可见元素`);
  }
  await randomDelay(200, 500);
  const result = await page.evaluate(({ t, sel }) => {
    const els = document.querySelectorAll(sel);
    for (const el of els) {
      if (el.offsetParent !== null && (el.textContent || '').trim().includes(t)) {
        el.click();
        return { success: true, text: (el.textContent || '').trim().slice(0, 40) };
      }
    }
    return { success: false, error: `点击时元素消失: ${t}` };
  }, { t: text, sel: selector });
  if (!result.success) throw new Error(result.error);
  log(`[safeClick] ✅ "${result.text}"`);
  return result;
}

// ===== 扫描页面状态 =====
async function scanPageState(page) {
  return await page.evaluate(() => {
    const interactiveTexts = [];
    const interactiveEls = document.querySelectorAll('button, a, [role="button"], [class*="tab"], [class*="dropdown"]');
    for (const el of interactiveEls) {
      if (el.offsetParent !== null) interactiveTexts.push((el.textContent || '').trim());
    }
    return {
      hasSeedanceTab: interactiveTexts.some(t => t.includes('Seedance') && (t.includes('视频') || t.includes('创作'))),
      hasAgentMode: interactiveTexts.some(t => t.includes('Agent 模式')),
      hasVideoGen: interactiveTexts.some(t => t === '视频生成' || t === '视频生成 ▾'),
      hasSubMode: interactiveTexts.some(t => (t.includes('首尾帧') || t.includes('智能多帧')) && !t.includes('全能参考')),
      hasOmniRef: interactiveTexts.some(t => t.includes('全能参考')),
    };
  });
}

// ===== 五步模式切换 =====
async function switchToSeedanceMode(page) {
  const STEPS = [
    { name: '点击 Seedance 视频创作 tab', click: 'Seedance', selector: 'button, a, [class*="tab"], span' },
    { name: '点击 Agent 模式下拉', click: 'Agent 模式', selector: 'button, [class*="dropdown"], [role="combobox"], span' },
    { name: '选择 视频生成', click: '视频生成', selector: '[class*="dropdown-item"], [class*="menu-item"], [role="option"], li' },
    { name: '点击首尾帧下拉', click: '首尾帧', selector: 'button, [class*="dropdown"], [role="combobox"], span' },
    { name: '选择 全能参考', click: '全能参考', selector: '[class*="dropdown-item"], [class*="menu-item"], [role="option"], li' },
  ];

  for (let i = 0; i < STEPS.length; i++) {
    const step = STEPS[i];
    try {
      log(`[模式切换] Step ${i + 1}: ${step.name}`);
      await safeClick(page, step.click, step.selector, 5000);
      log(`[模式切换] Step ${i + 1} ✅`);
      if (i < STEPS.length - 1) await randomDelay(800, 1500);
    } catch (err) {
      log(`[模式切换] Step ${i + 1} ❌ ${err.message}`);
      await randomDelay(500, 1000);
    }
  }

  await randomDelay(500, 1000);
  const state = await scanPageState(page);
  log(`[模式切换] 最终状态: ${JSON.stringify(state)}`);
  return state.hasOmniRef;
}

// ===== 填写提示词并提交 =====
async function setPromptAndSubmit(page, text) {
  log(`[提交] 填写提示词: "${text.slice(0, 50)}"`);

  const result = await page.evaluate((promptText) => {
    const editor = document.querySelector('.tiptap.ProseMirror')
      || document.querySelector('[contenteditable="true"]')
      || document.querySelector('textarea');
    if (!editor) return { success: false, error: '找不到编辑器' };

    editor.click();
    editor.focus?.();

    if (editor.tagName === 'TEXTAREA') {
      editor.value = promptText;
      editor.dispatchEvent(new Event('input', { bubbles: true }));
      return { success: true, method: 'textarea' };
    }

    editor.innerHTML = '';
    const p = document.createElement('p');
    p.appendChild(document.createTextNode(promptText));
    editor.appendChild(p);
    try {
      editor.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText', data: promptText }));
    } catch {
      editor.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (editor.classList.contains('is-editor-empty')) editor.classList.remove('is-editor-empty');
    return { success: true, method: 'tiptap' };
  }, text);

  if (!result.success) throw new Error(result.error);
  log(`[提交] 提示词已填写 (${result.method})`);
  await randomDelay(500, 1000);

  // 按 Enter 提交
  log('[提交] 按 Enter 提交...');
  await page.evaluate(() => {
    const editor = document.querySelector('.tiptap.ProseMirror')
      || document.querySelector('[contenteditable="true"]')
      || document.querySelector('textarea');
    if (editor) {
      editor.focus?.();
      editor.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true, cancelable: true, shiftKey: false
      }));
    }
  });
  log('[提交] ✅ 已提交');
}

// ===== 主流程 =====
async function main() {
  log('=== 即梦自动化测试开始 ===');

  // 确保下载目录存在
  const dlDir = path.join(process.env.HOME, 'Downloads', '即梦');
  if (!fs.existsSync(dlDir)) fs.mkdirSync(dlDir, { recursive: true });

  // 复制登录态（Cookies + Local Storage）从正式 profile 到测试 profile
  if (!fs.existsSync(TEST_PROFILE_DIR)) {
    fs.mkdirSync(TEST_PROFILE_DIR, { recursive: true });
    log('创建测试 profile，复制登录态...');
    // 复制 Default 目录下的 Cookies 和 Local Storage
    const srcDefault = path.join(USER_DATA_DIR, 'Default');
    const dstDefault = path.join(TEST_PROFILE_DIR, 'Default');
    if (fs.existsSync(srcDefault)) {
      fs.mkdirSync(dstDefault, { recursive: true });
      const filesToCopy = ['Cookies', 'Cookies-journal', 'Local Storage', 'Session Storage', 'Preferences'];
      for (const f of filesToCopy) {
        const src = path.join(srcDefault, f);
        const dst = path.join(dstDefault, f);
        if (fs.existsSync(src)) {
          try {
            if (fs.statSync(src).isDirectory()) {
              fs.cpSync(src, dst, { recursive: true });
            } else {
              fs.copyFileSync(src, dst);
            }
            log(`  复制: ${f}`);
          } catch (e) {
            log(`  跳过 ${f}: ${e.message}`);
          }
        }
      }
    }
  }

  // 清理旧锁
  const testLock = path.join(TEST_PROFILE_DIR, 'SingletonLock');
  if (fs.existsSync(testLock)) fs.unlinkSync(testLock);

  // 启动浏览器（用测试 profile）
  log('启动浏览器...');
  const context = await chromium.launchPersistentContext(TEST_PROFILE_DIR, {
    headless: false,
    channel: 'chrome',
    slowMo: 50,
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
    viewport: { width: 1280, height: 720 },
  });

  const pages = context.pages();
  const page = pages.length > 0 ? pages[0] : await context.newPage();

  // 导航到即梦
  log('导航到即梦...');
  await page.goto(JIMENG_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  await randomDelay(2000, 3000);

  log(`当前 URL: ${page.url()}`);

  // ===== 测试 1：扫描页面状态 =====
  log('\n--- 测试 1：扫描页面状态 ---');
  const state = await scanPageState(page);
  log(`当前状态: ${JSON.stringify(state)}`);

  // ===== 测试 2：模式切换 =====
  log('\n--- 测试 2：模式切换 ---');
  const switchOk = await switchToSeedanceMode(page);
  log(`模式切换结果: ${switchOk ? '✅ 成功' : '❌ 失败'}`);

  // ===== 测试 3：填写提示词并提交（不带文件） =====
  log('\n--- 测试 3：填写提示词并提交 ---');
  try {
    await setPromptAndSubmit(page, 'A cute cat running in a garden, cinematic, 4K');
    log('提示词提交 ✅');
  } catch (err) {
    log(`提示词提交 ❌: ${err.message}`);
  }

  // 等几秒看结果
  log('\n等待 10 秒观察页面变化...');
  await sleep(10000);

  log('=== 测试完成，浏览器保持打开 ===');
  log(`日志文件: ${logFile}`);

  // 不关闭浏览器，让用户看到结果
  // await context.close();
}

main().catch(err => {
  log(`❌ 测试异常: ${err.message}`);
  log(err.stack);
});
