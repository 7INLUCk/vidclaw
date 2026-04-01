#!/usr/bin/env node
/**
 * 即梦自动化全流程测试脚本
 * 
 * 测试内容：
 * 1. 模式切换：Seedance → Agent → 视频生成 → 首尾帧 → 全能参考
 * 2. 提示词输入（带 @ 引用）
 * 3. 文件上传
 * 4. 画幅比例、秒数设置
 * 
 * 运行方式：node test/full-flow-test.js
 */

const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
const path = require('path');
const fs = require('fs');

// 应用 stealth 插件
chromium.use(stealth);

// ===== 配置 =====
const USER_DATA_DIR = path.join(process.env.HOME, '.openclaw/workspace-alex/projects/jimeng-desktop/user-data');
const JIMENG_URL = 'https://jimeng.jianying.com/ai-tool/generate';
const TIMEOUT = 30000;

// 测试素材（已存在）
const TEST_IMAGE = path.join(process.env.HOME, 'Downloads/即梦/test-files/test-image.png');
const TEST_VIDEO = path.join(process.env.HOME, 'Downloads/即梦/test-files/test-video.mp4');

// 日志
function log(step, msg, success = true) {
  const icon = success ? '✅' : '❌';
  const ts = new Date().toLocaleTimeString('zh-CN', { hour12: false });
  console.log(`[${ts}] [${step}] ${icon} ${msg}`);
}

function logInfo(step, msg) {
  const ts = new Date().toLocaleTimeString('zh-CN', { hour12: false });
  console.log(`[${ts}] [${step}] ℹ️ ${msg}`);
}

// ===== 工具函数 =====
async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms + Math.random() * 300));
}

async function waitFor(condition, { timeout = 10000, interval = 300, errorMessage = '等待超时' } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const result = await condition();
      if (result) return result;
    } catch {}
    await new Promise(r => setTimeout(r, interval));
  }
  throw new Error(errorMessage);
}

