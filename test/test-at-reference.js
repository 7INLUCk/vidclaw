/**
 * 即梦自动化 - @引用完整测试
 * 上传文件 → 输入@ → 选引用 → 验证内容
 */
const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
const path = require('path');
const fs = require('fs');
chromium.use(stealth);

const JIMENG_URL = 'https://jimeng.jianying.com/ai-tool/generate';
const PROFILE = path.join(process.env.HOME, 'Library/Application Support/jimeng-desktop/jimeng-profile');
const TEST_FILES = path.join(process.env.HOME, 'Downloads', '即梦', 'test-files');
const logFile = path.join(process.env.HOME, 'Downloads', '即梦', 'at-ref-test.log');

function log(msg) {
  const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const line = `[${ts}] ${msg}`;
  console.log(line);
  try { fs.appendFileSync(logFile, line + '\n'); } catch {}
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ===== 等待条件满足 =====
async function waitForFn(fn, { timeout = 10000, interval = 500, label = '' } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const result = await fn();
    if (result) return result;
    await sleep(interval);
  }
  log(`[waitFor] ${label} 超时 (${timeout}ms)`);
  return null;
}

// ===== 找到并点击可见元素 =====
async function clickText(page, text, selector = 'button, a, [class*="tab"], span, [class*="dropdown"]') {
  const el = await waitForFn(async () => {
    return await page.evaluate(({ t, sel }) => {
      const els = document.querySelectorAll(sel);
      for (const el of els) {
        if (el.offsetParent !== null && (el.textContent || '').trim().includes(t)) {
          el.click();
          return { text: (el.textContent || '').trim().slice(0, 40) };
        }
      }
      return null;
    }, { t: text, sel: selector });
  }, { timeout: 8000, label: `点击 "${text}"` });
  if (el) log(`[click] ✅ "${el.text}"`);
  else throw new Error(`未找到: "${text}"`);
  return el;
}

// ===== 等下拉项出现并点击 =====
async function clickDropdownItem(page, text) {
  await sleep(600);
  const clicked = await waitForFn(async () => {
    return await page.evaluate((t) => {
      const items = document.querySelectorAll('[class*="dropdown-item"], [class*="menu-item"], [role="option"], [role="menuitem"], li');
      for (const item of items) {
        if (item.offsetParent !== null && (item.textContent || '').trim().includes(t)) {
          item.click();
          return true;
        }
      }
      return false;
    }, text);
  }, { timeout: 5000, label: `下拉项 "${text}"` });
  if (clicked) log(`[dropdown] ✅ 选中 "${text}"`);
  return clicked;
}

// ===== 5步模式切换 =====
async function switchMode(page) {
  log('--- 模式切换 ---');
  try { await clickText(page, 'Seedance', 'button, a, [class*="tab"], span'); } catch { log('Seedance 跳过'); }
  await sleep(800);
  try { await clickText(page, 'Agent 模式', 'button, [class*="dropdown"], span'); } catch { log('Agent 模式 跳过'); }
  await clickDropdownItem(page, '视频生成');
  await sleep(800);
  try { await clickText(page, '首尾帧', 'button, [class*="dropdown"], span'); } catch { log('首尾帧 跳过'); }
  await clickDropdownItem(page, '全能参考');
  await sleep(1500);
  log('--- 模式切换完成 ---');
}

// ===== 上传文件 =====
async function uploadFile(page, filePath) {
  const fileName = path.basename(filePath);
  log(`[上传] ${fileName} (${fs.statSync(filePath).size}B)`);

  // 找 file input（全能参考模式下通常有多个，选支持目标格式的）
  const ext = path.extname(filePath).toLowerCase();
  const inputIdx = await page.evaluate((ext) => {
    const inputs = document.querySelectorAll('input[type="file"]');
    // 找 accept 包含目标扩展名的 input
    for (let i = 0; i < inputs.length; i++) {
      if (inputs[i].accept && inputs[i].accept.includes(ext)) return i;
    }
    // 降级：用最后一个（通常是最通用的）
    return inputs.length - 1;
  }, ext);

  if (inputIdx < 0) { log('[上传] ❌ 无 file input'); return false; }

  const inputs = await page.$$('input[type="file"]');
  if (!inputs[inputIdx]) { log('[上传] ❌ input 不存在'); return false; }

  await inputs[inputIdx].setInputFiles(filePath);
  log(`[上传] ✅ 已设置 input #${inputIdx}`);
  await sleep(2000);

  // 检查是否上传成功
  const result = await page.evaluate(() => {
    const refs = document.querySelectorAll('[class*="reference"] img, [class*="preview"] img, [class*="thumbnail"] img');
    return { refCount: refs.length };
  });
  log(`[上传] 参考图数量: ${result.refCount}`);
  return result.refCount > 0;
}

// ===== 等编辑器可用 =====
async function waitForEditor(page) {
  log('[编辑器] 等待编辑器出现...');
  const editor = await waitForFn(async () => {
    return await page.evaluate(() => {
      // 找可见的 ProseMirror 编辑器（非 placeholder 的那个）
      const editors = document.querySelectorAll('.tiptap.ProseMirror');
      for (const el of editors) {
        if (el.offsetParent !== null) {
          const rect = el.getBoundingClientRect();
          // 确保编辑器有一定高度
          if (rect.height > 20) {
            return {
              tag: el.tagName,
              className: (el.className || '').slice(0, 50),
              text: (el.textContent || '').slice(0, 50),
              rect: { x: rect.x, y: rect.y, w: rect.width, h: rect.height },
            };
          }
        }
      }
      return null;
    });
  }, { timeout: 15000, interval: 800, label: '编辑器' });

  if (editor) log(`[编辑器] ✅ 找到: ${JSON.stringify(editor)}`);
  else log('[编辑器] ❌ 未找到');
  return editor;
}

