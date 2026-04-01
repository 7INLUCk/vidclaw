/**
 * 即梦 @ 引用测试 v3 - 用键盘导航选择
 * 
 * Tiptap suggestion 通常用键盘操作：
 * 1. 输入 @ 触发下拉
 * 2. 用方向键选择选项
 * 3. 按 Enter 确认选择
 */

const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
const path = require('path');
const fs = require('fs');

chromium.use(stealth);

const PROFILE = path.join(process.env.HOME, 'Library/Application Support/jimeng-desktop/jimeng-profile');
const TEST_FILES = path.join(process.env.HOME, 'Downloads', '即梦', 'test-files');
const logFile = path.join(process.env.HOME, 'Downloads', '即梦', 'at-test-v3.log');

const log = msg => {
  const l = `[${new Date().toISOString().slice(11,19)}] ${msg}`;
  console.log(l);
  try { fs.appendFileSync(logFile, l + '\n'); } catch {}
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  log('=== @ 引用测试 v3 (键盘导航) ===');
  
  // 清理锁文件
  ['SingletonLock', 'SingletonSocket', 'SingletonPipe', 'SingletonCookie'].forEach(f => {
    fs.rmSync(path.join(PROFILE, f), { force: true });
  });

  const ctx = await chromium.launchPersistentContext(PROFILE, {
    headless: false, channel: 'chrome', slowMo: 50,
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

  // Step 2: 聚焦编辑器
  log('\n--- Step 2: 聚焦编辑器 ---');
  const editor = await page.$('.tiptap.ProseMirror[contenteditable="true"]');
  if (!editor) { log('❌ 未找到编辑器'); return; }
  await editor.click();
  await sleep(500);
  
  // 清空
  await page.keyboard.press('Meta+a');
  await page.keyboard.press('Backspace');
  await sleep(300);

  // Step 3: 输入 "让 " + @ + 选择图片1
  log('\n--- Step 3: 输入 "让" + @图片1 ---');
  await page.keyboard.type('让', { delay: 80 });
  await sleep(200);
  await page.keyboard.type('@', { delay: 80 });
  await sleep(2000); // 等待下拉动画

  // 检查下拉内容
  const dropdownContent = await page.evaluate(() => {
    const items = document.querySelectorAll('li.lv-select-option, [role="option"], [class*="select-option"]');
    return Array.from(items).map(el => ({
      text: el.textContent.trim(),
      visible: el.offsetParent !== null,
      classes: el.className,
    })).filter(x => x.visible);
  });
  log(`下拉内容: ${JSON.stringify(dropdownContent)}`);

  // 用键盘选择第一项（图片1）
  log('按 ArrowDown 选择图片1，然后 Enter...');
  await page.keyboard.press('ArrowDown');
  await sleep(300);
  await page.keyboard.press('Enter');
  await sleep(1000);

  // 检查插入结果
  let content = await page.evaluate(() => {
    const ed = document.querySelector('.tiptap.ProseMirror[contenteditable="true"]');
    return ed ? { text: ed.textContent, html: ed.innerHTML.slice(0, 500) } : { text: 'no editor' };
  });
  log(`插入图片1后: ${content.text}`);

  // Step 4: 输入 " 里的这个人照着 "
  log('\n--- Step 4: 输入中间文字 ---');
  await page.keyboard.type(' 里的这个人照着', { delay: 80 });
  await sleep(500);

  // Step 5: 输入 @视频1
  log('\n--- Step 5: 输入 @视频1 ---');
  await page.keyboard.type('@', { delay: 80 });
  await sleep(2000);

  // 检查下拉
  const dropdown2 = await page.evaluate(() => {
    const items = document.querySelectorAll('li.lv-select-option, [role="option"], [class*="select-option"]');
    return Array.from(items).map(el => el.textContent.trim()).filter(t => t);
  });
  log(`第二次下拉: ${JSON.stringify(dropdown2)}`);

  // 选择视频1（可能在第二位）
  log('按 ArrowDown 选择视频1，然后 Enter...');
  await page.keyboard.press('ArrowDown');
  await sleep(300);
  // 如果有两个选项，需要再按一次
  if (dropdown2.length >= 2) {
    await page.keyboard.press('ArrowDown');
    await sleep(300);
  }
  await page.keyboard.press('Enter');
  await sleep(1000);

  // Step 6: 输入结尾
  log('\n--- Step 6: 输入结尾 ---');
  await page.keyboard.type(' 里的动作做舞蹈。', { delay: 80 });
  await sleep(1000);

  // Step 7: 最终检查
  log('\n--- Step 7: 最终结果 ---');
  const final = await page.evaluate(() => {
    const ed = document.querySelector('.tiptap.ProseMirror[contenteditable="true"]');
    if (!ed) return { text: 'no editor' };
    return {
      text: ed.textContent,
      html: ed.innerHTML,
      // 检查有没有 reference/mention 相关节点
      refs: ed.querySelectorAll('[class*="reference"], [class*="mention"], [data-type="mention"], [data-resource]').length,
      spans: Array.from(ed.querySelectorAll('span')).map(s => ({
        class: s.className,
        text: s.textContent,
        data: Array.from(s.attributes).map(a => `${a.name}=${a.value}`).join(', '),
      })),
    };
  });
  log(`最终文本: ${final.text}`);
  log(`引用节点数: ${final.refs}`);
  log(`所有span: ${JSON.stringify(final.spans, null, 2)}`);
  log(`HTML: ${final.html.slice(0, 800)}`);

  // Step 8: 提交
  log('\n--- Step 8: 按 Enter 提交 ---');
  await page.keyboard.press('Enter');

  log('\n=== 测试完成 ===');
}

main().catch(err => {
  log(`❌ 异常: ${err.message}`);
  log(err.stack);
});