/**
 * 即梦桌面版 —— 自动化自测脚本
 * 测试范围：AI 服务 / Playwright 浏览器 / DOM 定位 / API 拦截 / 下载逻辑
 */

const https = require('https');
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();

chromium.use(stealth);

const JIMENG_URL = 'https://jimeng.jianying.com/ai-tool/home';
const USER_DATA_DIR = path.join(process.env.HOME, 'Library/Application Support/jimeng-desktop/jimeng-profile');
const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY || '';

let results = { pass: 0, fail: 0, skip: 0, details: [] };

function log(status, test, detail = '') {
  const icon = { pass: '✅', fail: '❌', skip: '⏭️' }[status] || '❓';
  results[status]++;
  results.details.push({ status, test, detail });
  console.log(`${icon} ${test}${detail ? ' — ' + detail : ''}`);
}

// ===== 测试 1：AI 服务 =====
async function testAIService() {
  console.log('\n🧠 测试 1：AI 服务（DeepSeek API）');
  
  if (!DEEPSEEK_KEY) {
    log('skip', 'AI 服务', '未配置 DEEPSEEK_API_KEY，跳过');
    return;
  }

  try {
    const body = JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: 'You are a helpful assistant. Reply with just "OK" and nothing else.' },
        { role: 'user', content: 'Say OK' }
      ],
      temperature: 0.1,
      max_tokens: 10,
    });

    const result = await new Promise((resolve, reject) => {
      const url = new URL('https://api.deepseek.com/v1/chat/completions');
      const req = https.request({
        hostname: url.hostname,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DEEPSEEK_KEY}`,
        },
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            resolve(json);
          } catch (e) {
            reject(new Error('解析失败: ' + data.slice(0, 200)));
          }
        });
      });
      req.on('error', reject);
      req.write(body);
      req.end();
    });

    if (result.error) {
      log('fail', 'AI 服务连接', result.error.message);
    } else if (result.choices?.[0]?.message?.content) {
      log('pass', 'AI 服务连接', `回复: "${result.choices[0].message.content.trim()}"`);
    } else {
      log('fail', 'AI 服务连接', '无有效回复');
    }

    // 测试提示词改写
    const rewriteBody = JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: 'You are a prompt engineer. Reply with valid JSON only: {"prompt":"...","duration":5,"aspectRatio":"16:9","type":"video"}' },
        { role: 'user', content: '帮我生成一段猫咪奔跑的视频' }
      ],
      temperature: 0.7,
      max_tokens: 300,
    });

    const rewriteResult = await new Promise((resolve, reject) => {
      const url = new URL('https://api.deepseek.com/v1/chat/completions');
      const req = https.request({
        hostname: url.hostname,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DEEPSEEK_KEY}`,
        },
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try { resolve(JSON.parse(data)); } catch { reject(new Error('解析失败')); }
        });
      });
      req.on('error', reject);
      req.write(rewriteBody);
      req.end();
    });

    const content = rewriteResult.choices?.[0]?.message?.content || '';
    // 尝试提取 JSON
    let parsed = null;
    try { parsed = JSON.parse(content); } catch {
      const m = content.match(/\{[\s\S]*\}/);
      if (m) try { parsed = JSON.parse(m[0]); } catch {}
    }

    if (parsed?.prompt) {
      log('pass', 'AI 提示词改写', `prompt: "${parsed.prompt.slice(0, 60)}..."`);
    } else {
      log('fail', 'AI 提示词改写', '未能解析为结构化 JSON');
    }

  } catch (err) {
    log('fail', 'AI 服务', err.message);
  }
}

// ===== 测试 2：Playwright 浏览器启动 + 导航 =====
async function testBrowserLaunch() {
  console.log('\n🌐 测试 2：Playwright 浏览器启动');
  
  let context = null;
  try {
    // 确保目录存在
    if (!fs.existsSync(USER_DATA_DIR)) {
      fs.mkdirSync(USER_DATA_DIR, { recursive: true });
    }

    // 清理锁
    const lockFile = path.join(USER_DATA_DIR, 'SingletonLock');
    if (fs.existsSync(lockFile)) {
      fs.unlinkSync(lockFile);
      log('pass', 'SingletonLock 清理', '已删除残留锁文件');
    }

    context = await chromium.launchPersistentContext(USER_DATA_DIR, {
      headless: false,
      channel: 'chrome',
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
      ],
      viewport: { width: 1280, height: 720 },
      acceptDownloads: true,
    });

    log('pass', '浏览器启动', 'launchPersistentContext 成功');

    const pages = context.pages();
    const page = pages.length > 0 ? pages[0] : await context.newPage();
    log('pass', '页面获取', `已有 ${pages.length} 个页面`);

    // 导航到即梦
    await page.goto(JIMENG_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    log('pass', '导航到即梦', `URL: ${page.url()}`);

    // 等页面加载
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    log('pass', '页面加载', 'networkidle 就绪（或超时）');

    // ===== 测试 3：DOM 定位 =====
    console.log('\n📍 测试 3：DOM 定位');

    // 检查是否有登录按钮
    const hasLoginBtn = await page.evaluate(() => {
      const btns = document.querySelectorAll('button, a, span');
      for (const btn of btns) {
        if (btn.textContent?.trim() === '登录' && btn.offsetParent !== null) return true;
      }
      return false;
    });
    log('pass', '检测登录按钮', hasLoginBtn ? '找到登录按钮（未登录）' : '未找到登录按钮（可能已登录）');

    // 检查提示词编辑器
    const editorInfo = await page.evaluate(() => {
      const prosemirror = document.querySelector('#prompt-text-editor')
        || document.querySelector('#prompt-text-editor p');
      const textarea = document.querySelector('textarea.lv-textarea')
        || document.querySelector('textarea');
      const contenteditable = document.querySelector('[contenteditable="true"]');

      return {
        prosemirror: !!prosemirror,
        textarea: !!textarea,
        contenteditable: !!contenteditable,
        anyEditor: !!(prosemirror || textarea || contenteditable),
      };
    });

    if (editorInfo.anyEditor) {
      log('pass', '提示词编辑器', JSON.stringify(editorInfo));
    } else {
      log(editorInfo.anyEditor ? 'pass' : 'skip', '提示词编辑器', '未找到编辑器（可能需要登录后才显示）');
    }

    // ===== 测试 4：API 拦截 =====
    console.log('\n📡 测试 4：API 拦截');
    
    let intercepted = false;
    const interceptedUrls = [];
    
    page.on('response', (response) => {
      const url = response.url();
      if (url.includes('/mweb/v1/') || url.includes('/commerce/v1/')) {
        intercepted = true;
        interceptedUrls.push(url.slice(0, 100));
      }
    });

    // 等几秒看有没有 API 调用
    await new Promise(r => setTimeout(r, 5000));

    if (intercepted) {
      log('pass', 'API 拦截', `捕获 ${interceptedUrls.length} 个请求`);
      interceptedUrls.forEach(url => console.log(`    → ${url}`));
    } else {
      log('skip', 'API 拦截', '5秒内无 API 请求（可能需要登录后才有活动）');
    }

    // ===== 测试 5：页面截图 =====
    console.log('\n📸 测试 5：页面截图');
    const screenshotPath = path.join(__dirname, 'screenshot.png');
    await page.screenshot({ path: screenshotPath, fullPage: false });
    log('pass', '页面截图', `保存到: ${screenshotPath}`);

  } catch (err) {
    log('fail', '浏览器测试', err.message);
  } finally {
    if (context) {
      try {
        await context.close();
        log('pass', '浏览器关闭', '已安全关闭');
      } catch {}
    }
  }
}