// ===== 测试@引用 =====
async function testAtReference(page) {
  log('--- @引用测试 ---');

  const editor = await waitForEditor(page);
  if (!editor) { log('❌ 无编辑器，无法测试'); return false; }

  // 清空编辑器并聚焦
  await page.evaluate(() => {
    const el = document.querySelector('.tiptap.ProseMirror');
    if (!el) return;
    el.innerHTML = '<p></p>';
    el.focus();
  });
  await sleep(500);

  // 输入 @
  log('[@引用] 输入 @...');
  await page.evaluate(() => {
    const el = document.querySelector('.tiptap.ProseMirror');
    if (!el) return;
    const p = el.querySelector('p') || document.createElement('p');
    if (!p.parentElement) el.appendChild(p);

    // 清空
    while (p.firstChild) p.removeChild(p.firstChild);

    // 插入 @
    const textNode = document.createTextNode('@');
    p.appendChild(textNode);

    el.dispatchEvent(new InputEvent('input', {
      bubbles: true, cancelable: true, inputType: 'insertText', data: '@'
    }));
  });
  await sleep(1500);

  // 检查下拉是否出现
  const dropdown = await page.evaluate(() => {
    const dropdowns = document.querySelectorAll(
      '[class*="dropdown"], [class*="popover"], [class*="suggest"], ' +
      '[class*="mention"], [class*="reference"], [class*="at-panel"], ' +
      '[role="listbox"], [role="menu"], [role="tooltip"], [role="dialog"]'
    );
    const results = [];
    for (const dd of dropdowns) {
      if (dd.offsetParent !== null) {
        const items = [];
        dd.querySelectorAll('[class*="item"], li, [role="option"], [class*="option"]').forEach(item => {
          if (item.offsetParent !== null) {
            const img = item.querySelector('img');
            items.push({
              text: (item.textContent || '').trim().slice(0, 40),
              hasImage: !!img,
              imgSrc: img?.src?.slice(0, 60) || '',
            });
          }
        });
        results.push({
          className: (dd.className || '').toString().slice(0, 40),
          items,
        });
      }
    }
    return results;
  });

  if (dropdown.length > 0) {
    log(`[@引用] ✅ 下拉出现: ${dropdown.length} 个`);
    dropdown.forEach((d, i) => {
      log(`  下拉 #${i}: ${d.items.length} 项`);
      d.items.forEach(item => log(`    - ${item.text} ${item.hasImage ? '(有缩略图)' : ''}`));
    });

    // 点击第一个选项
    if (dropdown[0].items.length > 0) {
      const clicked = await page.evaluate(() => {
        const dd = document.querySelectorAll(
          '[class*="dropdown"], [class*="popover"], [class*="suggest"], ' +
          '[class*="mention"], [class*="reference"], [class*="at-panel"], ' +
          '[role="listbox"], [role="menu"]'
        );
        for (const d of dd) {
          if (d.offsetParent !== null) {
            const items = d.querySelectorAll('[class*="item"], li, [role="option"]');
            for (const item of items) {
              if (item.offsetParent !== null) {
                item.click();
                return { text: (item.textContent || '').trim().slice(0, 40) };
              }
            }
          }
        }
        return null;
      });
      if (clicked) {
        log(`[@引用] ✅ 点击了: "${clicked.text}"`);
        await sleep(500);

        // 检查编辑器内容
        const content = await page.evaluate(() => {
          const el = document.querySelector('.tiptap.ProseMirror');
          return el ? { text: el.textContent, html: el.innerHTML.slice(0, 200) } : null;
        });
        log(`[@引用] 编辑器内容: "${content?.text}"`);
        return true;
      }
    }
  } else {
    log('[@引用] ⚠️ 未检测到下拉');
    // 检查编辑器是否有 @ 文字
    const hasAt = await page.evaluate(() => {
      const el = document.querySelector('.tiptap.ProseMirror');
      return el ? (el.textContent || '').includes('@') : false;
    });
    log(`[@引用] 编辑器有 @: ${hasAt}`);

    // 截图保存以便调试
    const screenshotPath = path.join(process.env.HOME, 'Downloads', '即梦', 'at-ref-debug.png');
    await page.screenshot({ path: screenshotPath, fullPage: false });
    log(`[@引用] 截图: ${screenshotPath}`);
  }
  return false;
}

// ===== 主流程 =====
async function main() {
  log('=== @引用完整测试开始 ===');
  fs.rmSync(path.join(PROFILE, 'SingletonLock'), { force: true });

  const ctx = await chromium.launchPersistentContext(PROFILE, {
    headless: false, channel: 'chrome', slowMo: 50,
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
    viewport: { width: 1280, height: 720 },
  });
  const page = ctx.pages()[0] || await ctx.newPage();

  // 导航
  await page.goto(JIMENG_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  await sleep(3000);
  log(`URL: ${page.url()}`);

  // 模式切换
  await switchMode(page);

  // 上传图片
  const imageFile = path.join(TEST_FILES, 'test-image.png');
  const imgOk = await uploadFile(page, imageFile);
  log(`上传图片: ${imgOk ? '✅' : '⚠️ 未检测到参考图（可能仍上传成功）'}`);

  // 上传视频
  const videoFile = path.join(TEST_FILES, 'test-video.mp4');
  const vidOk = await uploadFile(page, videoFile);
  log(`上传视频: ${vidOk ? '✅' : '⚠️ 未检测到参考图（可能仍上传成功）'}`);

  // 测试 @ 引用
  await testAtReference(page);

  log('=== 测试完成 ===');
  log(`日志: ${logFile}`);
}

main().catch(err => {
  log(`❌ 异常: ${err.message}`);
  log(err.stack);
  process.exit(1);
});
