/**
 * 即梦桌面版 —— 端到端自测
 * 实际填写编辑器 + 提交任务 + 等待结果
 */

const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();

chromium.use(stealth);

const JIMENG_URL = 'https://jimeng.jianying.com/ai-tool/home';
const USER_DATA_DIR = path.join(process.env.HOME, 'Library/Application Support/jimeng-desktop/jimeng-profile');

// 清理锁
const lockFile = path.join(USER_DATA_DIR, 'SingletonLock');
if (fs.existsSync(lockFile)) fs.unlinkSync(lockFile);

async function main() {
  console.log('🚀 启动浏览器...');
  const ctx = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: false, channel: 'chrome',
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
    viewport: { width: 1280, height: 800 },
  });

  const page = ctx.pages()[0];
  await page.goto(JIMENG_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await sleep(2000);

  console.log('📍 查找编辑器...');
  const editorFound = await page.evaluate(() => {
    const editors = document.querySelectorAll('.tiptap.ProseMirror');
    for (const e of editors) {
      if (e.offsetParent !== null && e.contentEditable === 'true') {
        return { found: true, className: e.className };
      }
    }
    return { found: false };
  });

  if (!editorFound.found) {
    console.log('❌ 找不到编辑器');
    await ctx.close();
    return;
  }
  console.log('✅ 编辑器:', editorFound.className);

  // 监听 API 响应
  let resultCaptured = null;
  page.on('response', async (res) => {
    const url = res.url();
    if (url.includes('/mweb/v1/')) {
      console.log('📡 API:', url.slice(0, 80));
      try {
        const data = await res.json();
        if (data?.item_list?.length || data?.records_list?.length) {
          console.log('  → 包含作品数据！');
          resultCaptured = data;
        }
      } catch {}
    }
  });

  // 填写内容
  const testPrompt = 'A cute orange cat running in a sunny park, slow motion, 4K quality';
  console.log('✏️ 填写提示词:', testPrompt.slice(0, 50) + '...');

  const fillResult = await page.evaluate((text) => {
    const editors = document.querySelectorAll('.tiptap.ProseMirror');
    for (const editor of editors) {
      if (editor.offsetParent !== null && editor.contentEditable === 'true') {
        editor.click();
        editor.focus();

        // 清空并填入内容
        editor.innerHTML = '';
        const p = document.createElement('p');
        p.textContent = text;
        editor.appendChild(p);

        // 触发事件
        editor.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
        editor.dispatchEvent(new Event('change', { bubbles: true }));

        return { success: true, filledText: editor.textContent };
      }
    }
    return { success: false };
  }, testPrompt);

  if (fillResult.success) {
    console.log('✅ 已填写:', fillResult.filledText?.slice(0, 40));
  } else {
    console.log('❌ 填写失败');
    await ctx.close();
    return;
  }

  await sleep(1000);

  // 查找并点击提交按钮
  console.log('🔍 查找提交按钮...');
  const btnInfo = await page.evaluate(() => {
    const btns = document.querySelectorAll('button');
    const submitBtns = [];
    for (const btn of btns) {
      if ((btn.className || '').includes('submit') && btn.offsetParent !== null) {
        submitBtns.push({
          className: btn.className.slice(0, 60),
          disabled: btn.disabled,
          innerHTML: btn.innerHTML.slice(0, 100)
        });
      }
    }
    return submitBtns;
  });
  console.log('找到提交按钮:', btnInfo.length, '个');
  btnInfo.forEach((b, i) => console.log(`  ${i}: ${b.className}`));

  // 点击第一个可用的提交按钮
  const clicked = await page.evaluate(() => {
    const btns = document.querySelectorAll('button[class*="submit"]');
    for (const btn of btns) {
      if (btn.offsetParent !== null && !btn.disabled) {
        btn.click();
        return true;
      }
    }
    return false;
  });

  if (clicked) {
    console.log('✅ 已点击提交按钮');
  } else {
    console.log('⚠️ 未能点击提交按钮，尝试按 Enter...');
    await page.keyboard.press('Enter');
  }

  // 等待结果
  console.log('⏳ 等待 30 秒看是否有 API 响应...');
  await sleep(30000);

  if (resultCaptured) {
    console.log('🎉 成功捕获 API 响应！');
  } else {
    console.log('⏱️ 30 秒内未捕获到结果（可能需要更长时间生成）');
  }

  // 截图
  const screenshotPath = path.join(__dirname, 'e2e-screenshot.png');
  await page.screenshot({ path: screenshotPath });
  console.log('📸 截图已保存:', screenshotPath);

  await ctx.close();
  console.log('✅ 测试完成');
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

main().catch(err => {
  console.error('💥 错误:', err);
  process.exit(1);
});