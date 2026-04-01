/**
 * 即梦 @ 引用正确交互测试
 * 目标：验证如何正确触发 @ 引用下拉并选择素材
 * 
 * 核心思路：
 * 1. 用 page.keyboard.type() 而非 InputEvent（更接近真实键盘输入）
 * 2. 上传文件后输入 @ 触发下拉
 * 3. 检查下拉内容并点击
 */

const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
const path = require('path');
const fs = require('fs');

chromium.use(stealth);

const PROFILE = path.join(process.env.HOME, 'Library/Application Support/jimeng-desktop/jimeng-profile');
const TEST_FILES = path.join(process.env.HOME, 'Downloads', '即梦', 'test-files');
const logFile = path.join(process.env.HOME, 'Downloads', '即梦', 'at-keyboard-test.log');

const log = msg => {
  const l = `[${new Date().toISOString().slice(11,19)}] ${msg}`;
  console.log(l);
  try { fs.appendFileSync(logFile, l + '\n'); } catch {}
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  log('=== @ 引用键盘输入测试 ===');
  fs.rmSync(path.join(PROFILE, 'SingletonLock'), { force: true });

  const ctx = await chromium.launchPersistentContext(PROFILE, {
    headless: false, channel: 'chrome', slowMo: 30,
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox',
           '--disable-session-crashed-bubble', '--disable-infobars'],
    viewport: { width: 1280, height: 800 },
  });

  const page = ctx.pages()[0] || await ctx.newPage();

  // 导航到即梦
  log('打开即梦...');
  await page.goto('https://jimeng.jianying.com/ai-tool/generate', {
    waitUntil: 'domcontentloaded', timeout: 30000
  });
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  await sleep(3000);

  // Step 1: 检查是否有编辑器
  log('\n--- Step 1: 找到编辑器 ---');
  const editorExists = await page.evaluate(() => {
    const editors = document.querySelectorAll('.tiptap.ProseMirror, [contenteditable="true"]');
    const visible = [];
    for (const el of editors) {
      visible.push({
        tag: el.tagName,
        classes: (el.className || '').toString().slice(0, 60),
        visible: el.offsetParent !== null,
        editable: el.contentEditable,
      });
    }
    return visible;
  });
  log(`编辑器: ${JSON.stringify(editorExists)}`);

  // Step 2: 聚焦编辑器并用 keyboard.type() 输入文字
  log('\n--- Step 2: 用 keyboard.type() 输入测试文字 ---');
  
  // 找到可见的编辑器并点击
  const editorSelector = '.tiptap.ProseMirror';
  const editors = await page.$$(editorSelector);
  let targetEditor = null;
  for (const el of editors) {
    if (await el.isVisible()) {
      targetEditor = el;
      break;
    }
  }
  
  if (!targetEditor) {
    // 降级到 contenteditable
    const allEditables = await page.$$('[contenteditable="true"]');
    for (const el of allEditables) {
      if (await el.isVisible()) {
        targetEditor = el;
        break;
      }
    }
  }

  if (targetEditor) {
    log('找到可见编辑器，点击聚焦...');
    await targetEditor.click();
    await sleep(500);
    
    // 先清空编辑器
    await page.keyboard.press('Meta+a');
    await sleep(100);
    await page.keyboard.press('Backspace');
    await sleep(300);

    // 用 keyboard.type() 输入文字
    log('输入 "测试文字"...');
    await page.keyboard.type('测试文字', { delay: 100 });
    await sleep(500);

    // 检查编辑器内容
    const content = await page.evaluate(() => {
      const editor = document.querySelector('.tiptap.ProseMirror[contenteditable="true"]')
        || document.querySelector('[contenteditable="true"]');
      return editor ? editor.textContent : 'no editor';
    });
    log(`编辑器内容: "${content}"`);
  } else {
    log('❌ 未找到可见编辑器');
    return;
  }

  // Step 3: 上传文件
  log('\n--- Step 3: 上传文件 ---');
  const imageFile = path.join(TEST_FILES, 'test-image.png');
  const fileInput = await page.$('input[type="file"]');
  
  if (fileInput && fs.existsSync(imageFile)) {
    await fileInput.setInputFiles(imageFile);
    // 触发 change 事件
    await page.evaluate(() => {
      const input = document.querySelector('input[type="file"]');
      if (input) {
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    log('图片已上传，等待前端处理...');
    await sleep(3000);
  } else {
    log(`⚠️ file input: ${!!fileInput}, 文件存在: ${fs.existsSync(imageFile)}`);
  }

  // Step 4: 聚焦编辑器，输入 @
  log('\n--- Step 4: 输入 @ 触发下拉 ---');
  
  // 再次点击编辑器确保焦点
  if (targetEditor) {
    await targetEditor.click();
    await sleep(300);
    
    // 输入 @
    log('用 keyboard.type() 输入 @...');
    await page.keyboard.type('@', { delay: 50 });
    await sleep(1000);

    // 检查下拉是否出现
    const dropdownInfo = await page.evaluate(() => {
      const results = { dropdowns: [], suggestions: [], popups: [] };
      
      // 检查所有可能的下拉元素
      const selectors = [
        '[class*="dropdown"]', '[class*="suggestion"]', '[class*="popup"]',
        '[class*="mention"]', '[class*="at-"]', '[role="listbox"]',
        '[class*="reference-list"]', '[class*="material-list"]',
        'ul[class*="list"]', 'div[class*="panel"]',
      ];
      
      for (const sel of selectors) {
        document.querySelectorAll(sel).forEach(el => {
          if (el.offsetParent !== null) {
            results.dropdowns.push({
              selector: sel,
              tag: el.tagName,
              classes: (el.className || '').toString().slice(0, 80),
              childCount: el.children.length,
              text: (el.textContent || '').trim().slice(0, 100),
            });
          }
        });
      }
      
      // 检查包含 "图片" 或 "视频" 文字的可见元素
      document.querySelectorAll('*').forEach(el => {
        const text = (el.textContent || '').trim();
        if (el.offsetParent !== null && text.length < 20 && text.length > 2 &&
            (text.includes('图片') || text.includes('视频')) &&
            !el.closest('.tiptap.ProseMirror, [contenteditable]')) {
          results.suggestions.push({
            tag: el.tagName,
            classes: (el.className || '').toString().slice(0, 50),
            text,
          });
        }
      });
      
      return results;
    });
    log(`下拉检测: ${JSON.stringify(dropdownInfo, null, 2)}`);

    // Step 5: 如果找到下拉，尝试点击第一项
    if (dropdownInfo.suggestions.length > 0 || dropdownInfo.dropdowns.length > 0) {
      log('\n--- Step 5: 尝试点击下拉选项 ---');
      
      // 尝试点击包含图片/视频的元素
      const clicked = await page.evaluate(() => {
        // 方法 1: 找包含 "图片1" 或 "视频1" 的元素
        const candidates = [];
        document.querySelectorAll('*').forEach(el => {
          const text = (el.textContent || '').trim();
          if (el.offsetParent !== null && text.length < 20 &&
              (text.includes('图片1') || text.includes('视频1')) &&
              !el.closest('.tiptap.ProseMirror, [contenteditable]')) {
            candidates.push(el);
          }
        });
        
        if (candidates.length > 0) {
          candidates[0].click();
          return { clicked: true, text: candidates[0].textContent.trim() };
        }
        
        return { clicked: false };
      });
      log(`点击结果: ${JSON.stringify(clicked)}`);
    }

    await sleep(1000);
    
    // Step 6: 检查编辑器最终内容
    log('\n--- Step 6: 检查最终编辑器内容 ---');
    const finalContent = await page.evaluate(() => {
      const editor = document.querySelector('.tiptap.ProseMirror[contenteditable="true"]')
        || document.querySelector('[contenteditable="true"]');
      if (!editor) return { text: 'no editor', html: '' };
      return {
        text: editor.textContent,
        html: editor.innerHTML.slice(0, 500),
        mentionNodes: editor.querySelectorAll('[data-type="mention"], [class*="mention"]').length,
      };
    });
    log(`最终内容: ${JSON.stringify(finalContent, null, 2)}`);
  }

  // Step 7: 尝试另一种方式 - 直接用 ProseMirror API 插入 mention
  log('\n--- Step 7: 尝试 ProseMirror API 直接插入 mention ---');
  const insertResult = await page.evaluate(() => {
    const editor = document.querySelector('.tiptap.ProseMirror[contenteditable="true"]')
      || document.querySelector('[contenteditable="true"]');
    if (!editor) return { success: false, error: 'no editor' };

    // 尝试找到 editorView
    // Tiptap 把 EditorView 存储在 editor element 的 __vue__ 或 __tiptap_editor 属性上
    const keys = Object.keys(editor).filter(k => k.startsWith('__'));
    
    // 检查 ProseMirror view
    let pmView = null;
    for (const key of Object.getOwnPropertyNames(editor)) {
      if (key.includes('prosemirror') || key.includes('tiptap')) {
        return { success: false, error: `found key: ${key}`, keys };
      }
    }
    
    // 尝试通过 Tiptap 编辑器实例
    const editorEl = document.querySelector('[data-tippy-root]')?.parentElement 
      || document.querySelector('.ProseMirror');
    
    return { success: false, error: 'could not find EditorView', editorKeys: keys };
  });
  log(`ProseMirror API 结果: ${JSON.stringify(insertResult)}`);

  // 最终
  log('\n=== 测试完成 ===');
  log('浏览器保持打开，可手动检查');
}

main().catch(err => {
  log(`❌ 异常: ${err.message}`);
  log(err.stack);
});
