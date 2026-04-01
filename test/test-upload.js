/**
 * 即梦自动化 - 上传测试脚本
 * 测试上传图片、视频、音频（不提交）
 */

const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
const path = require('path');
const fs = require('fs');

chromium.use(stealth);

const JIMENG_URL = 'https://jimeng.jianying.com/ai-tool/generate';
const TEST_PROFILE = path.join(process.env.HOME, 'Library/Application Support/jimeng-desktop/jimeng-profile');
// 注意：直接用正式 profile，测试前确保即梦桌面版没在运行
const TEST_FILES = path.join(process.env.HOME, 'Downloads', '即梦', 'test-files');
const logFile = path.join(process.env.HOME, 'Downloads', '即梦', 'upload-test.log');

function log(msg) {
  const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const line = `[${ts}] ${msg}`;
  console.log(line);
  try { fs.appendFileSync(logFile, line + '\n'); } catch {}
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms + Math.random() * 300)); }
function randomDelay(min = 500, max = 1500) { return new Promise(r => setTimeout(r, Math.floor(Math.random() * (max - min + 1)) + min)); }

async function waitForVisible(page, text, timeout = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const found = await page.evaluate((t) => {
      const els = document.querySelectorAll('button, a, span, div, li, label');
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
  if (!found) throw new Error(`未找到包含「${text}」的可见元素`);
  await randomDelay(200, 500);
  const result = await page.evaluate(({ t, sel }) => {
    const els = document.querySelectorAll(sel);
    for (const el of els) {
      if (el.offsetParent !== null && (el.textContent || '').trim().includes(t)) {
        el.click();
        return { success: true, text: (el.textContent || '').trim().slice(0, 40) };
      }
    }
    return { success: false };
  }, { t: text, sel: selector });
  if (!result.success) throw new Error(`点击失败`);
  log(`[safeClick] ✅ "${result.text}"`);
  return result;
}

// ===== 五步模式切换 =====
async function switchToSeedanceMode(page) {
  const STEPS = [
    { click: 'Seedance', sel: 'button, a, [class*="tab"], span' },
    { click: 'Agent 模式', sel: 'button, [class*="dropdown"], span' },
    { click: '视频生成', sel: '[class*="dropdown-item"], [class*="menu-item"], [role="option"], li' },
    { click: '首尾帧', sel: 'button, [class*="dropdown"], span' },
    { click: '全能参考', sel: '[class*="dropdown-item"], [class*="menu-item"], [role="option"], li' },
  ];
  for (let i = 0; i < STEPS.length; i++) {
    try {
      await safeClick(page, STEPS[i].click, STEPS[i].sel, 5000);
      await randomDelay(600, 1200);
    } catch (err) {
      log(`[模式切换] Step ${i + 1} 失败: ${err.message}`);
    }
  }
  await randomDelay(1000, 2000);
}

// ===== 扫描页面的上传相关元素 =====
async function scanUploadElements(page) {
  return await page.evaluate(() => {
    const results = { fileInputs: [], uploadButtons: [], uploadAreas: [] };

    // 1. 找 input[type="file"]
    document.querySelectorAll('input[type="file"]').forEach(el => {
      results.fileInputs.push({
        accept: el.accept || '无限制',
        multiple: el.multiple,
        visible: el.offsetParent !== null,
        className: (el.className || '').toString().slice(0, 50),
      });
    });

    // 2. 找包含"上传"文字的按钮/元素
    document.querySelectorAll('button, a, label, div[class*="upload"], span').forEach(el => {
      const text = (el.textContent || '').trim();
      if (text.includes('上传') && el.offsetParent !== null) {
        results.uploadButtons.push({
          tag: el.tagName,
          text: text.slice(0, 30),
          className: (el.className || '').toString().slice(0, 50),
        });
      }
    });

    // 3. 找"添加参考"或上传区域
    document.querySelectorAll('div, section, label').forEach(el => {
      const text = (el.textContent || '').trim();
      if ((text.includes('添加') || text.includes('参考') || text.includes('上传') || text.includes('拖拽'))
          && el.offsetParent !== null && text.length < 50) {
        results.uploadAreas.push({
          tag: el.tagName,
          text: text.slice(0, 40),
          className: (el.className || '').toString().slice(0, 50),
        });
      }
    });

    return results;
  });
}

// ===== 尝试通过 file input 上传 =====
async function uploadViaFileInput(page, filePath) {
  const fileName = path.basename(filePath);
  log(`[上传] 尝试 file input: ${fileName}`);

  // 方法 1：直接找 input[type="file"]
  const fileInputs = await page.$$('input[type="file"]');
  if (fileInputs.length > 0) {
    log(`[上传] 找到 ${fileInputs.length} 个 file input`);
    for (let i = 0; i < fileInputs.length; i++) {
      try {
        await fileInputs[i].setInputFiles(filePath);
        log(`[上传] ✅ file input #${i} 上传成功`);
        await randomDelay(1000, 2000);
        return true;
      } catch (err) {
        log(`[上传] file input #${i} 失败: ${err.message}`);
      }
    }
  }

  // 方法 2：通过点击上传按钮触发 filechooser
  log('[上传] 尝试通过 filechooser...');
  try {
    const uploadBtn = await page.$('button:has-text("上传")')
      || await page.$('[class*="upload"]')
      || await page.$('label:has-text("上传")');
    if (uploadBtn) {
      const [fileChooser] = await Promise.all([
        page.waitForEvent('filechooser', { timeout: 5000 }),
        uploadBtn.click(),
      ]);
      await fileChooser.setFiles(filePath);
      log(`[上传] ✅ filechooser 上传成功: ${fileName}`);
      await randomDelay(1000, 2000);
      return true;
    }
  } catch (err) {
    log(`[上传] filechooser 失败: ${err.message}`);
  }

  return false;
}

// ===== 检查上传后的页面状态 =====
async function checkUploadResult(page) {
  await randomDelay(1500, 2500);
  return await page.evaluate(() => {
    const results = {
      hasPreview: false,
      hasReferenceItem: false,
      hasUploadedFile: false,
      visibleTexts: [],
    };

    // 检查预览图/缩略图
    results.hasPreview = document.querySelectorAll('[class*="preview"] img, [class*="reference"] img, [class*="thumbnail"] img').length > 0;

    // 检查 reference-item
    results.hasReferenceItem = document.querySelectorAll('[class*="reference-item"], [class*="reference_item"]').length > 0;

    // 检查上传后的文件名显示
    document.querySelectorAll('span, div, p').forEach(el => {
      const text = (el.textContent || '').trim();
      if (text.length < 30 && (text.includes('.png') || text.includes('.mp4') || text.includes('.jpg'))) {
        results.hasUploadedFile = true;
        results.visibleTexts.push(text);
      }
    });

    return results;
  });
}

// ===== 主流程 =====
async function main() {
  log('=== 即梦上传测试开始 ===');
  fs.mkdirSync(TEST_FILES, { recursive: true });

  // 准备测试文件路径
  const imageFile = path.join(TEST_FILES, 'test-image.png');
  const videoFile = path.join(TEST_FILES, 'test-video.mp4');
  const audioFile = path.join(TEST_FILES, 'test-audio.mp3');

  for (const f of [imageFile, videoFile, audioFile]) {
    if (!fs.existsSync(f)) { log(`❌ 文件不存在: ${f}`); return; }
  }
  log(`测试文件: 图片=${fs.statSync(imageFile).size}B, 视频=${fs.statSync(videoFile).size}B, 音频=${fs.statSync(audioFile).size}B`);

  // 清理残留锁
  fs.rmSync(path.join(TEST_PROFILE, 'SingletonLock'), { force: true });

  // 启动浏览器
  log('启动浏览器...');
  const context = await chromium.launchPersistentContext(TEST_PROFILE, {
    headless: false, channel: 'chrome', slowMo: 50,
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
    viewport: { width: 1280, height: 720 },
  });
  const pages = context.pages();
  const page = pages.length > 0 ? pages[0] : await context.newPage();

  // 导航
  await page.goto(JIMENG_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  await randomDelay(2000, 3000);
  log(`当前 URL: ${page.url()}`);

  // 模式切换
  log('\n--- 步骤 1：模式切换 ---');
  await switchToSeedanceMode(page);

  // 扫描上传元素
  log('\n--- 步骤 2：扫描上传元素 ---');
  const uploadEls = await scanUploadElements(page);
  log(`File inputs: ${JSON.stringify(uploadEls.fileInputs)}`);
  log(`Upload buttons: ${JSON.stringify(uploadEls.uploadButtons.slice(0, 5))}`);
  log(`Upload areas: ${JSON.stringify(uploadEls.uploadAreas.slice(0, 5))}`);

  // 测试上传图片
  log('\n--- 测试 1：上传图片 ---');
  const imgResult = await uploadViaFileInput(page, imageFile);
  if (imgResult) {
    const check = await checkUploadResult(page);
    log(`[上传图片] 结果: preview=${check.hasPreview}, reference=${check.hasReferenceItem}, filename=${check.hasUploadedFile}`);
  } else {
    log('[上传图片] ❌ 所有上传方式都失败');
  }

  // 测试上传视频
  log('\n--- 测试 2：上传视频 ---');
  const vidResult = await uploadViaFileInput(page, videoFile);
  if (vidResult) {
    const check = await checkUploadResult(page);
    log(`[上传视频] 结果: preview=${check.hasPreview}, reference=${check.hasReferenceItem}, filename=${check.hasUploadedFile}`);
  } else {
    log('[上传视频] ❌ 所有上传方式都失败');
  }

  // 测试上传音频
  log('\n--- 测试 3：上传音频 ---');
  const audResult = await uploadViaFileInput(page, audioFile);
  if (audResult) {
    const check = await checkUploadResult(page);
    log(`[上传音频] 结果: preview=${check.hasPreview}, reference=${check.hasReferenceItem}, filename=${check.hasUploadedFile}`);
  } else {
    log('[上传音频] ❌ 所有上传方式都失败');
  }

  // 最终扫描
  log('\n--- 最终页面状态 ---');
  const finalEls = await scanUploadElements(page);
  log(`File inputs: ${JSON.stringify(finalEls.fileInputs)}`);

  log(`\n=== 测试完成 ===`);
  log(`日志: ${logFile}`);
  log('浏览器保持打开，可手动检查');
}

main().catch(err => {
  log(`❌ 测试异常: ${err.message}`);
  log(err.stack);
});
