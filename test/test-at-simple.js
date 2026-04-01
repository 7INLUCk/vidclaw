/**
 * 即梦自动化 - @引用测试（简化版）
 * 直接测试上传 + @引用
 */
const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
const path = require('path'), fs = require('fs');
chromium.use(stealth);

const PROFILE = path.join(process.env.HOME, 'Library/Application Support/jimeng-desktop/jimeng-profile');
const TEST_FILES = path.join(process.env.HOME, 'Downloads', '即梦', 'test-files');
const logFile = path.join(process.env.HOME, 'Downloads', '即梦', 'at-test.log');

const log = msg => { const l = `[${new Date().toISOString().slice(11,19)}] ${msg}`; console.log(l); try{fs.appendFileSync(logFile,l+'\n')}catch{} };
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  log('=== @引用测试开始 ===');
  fs.rmSync(path.join(PROFILE, 'SingletonLock'), { force: true });

  const ctx = await chromium.launchPersistentContext(PROFILE, {
    headless: false, channel: 'chrome', slowMo: 50,
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
    viewport: { width: 1280, height: 800 },
  });
  const page = ctx.pages()[0] || await ctx.newPage();

  // 导航
  log('打开即梦...');
  await page.goto('https://jimeng.jianying.com/ai-tool/generate', { waitUntil: 'networkidle', timeout: 30000 });
  await sleep(3000);

  // 确保在全能参考模式
  log('检查模式...');
  const mode = await page.evaluate(() => {
    const texts = Array.from(document.querySelectorAll('button, [class*="dropdown"]')).map(el => (el.textContent||'').trim());
    return {
      hasVideoGen: texts.some(t => t.includes('视频生成')),
      hasOmniRef: texts.some(t => t.includes('全能参考')),
      hasSeedance: texts.some(t => t.includes('Seedance')),
    };
  });
  log(`模式: ${JSON.stringify(mode)}`);

  // 如果不在全能参考，切换模式
  if (!mode.hasOmniRef) {
    log('切换到全能参考...');
    // 点击 Seedance 视频创作 tab
    await page.evaluate(() => {
      const tabs = document.querySelectorAll('button, [class*="tab"]');
      for (const t of tabs) {
        if ((t.textContent||'').includes('Seedance') && (t.textContent||'').includes('视频')) { t.click(); return; }
      }
    });
    await sleep(1500);

    // 点击 Agent 模式 → 视频生成
    await page.evaluate(() => {
      const btns = document.querySelectorAll('button, [class*="dropdown"]');
      for (const b of btns) { if ((b.textContent||'').includes('Agent 模式')) { b.click(); return; } }
    });
    await sleep(1000);
    await page.evaluate(() => {
      const items = document.querySelectorAll('[class*="dropdown-item"], [class*="menu-item"], li');
      for (const i of items) { if ((i.textContent||'').includes('视频生成')) { i.click(); return; } }
    });
    await sleep(1500);

    // 点击首尾帧 → 全能参考
    await page.evaluate(() => {
      const btns = document.querySelectorAll('button, [class*="dropdown"]');
      for (const b of btns) { if ((b.textContent||'').includes('首尾帧') || (b.textContent||'').includes('智能多帧')) { b.click(); return; } }
    });
    await sleep(1000);
    await page.evaluate(() => {
      const items = document.querySelectorAll('[class*="dropdown-item"], [class*="menu-item"], li');
      for (const i of items) { if ((i.textContent||'').includes('全能参考')) { i.click(); return; } }
    });
    await sleep(2000);
  }

  // 上传图片
  log('上传图片...');
  const imgFile = path.join(TEST_FILES, 'test-image.png');
  const inputs = await page.$$('input[type="file"]');
  if (inputs.length > 0) {
    await inputs[inputs.length - 1].setInputFiles(imgFile);
    log('图片上传完成');
  }
  await sleep(2000);

  // 上传视频
  log('上传视频...');
  const vidFile = path.join(TEST_FILES, 'test-video.mp4');
  const inputs2 = await page.$$('input[type="file"]');
  if (inputs2.length > 0) {
    await inputs2[inputs2.length - 1].setInputFiles(vidFile);
    log('视频上传完成');
  }
  await sleep(2000);

  // 检查上传的参考
  const refs = await page.evaluate(() => {
    const imgs = document.querySelectorAll('[class*="reference"] img, [class*="preview"] img');
    return imgs.length;
  });
  log(`参考素材数量: ${refs}`);

  // 等编辑器
  log('等待编辑器...');
  await page.waitForSelector('.tiptap.ProseMirror', { timeout: 10000 });
  await sleep(500);

  // 聚焦并清空编辑器
  await page.evaluate(() => {
    const editors = document.querySelectorAll('.tiptap.ProseMirror');
    // 找空的编辑器
    for (const el of editors) {
      if (!(el.textContent||'').includes('Seedance')) {
        el.focus();
        el.innerHTML = '<p></p>';
        return;
      }
    }
    // 如果没找到，用第一个
    if (editors[0]) { editors[0].focus(); editors[0].innerHTML = '<p></p>'; }
  });
  await sleep(500);

  // 输入 @
  log('输入 @...');
  await page.keyboard.type('@', { delay: 100 });
  await sleep(1500);

  // 检查下拉
  const dropdown = await page.evaluate(() => {
    const dropdowns = document.querySelectorAll('[class*="dropdown"], [class*="popover"], [class*="suggest"], [class*="mention"], [class*="at"], [role="listbox"], [role="menu"]');
    for (const dd of dropdowns) {
      if (dd.offsetParent !== null) {
        const items = [];
        dd.querySelectorAll('[class*="item"], li, [role="option"]').forEach(i => {
          if (i.offsetParent !== null) {
            items.push({
              text: (i.textContent||'').trim().slice(0,50),
              hasImg: !!i.querySelector('img'),
            });
          }
        });
        if (items.length > 0) return { found: true, items };
      }
    }
    return { found: false };
  });
  log(`下拉: ${JSON.stringify(dropdown)}`);

  if (dropdown.found && dropdown.items.length > 0) {
    log(`✅ @引用下拉出现，${dropdown.items.length} 个选项`);
    dropdown.items.forEach((it, i) => log(`  ${i+1}. ${it.text} ${it.hasImg?'🖼️':''}`));

    // 点击第一个
    await page.evaluate(() => {
      const dropdowns = document.querySelectorAll('[class*="dropdown"], [class*="popover"], [class*="suggest"], [class*="mention"], [class*="at"], [role="listbox"], [role="menu"]');
      for (const dd of dropdowns) {
        if (dd.offsetParent !== null) {
          const items = dd.querySelectorAll('[class*="item"], li, [role="option"]');
          for (const i of items) {
            if (i.offsetParent !== null) { i.click(); return; }
          }
        }
      }
    });
    await sleep(500);

    // 检查编辑器内容
    const content = await page.evaluate(() => {
      const el = document.querySelector('.tiptap.ProseMirror');
      return el ? el.textContent : '';
    });
    log(`编辑器内容: "${content}"`);

    if (content.includes('@') || content.includes('图片') || content.includes('视频')) {
      log('✅ @引用测试通过！');
    } else {
      log('⚠️ 内容不包含引用');
    }
  } else {
    log('❌ 未检测到@下拉');
    // 截图
    await page.screenshot({ path: path.join(TEST_FILES, 'at-fail.png') });
    log(`截图: ${TEST_FILES}/at-fail.png`);
  }

  log('=== 测试完成 ===');
}

main().catch(e => { log(`❌ ${e.message}`); log(e.stack); process.exit(1); });