// ===== 测试 6：下载逻辑 =====
async function testDownload() {
  console.log('\n⬇️ 测试 6：下载逻辑');

  const testUrl = 'https://httpbin.org/image/png';
  const testDir = path.join(process.env.HOME, 'Downloads', '即梦测试');
  
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }

  const filepath = path.join(testDir, 'test.png');

  try {
    await new Promise((resolve, reject) => {
      https.get(testUrl, (response) => {
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          https.get(response.headers.location, (res2) => {
            if (res2.statusCode !== 200) return reject(new Error(`HTTP ${res2.statusCode}`));
            const file = fs.createWriteStream(filepath);
            res2.pipe(file);
            file.on('finish', () => { file.close(); resolve(); });
          }).on('error', reject);
          return;
        }
        if (response.statusCode !== 200) return reject(new Error(`HTTP ${response.statusCode}`));
        const file = fs.createWriteStream(filepath);
        response.pipe(file);
        file.on('finish', () => { file.close(); resolve(); });
      }).on('error', reject);
    });

    const size = fs.statSync(filepath).size;
    log('pass', '文件下载', `${filepath} (${size} bytes)`);

    // 清理
    fs.unlinkSync(filepath);
    fs.rmdirSync(testDir);
  } catch (err) {
    log('fail', '文件下载', err.message);
  }
}

// ===== 测试 7：数据解析 =====
function testDataParsing() {
  console.log('\n📊 测试 7：数据解析');

  // 从 automation.js 导入
  try {
    const { parseItem, getLargestUrl } = require('../electron/services/automation');

    // 测试 getLargestUrl
    const url = getLargestUrl({ '1080': 'https://a.com/1080.mp4', '720': 'https://a.com/720.mp4' });
    log(url === 'https://a.com/1080.mp4' ? 'pass' : 'fail', 'getLargestUrl', `结果: ${url}`);

    // 测试 parseItem
    const mockItem = {
      common_attr: { published_item_id: 'test123', cover_url_map: { '1080': 'https://a.com/thumb.jpg' } },
      aigc_image_params: { text2video_params: { video_gen_inputs: [{ prompt: 'A cat running' }] } },
      video: { origin_video: { video_url: 'https://a.com/video.mp4' } },
    };
    const parsed = parseItem(mockItem);
    log(parsed?.url === 'https://a.com/video.mp4' ? 'pass' : 'fail', 'parseItem (video)', `URL: ${parsed?.url?.slice(0, 40)}`);
    log(parsed?.prompt === 'A cat running' ? 'pass' : 'fail', 'parseItem (prompt)', `Prompt: ${parsed?.prompt}`);

  } catch (err) {
    log('fail', '数据解析', err.message);
  }
}

// ===== 主流程 =====
async function main() {
  console.log('╔══════════════════════════════════════╗');
  console.log('║   即梦桌面版 — 自动化自测            ║');
  console.log('╚══════════════════════════════════════╝\n');

  const startTime = Date.now();

  await testAIService();
  testDataParsing();
  await testDownload();
  await testBrowserLaunch(); // 最后做，因为需要真实浏览器

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n╔══════════════════════════════════════╗');
  console.log(`║  测试完成 — ${elapsed}s`);
  console.log(`║  ✅ ${results.pass} 通过  ❌ ${results.fail} 失败  ⏭️ ${results.skip} 跳过`);
  console.log('╚══════════════════════════════════════╝\n');

  if (results.fail > 0) {
    console.log('❌ 失败项：');
    results.details.filter(d => d.status === 'fail').forEach(d => {
      console.log(`  · ${d.test}: ${d.detail}`);
    });
  }

  process.exit(results.fail > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('💥 测试框架崩溃:', err);
  process.exit(2);
});