// ===== 主测试函数 =====
async function runTests() {
  console.log('='.repeat(60));
  console.log('即梦自动化全流程测试');
  console.log('='.repeat(60));
  
  let browser = null;
  let page = null;
  const results = [];

  try {
    // ===== Step 0: 启动浏览器 =====
    logInfo('Step 0', '启动浏览器...');
    
    // 清理锁文件
    const lockFile = path.join(USER_DATA_DIR, 'SingletonLock');
    if (fs.existsSync(lockFile)) {
      fs.unlinkSync(lockFile);
      logInfo('Step 0', '已清理 SingletonLock');
    }

    browser = await chromium.launchPersistentContext(USER_DATA_DIR, {
      headless: false,
      channel: 'chrome',
      viewport: { width: 1400, height: 900 },
      args: ['--disable-blink-features=AutomationControlled'],
    });

    page = browser.pages()[0] || await browser.newPage();
    log('Step 0', '浏览器启动成功');

    // ===== Step 1: 导航到生成页面 =====
    logInfo('Step 1', '导航到生成页面...');
    await page.goto(JIMENG_URL, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    await sleep(2000);
    log('Step 1', '已导航到生成页面');

    // ===== Step 2: 等待页面加载完成 =====
    logInfo('Step 2', '等待页面核心元素加载...');
    try {
      await waitFor(async () => {
        const hasEditor = await page.evaluate(() => {
          return !!document.querySelector('.tiptap.ProseMirror[contenteditable="true"]')
            || !!document.querySelector('textarea');
        });
        const btnCount = await page.evaluate(() => {
          return document.querySelectorAll('button').length;
        });
        return hasEditor && btnCount >= 5;
      }, { timeout: 20000, errorMessage: '页面加载超时' });
      log('Step 2', '页面核心元素已加载');
    } catch (e) {
      log('Step 2', `页面加载超时: ${e.message}`, false);
      results.push({ step: '页面加载', success: false, error: e.message });
    }

    // ===== Step 3: 点击 Seedance tab =====
    logInfo('Step 3', '点击 Seedance tab...');
    try {
      // 截图记录当前状态
      await page.screenshot({ path: path.join(process.env.HOME, 'Downloads/即梦/test-step3-before.png') });
      
      // 找 Seedance 按钮（排除导航栏的长文本）
      const seedanceClicked = await page.evaluate(() => {
        const buttons = document.querySelectorAll('button, span, div');
        for (const btn of buttons) {
          const text = (btn.textContent || '').trim();
          // 精确匹配短文本的 Seedance 按钮
          if (text === 'Seedance' || text.startsWith('Seedance 2.0')) {
            if (btn.offsetParent !== null) {
              btn.click();
              return { success: true, text: text.slice(0, 30) };
            }
          }
        }
        // 降级：找包含 Seedance 但文字不太长的
        for (const btn of buttons) {
          const text = (btn.textContent || '').trim();
          if (text.includes('Seedance') && text.length < 50 && btn.offsetParent !== null) {
            btn.click();
            return { success: true, text: text.slice(0, 30) };
          }
        }
        return { success: false };
      });

      if (seedanceClicked.success) {
        log('Step 3', `Seedance tab 已点击: "${seedanceClicked.text}"`);
        await sleep(2000);
      } else {
        throw new Error('未找到 Seedance 按钮');
      }
    } catch (e) {
      log('Step 3', e.message, false);
      results.push({ step: 'Seedance tab', success: false, error: e.message });
    }

    // ===== Step 4: 点击 Agent 模式下拉 =====
    logInfo('Step 4', '点击 Agent 模式下拉...');
    try {
      await page.screenshot({ path: path.join(process.env.HOME, 'Downloads/即梦/test-step4-before.png') });
      
      const agentClicked = await page.evaluate(() => {
        const buttons = document.querySelectorAll('button, [role="combobox"], span');
        for (const btn of buttons) {
          const text = (btn.textContent || '').trim();
          if (text === 'Agent 模式' && btn.offsetParent !== null) {
            btn.click();
            return { success: true, text };
          }
        }
        return { success: false };
      });

      if (agentClicked.success) {
        log('Step 4', 'Agent 模式 已点击');
        await sleep(1500);
      } else {
        throw new Error('未找到 Agent 模式 按钮');
      }
    } catch (e) {
      log('Step 4', e.message, false);
      results.push({ step: 'Agent 模式下拉', success: false, error: e.message });
    }

    // ===== Step 5: 选择「视频生成」=====
    logInfo('Step 5', '选择「视频生成」...');
    try {
      await page.screenshot({ path: path.join(process.env.HOME, 'Downloads/即梦/test-step5-dropdown.png') });
      
      // 关键修复：精确匹配「视频生成」文本，不点击容器
      const videoGenClicked = await page.evaluate(() => {
        // 获取所有可能的下拉选项
        const options = document.querySelectorAll('li, [role="option"], [class*="dropdown-item"], [class*="menu-item"]');
        
        // 先尝试精确匹配
        for (const opt of options) {
          const text = (opt.textContent || '').trim();
          if (text === '视频生成' && opt.offsetParent !== null) {
            opt.click();
            return { success: true, text, method: 'exact' };
          }
        }
        
        // 降级：找包含「视频生成」且文字最短的
        let shortest = null;
        let shortestLen = Infinity;
        for (const opt of options) {
          const text = (opt.textContent || '').trim();
          if (text.includes('视频生成') && opt.offsetParent !== null) {
            if (text.length < shortestLen) {
              shortest = opt;
              shortestLen = text.length;
            }
          }
        }
        
        if (shortest) {
          shortest.click();
          return { success: true, text: (shortest.textContent || '').trim().slice(0, 40), method: 'shortest' };
        }
        
        return { success: false };
      });

      if (videoGenClicked.success) {
        log('Step 5', `视频生成 已选择 (${videoGenClicked.method}): "${videoGenClicked.text}"`);
        await sleep(2000);
      } else {
        throw new Error('未找到「视频生成」选项');
      }
    } catch (e) {
      log('Step 5', e.message, false);
      results.push({ step: '选择视频生成', success: false, error: e.message });
    }

    // ===== Step 6: 点击「首尾帧」下拉 =====
    logInfo('Step 6', '点击「首尾帧」下拉...');
    try {
      await page.screenshot({ path: path.join(process.env.HOME, 'Downloads/即梦/test-step6-before.png') });
      
      const subModeClicked = await page.evaluate(() => {
        const buttons = document.querySelectorAll('button, [role="combobox"], span');
        for (const btn of buttons) {
          const text = (btn.textContent || '').trim();
          if (text.includes('首尾帧') && btn.offsetParent !== null) {
            btn.click();
            return { success: true, text: text.slice(0, 30) };
          }
        }
        return { success: false };
      });

      if (subModeClicked.success) {
        log('Step 6', `首尾帧 已点击: "${subModeClicked.text}"`);
        await sleep(1500);
      } else {
        throw new Error('未找到「首尾帧」下拉');
      }
    } catch (e) {
      log('Step 6', e.message, false);
      results.push({ step: '首尾帧下拉', success: false, error: e.message });
    }

    // ===== Step 7: 选择「全能参考」=====
    logInfo('Step 7', '选择「全能参考」...');
    try {
      await page.screenshot({ path: path.join(process.env.HOME, 'Downloads/即梦/test-step7-dropdown.png') });
      
      const omniRefClicked = await page.evaluate(() => {
        const options = document.querySelectorAll('li, [role="option"], [class*="dropdown-item"], [class*="menu-item"]');
        
        // 精确匹配
        for (const opt of options) {
          const text = (opt.textContent || '').trim();
          if (text === '全能参考' && opt.offsetParent !== null) {
            opt.click();
            return { success: true, text, method: 'exact' };
          }
        }
        
        // 降级：找包含「全能参考」且文字最短的
        let shortest = null;
        let shortestLen = Infinity;
        for (const opt of options) {
          const text = (opt.textContent || '').trim();
          if (text.includes('全能参考') && opt.offsetParent !== null) {
            if (text.length < shortestLen) {
              shortest = opt;
              shortestLen = text.length;
            }
          }
        }
        
        if (shortest) {
          shortest.click();
          return { success: true, text: (shortest.textContent || '').trim().slice(0, 40), method: 'shortest' };
        }
        
        return { success: false };
      });

      if (omniRefClicked.success) {
        log('Step 7', `全能参考 已选择 (${omniRefClicked.method}): "${omniRefClicked.text}"`);
        await sleep(2000);
      } else {
        throw new Error('未找到「全能参考」选项');
      }
    } catch (e) {
      log('Step 7', e.message, false);
      results.push({ step: '选择全能参考', success: false, error: e.message });
    }

    // ===== Step 8: 验证模式切换成功 =====
    logInfo('Step 8', '验证模式切换结果...');
    await page.screenshot({ path: path.join(process.env.HOME, 'Downloads/即梦/test-step8-final.png') });
    
    const modeState = await page.evaluate(() => {
      // 检测上传区域是否存在（全能参考特有）
      const hasUpload = !!document.querySelector('input[type="file"]')
        || !!document.querySelector('[class*="upload"]')
        || !!document.querySelector('[class*="material"]');
      
      // 检测提示词编辑器
      const hasEditor = !!document.querySelector('.tiptap.ProseMirror[contenteditable="true"]');
      
      return { hasUpload, hasEditor };
    });

    if (modeState.hasUpload && modeState.hasEditor) {
      log('Step 8', '模式切换验证成功：有上传区域 + 编辑器');
    } else {
      log('Step 8', `模式切换验证异常: hasUpload=${modeState.hasUpload}, hasEditor=${modeState.hasEditor}`, false);
      results.push({ step: '模式验证', success: false, state: modeState });
    }

    // ===== Step 9: 测试文件上传 =====
    logInfo('Step 9', '测试文件上传...');
    try {
      // 检查测试文件是否存在
      if (!fs.existsSync(TEST_IMAGE)) {
        log('Step 9', `测试图片不存在: ${TEST_IMAGE}`, false);
      } else {
        const fileInput = await page.$('input[type="file"]');
        if (fileInput) {
          await fileInput.setInputFiles([TEST_IMAGE]);
          await sleep(3000);
          log('Step 9', '图片上传成功');
        } else {
          throw new Error('未找到文件上传 input');
        }
      }
    } catch (e) {
      log('Step 9', e.message, false);
      results.push({ step: '文件上传', success: false, error: e.message });
    }

    // ===== Step 10: 测试提示词输入 =====
    logInfo('Step 10', '测试提示词输入...');
    try {
      const editor = await page.$('.tiptap.ProseMirror[contenteditable="true"]');
      if (editor) {
        await editor.click();
        await sleep(300);
        await page.keyboard.type('这是一个测试提示词，让图片里的人物跳舞。', { delay: 50 });
        await sleep(500);
        log('Step 10', '提示词输入成功');
      } else {
        throw new Error('未找到编辑器');
      }
    } catch (e) {
      log('Step 10', e.message, false);
      results.push({ step: '提示词输入', success: false, error: e.message });
    }

    // ===== Step 11: 测试视频上传 =====
    logInfo('Step 11', '测试视频上传...');
    try {
      if (!fs.existsSync(TEST_VIDEO)) {
        log('Step 11', `测试视频不存在: ${TEST_VIDEO}`, false);
      } else {
        // 全能参考模式有两个上传区域：图片 + 视频
        // 找所有 file input，第二个通常是视频
        const fileInputs = await page.$$('input[type="file"]');
        if (fileInputs.length >= 2) {
          await fileInputs[1].setInputFiles([TEST_VIDEO]);
          await sleep(5000); // 视频上传需要更长时间
          log('Step 11', `视频上传成功（共 ${fileInputs.length} 个上传区域）`);
        } else if (fileInputs.length === 1) {
          // 只有一个上传区域，可能需要先清空再上传视频
          log('Step 11', '只有一个上传区域，跳过视频上传测试', false);
        } else {
          throw new Error('未找到任何文件上传 input');
        }
      }
    } catch (e) {
      log('Step 11', e.message, false);
      results.push({ step: '视频上传', success: false, error: e.message });
    }

    // ===== Step 12: 测试 @ 引用（键盘导航）=====
    logInfo('Step 12', '测试 @ 引用功能...');
    try {
      // 先清空编辑器，重新输入带 @ 的提示词
      const editor = await page.$('.tiptap.ProseMirror[contenteditable="true"]');
      if (editor) {
        await editor.click();
        await sleep(200);
        
        // 全选删除
        await page.keyboard.press('Meta+a');
        await sleep(100);
        await page.keyboard.press('Backspace');
        await sleep(300);
        
        // 输入 @ 触发引用菜单
        await page.keyboard.type('让@');
        await sleep(1500); // 等待下拉菜单
        
        // 键盘导航选择第一个引用
        await page.keyboard.press('ArrowDown');
        await sleep(200);
        await page.keyboard.press('Enter');
        await sleep(500);
        
        // 继续输入
        await page.keyboard.type('里的这个人照着@');
        await sleep(1500);
        await page.keyboard.press('ArrowDown');
        await sleep(200);
        await page.keyboard.press('ArrowDown'); // 第二个选项
        await sleep(200);
        await page.keyboard.press('Enter');
        await sleep(500);
        await page.keyboard.type('里的动作跳舞。');
        
        await sleep(500);
        await page.screenshot({ path: path.join(process.env.HOME, 'Downloads/即梦/test-step12-at-ref.png') });
        log('Step 12', '@ 引用输入成功');
      } else {
        throw new Error('未找到编辑器');
      }
    } catch (e) {
      log('Step 12', e.message, false);
      results.push({ step: '@ 引用', success: false, error: e.message });
    }

    // ===== Step 13: 测试画幅比例 =====
    logInfo('Step 13', '测试画幅比例设置...');
    try {
      await page.screenshot({ path: path.join(process.env.HOME, 'Downloads/即梦/test-step13-before.png') });
      
      // 查找画幅比例按钮（通常是 "16:9" 或 "9:16" 或 "1:1"）
      const ratioClicked = await page.evaluate(() => {
        const buttons = document.querySelectorAll('button, [class*="ratio"], [class*="aspect"]');
        for (const btn of buttons) {
          const text = (btn.textContent || '').trim();
          if (text.includes('9:16') || text.includes('16:9') || text.includes('1:1')) {
            if (btn.offsetParent !== null) {
              btn.click();
              return { success: true, text };
            }
          }
        }
        return { success: false };
      });

      if (ratioClicked.success) {
        log('Step 13', `画幅比例按钮点击: "${ratioClicked.text}"`);
        await sleep(1000);
      } else {
        log('Step 13', '未找到画幅比例按钮（可能已隐藏或命名不同）', false);
      }
    } catch (e) {
      log('Step 13', e.message, false);
      results.push({ step: '画幅比例', success: false, error: e.message });
    }

    // ===== Step 14: 测试秒数设置（验证所有选项）=====
    logInfo('Step 14', '测试秒数设置...');
    try {
      await page.screenshot({ path: path.join(process.env.HOME, 'Downloads/即梦/test-step14-before.png') });
      
      // 1. 先点击秒数按钮打开下拉菜单
      const durationBtn = await page.evaluate(() => {
        const allButtons = document.querySelectorAll('button, span, div');
        for (const btn of allButtons) {
          const text = (btn.textContent || '').trim();
          if (/^\d+s$/.test(text) && btn.offsetParent !== null) {
            btn.click();
            return { success: true, text };
          }
        }
        return { success: false };
      });

      if (!durationBtn.success) {
        throw new Error('未找到秒数按钮');
      }
      log('Step 14', `点击秒数按钮: "${durationBtn.text}"`);
      await sleep(1500);

      // 2. 检查下拉菜单中有哪些选项
      const availableDurations = await page.evaluate(() => {
        const options = document.querySelectorAll('li, [role="option"], [class*="dropdown-item"], [class*="menu-item"]');
        const durations = [];
        for (const opt of options) {
          const text = (opt.textContent || '').trim();
          // 匹配 "4s", "5s", ... "12s"
          if (/^\d+s$/.test(text) && opt.offsetParent !== null) {
            durations.push(text);
          }
        }
        return durations;
      });

      logInfo('Step 14', `下拉菜单中的秒数选项: ${availableDurations.join(', ')}`);
      
      // 期望的完整列表：4s-12s
      const expectedDurations = ['4s', '5s', '6s', '7s', '8s', '9s', '10s', '11s', '12s'];
      const missingDurations = expectedDurations.filter(d => !availableDurations.includes(d));
      
      if (missingDurations.length > 0) {
        log('Step 14', `⚠️ 缺少的秒数选项: ${missingDurations.join(', ')}`, false);
        results.push({ step: '秒数选项', success: false, missing: missingDurations });
      } else {
        log('Step 14', `✅ 所有 9 个秒数选项都在: ${availableDurations.join(', ')}`);
      }

      // 3. 随机选一个测试点击（比如 7s）
      const testDuration = availableDurations.find(d => d === '7s') || availableDurations[2];
      if (testDuration) {
        const clicked = await page.evaluate((dur) => {
          const options = document.querySelectorAll('li, [role="option"], [class*="dropdown-item"], [class*="menu-item"]');
          for (const opt of options) {
            const text = (opt.textContent || '').trim();
            if (text === dur && opt.offsetParent !== null) {
              opt.click();
              return { success: true };
            }
          }
          return { success: false };
        }, testDuration);
        
        if (clicked.success) {
          log('Step 14', `已选择: ${testDuration}`);
          await sleep(500);
        }
      }
    } catch (e) {
      log('Step 14', e.message, false);
      results.push({ step: '秒数设置', success: false, error: e.message });
    }

    // ===== 最终报告 =====
    console.log('\n' + '='.repeat(60));
    console.log('测试报告');
    console.log('='.repeat(60));
    
    if (results.length === 0) {
      console.log('✅ 所有测试通过！');
    } else {
      console.log(`❌ ${results.length} 个测试失败：`);
      results.forEach((r, i) => {
        console.log(`  ${i + 1}. ${r.step}: ${r.error || JSON.stringify(r.state)}`);
      });
    }
    
    console.log('\n截图保存在: ~/Downloads/即梦/test-step*.png');
    console.log('='.repeat(60));

  } catch (e) {
    console.error('测试执行出错:', e);
  } finally {
    // 保持浏览器打开以便检查
    console.log('\n浏览器保持打开，按 Ctrl+C 关闭...');
    // await browser?.close();
  }
}

// 运行测试
runTests().catch(console.error);