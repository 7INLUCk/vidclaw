/**
 * 即梦 @ 引用测试 v2 - 修正点击选择器
 * 
 * 关键发现：
 * - 下拉选项是 li.lv-select-option
 * - 用 page.click() 直接点击包含文字的选项
 */

const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
const path = require('path');
const fs = require('fs');

chromium.use(stealth);

const PROFILE = path.join(process.env.HOME, 'Library/Application Support/jimeng-desktop/jimeng-profile');
const TEST_FILES = path.join(process.env.HOME, 'Downloads', '即梦', 'test-files');
const logFile = path.join(process.env.HOME, 'Downloads', '即梦', 'at-test-v2.log');

const log = msg => {
  const l = `[${new Date().toISOString().slice(11,19)}] ${msg}`;
  console.log(l);
  try { fs.appendFileSync(logFile, l + '\n'); } catch {}
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  log('=== @ 引用测试 v2 ===');
  
  // 清理锁文件
  fs.rmSync(path.join(PROFILE, 'SingletonLock'), { force: true });
  fs.rmSync(path.join(PROFILE, 'SingletonSocket'), { force: true });
  fs.rmSync(path.join(PROFILE, 'SingletonPipe'), { force: true });

  const ctx = await chromium.launchPersistentContext(PROFILE, {
    headless: false, channel: 'chrome', slowMo: 30,
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox', '--disable-session-crashed-bubble'],
    viewport: { width: 1280, height: 800 },
  });

  const page = ctx.pages()[0] || await ctx.newPage();

  // 导航
  log('打开即梦...');
  await page.goto('https://jimeng.jianying.com/ai-tool/generate', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  await sleep(3000);

  // Step 1: 上传文件
  log('\n--- Step 1: 上传图片和视频 ---');
  const imageFile = path.join(TEST_FILES, 'test-image.png');
  const videoFile = path.join(TEST_FILES, 'test-video.mp4');
  
  const fileInput = await page.$('input[type="file"]');
  if (fileInput && fs.existsSync(imageFile) && fs.existsSync(videoFile)) {
    await fileInput.setInputFiles([imageFile, videoFile]);
    await page.evaluate(() => {
      document.querySelector('input[type="file"]').dispatchEvent(new Event('change', { bubbles: true }));
    });
    log('已上传图片和视频');
    await sleep(3000);
  }

  // Step 2: 找到编辑器并聚焦
  log('\n--- Step 2: 聚焦编辑器 ---');
  const editor = await page.$('.tiptap.ProseMirror[contenteditable="true"]');
  if (!editor) {
    log('❌ 未找到编辑器');
    return;
  }
  await editor.click();
  await sleep(500);
  
  // 清空编辑器
  await page.keyboard.press('Meta+a');
  await page.keyboard.press('Backspace');
  await sleep(300);

  // Step 3: 输入提示词第一部分 + @图片1
  log('\n--- Step 3: 输入 "让 " + @图片1 ---');
  await page.keyboard.type('让 ', { delay: 50 });
  await sleep(200);
  
  // 输入 @ 触发下拉
  await page.keyboard.type('@', { delay: 50 });
  await sleep(1500); // 等下拉出现

  // 点击 "图片1" 选项 - 用正确的选择器
  log('点击 @图片1 下拉选项...');
  try {
    // 方法1: 直接用 Playwright 点击包含文字的 li
    const option1 = await page.$('li.lv-select-option:has-text("图片1")');
    if (option1) {
      await option1.click();
      log('✅ 点击 li.lv-select-option 成功');
    } else {
      // 方法2: 用文字匹配
      await page.click('text=图片1', { timeout: 3000 });
      log('✅ 点击 text=图片1 成功');
    }
  } catch (e) {
    log(`❌ 点击图片1失败: ${e.message}`);
  }
  await sleep(1000);

  // Step 4: 输入提示词第二部分
  log('\n--- Step 4: 输入 " 里的这个人照着 " ---');
  await page.keyboard.type(' 里的这个人照着 ', { delay: 50 });
  await sleep(500);

  // Step 5: 输入 @视频1
  log('\n--- Step 5: 输入 @视频1 ---');
  await page.keyboard.type('@', { delay: 50 });
  await sleep(1500);
  
  try {
    const option2 = await page.$('li.lv-select-option:has-text("视频1")');
    if (option2) {
      await option2.click();
      log('✅ 点击 @视频1 成功');
    } else {
      await page.click('text=视频1', { timeout: 3000 });
      log('✅ 点击 text=视频1 成功');
    }
  } catch (e) {
    log(`❌ 点击视频1失败: ${e.message}`);
  }
  await sleep(1000);

  // Step 6: 输入提示词结尾
  log('\n--- Step 6: 输入 " 里的动作做舞蹈。" ---');
  await page.keyboard.type(' 里的动作做舞蹈。', { delay: 50 });
  await sleep(1000);

  // Step 7: 检查最终结果
  log('\n--- Step 7: 检查最终结果 ---');
  const finalContent = await page.evaluate(() => {
    const editor = document.querySelector('.tiptap.ProseMirror[contenteditable="true"]');
    if (!editor) return { text: 'no editor', html: '' };
    return {
      text: editor.textContent,
      html: editor.innerHTML.slice(0, 800),
      mentions: editor.querySelectorAll('[data-type="mention"], .mention-node, [class*="reference"]').length,
    };
  });
  log(`最终内容:\n文本: ${finalContent.text}\nHTML片段: ${finalContent.html}\n引用节点数: ${finalContent.mentions}`);

  // Step 8: 按 Enter 提交
  log('\n--- Step 8: 按 Enter 提交 ---');
  await page.keyboard.press('Enter');
  log('已按 Enter');

  log('\n=== 测试完成 ===');
  log('浏览器保持打开，可手动检查结果');
}

main().catch(err => {
  log(`❌ 异常: ${err.message}`);
  log(err.stack);
});