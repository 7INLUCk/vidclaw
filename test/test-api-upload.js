/**
 * 诊断脚本：测试 API 上传路径，找出失败原因
 * 1) 测试 byteplus API 是否可从浏览器直接调用（CORS）
 * 2) 测试带签名 vs 不带签名的区别
 * 3) 拦截 jimeng 前端真实的上传请求
 */

const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
const path = require('path');
const fs = require('fs');

chromium.use(stealth);

const PROFILE = path.join(process.env.HOME, 'Library/Application Support/jimeng-desktop/jimeng-profile');
const TEST_FILES = path.join(process.env.HOME, 'Downloads', '即梦', 'test-files');
const logFile = path.join(process.env.HOME, 'Downloads', '即梦', 'api-upload-diag.log');

const log = msg => {
  const l = `[${new Date().toISOString().slice(11,19)}] ${msg}`;
  console.log(l);
  try { fs.appendFileSync(logFile, l + '\n'); } catch {}
};

async function main() {
  log('=== API 上传诊断开始 ===');
  fs.rmSync(path.join(PROFILE, 'SingletonLock'), { force: true });

  // 收集所有网络请求
  const apiCalls = [];

  const ctx = await chromium.launchPersistentContext(PROFILE, {
    headless: false, channel: 'chrome', slowMo: 50,
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
    viewport: { width: 1280, height: 800 },
  });

  const page = ctx.pages()[0] || await ctx.newPage();

  // 拦截所有网络响应
  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('bytedanceapi.com') || url.includes('get_upload_token') || url.includes('ApplyImageUpload') || url.includes('ApplyUpload')) {
      try {
        const status = response.status();
        const headers = response.headers();
        let body = '';
        try { body = (await response.text()).slice(0, 500); } catch {}
        apiCalls.push({ url: url.slice(0, 120), status, cors: headers['access-control-allow-origin'] || 'none', body });
        log(`[NET] ${status} ${url.slice(0, 100)} | CORS: ${headers['access-control-allow-origin'] || 'none'}`);
      } catch {}
    }
  });

  // 导航
  log('打开即梦...');
  await page.goto('https://jimeng.jianying.com/ai-tool/generate', {
    waitUntil: 'domcontentloaded', timeout: 30000
  });
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 3000));

  // 测试 1: 直接调用 byteplus API（不带签名） — 预期 CORS 失败
  log('\n--- 测试 1: 直接调用 byteplus API (无签名) ---');
  const test1 = await page.evaluate(async () => {
    try {
      const resp = await fetch('https://imagex.bytedanceapi.com/ApplyImageUpload?Version=2018-08-01&SpaceName=jimeng', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      const text = await resp.text();
      return { success: true, status: resp.status, body: text.slice(0, 300) };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  log(`结果: ${JSON.stringify(test1)}`);

  // 测试 2: 获取 upload token
  log('\n--- 测试 2: 获取 upload token ---');
  const test2 = await page.evaluate(async () => {
    try {
      const resp = await fetch('/mweb/v1/get_upload_token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scene: 2 }),
      });
      const data = await resp.json();
      return {
        success: data.code === 0,
        code: data.code,
        hasAccessKey: !!data.data?.access_key_id,
        hasSecret: !!data.data?.secret_access_key,
        hasSession: !!data.data?.session_token,
        dataKeys: data.data ? Object.keys(data.data) : [],
      };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  log(`Token 结果: ${JSON.stringify(test2)}`);

  // 测试 3: 用 token 调用 byteplus API（但不签名）
  log('\n--- 测试 3: 带 token 但不签名的 byteplus API ---');
  const test3 = await page.evaluate(async () => {
    try {
      // 先获取 token
      const tokenResp = await fetch('/mweb/v1/get_upload_token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scene: 2 }),
      });
      const tokenData = await tokenResp.json();
      if (tokenData.code !== 0) return { success: false, error: 'token 失败' };

      const creds = tokenData.data;
      // 用 session_token 做 Bearer auth 试试
      const resp = await fetch('https://imagex.bytedanceapi.com/ApplyImageUpload?Version=2018-08-01&SpaceName=jimeng', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${creds.session_token}`,
        },
      });
      const text = await resp.text();
      return { success: true, status: resp.status, body: text.slice(0, 300) };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  log(`结果: ${JSON.stringify(test3)}`);

  // 测试 4: 用 DOM 上传，同时拦截 byteplus 响应
  log('\n--- 测试 4: DOM 上传 + 拦截响应 ---');
  const imageFile = path.join(TEST_FILES, 'test-image.png');
  if (fs.existsSync(imageFile)) {
    const fileInput = await page.$('input[type="file"]');
    if (fileInput) {
      log('找到 file input，开始上传...');
      const beforeCount = apiCalls.length;
      await fileInput.setInputFiles(imageFile);
      await new Promise(r => setTimeout(r, 5000));
      log(`上传后新增 ${apiCalls.length - beforeCount} 个 API 调用`);
      for (let i = beforeCount; i < apiCalls.length; i++) {
        log(`  [${i - beforeCount}] ${JSON.stringify(apiCalls[i])}`);
      }
    } else {
      log('未找到 file input');
    }
  } else {
    log(`测试文件不存在: ${imageFile}`);
  }

  // 测试 5: 检查 jimeng 前端的上传相关全局对象
  log('\n--- 测试 5: 检查 jimeng 前端上传相关对象 ---');
  const test5 = await page.evaluate(() => {
    const results = [];
    // 检查常见的上传 SDK
    if (window.TXVodUpload) results.push('TXVodUpload');
    if (window.ImageXClient) results.push('ImageXClient');
    if (window.VodClient) results.push('VodClient');
    if (window.volcEngine) results.push('volcEngine');
    if (window.bytedance) results.push('bytedance');

    // 检查 window 上是否有 upload 相关的属性
    for (const key of Object.keys(window)) {
      if (key.toLowerCase().includes('upload') || key.toLowerCase().includes('imagex') || key.toLowerCase().includes('vod')) {
        results.push(`window.${key}`);
      }
    }
    return results;
  });
  log(`全局对象: ${JSON.stringify(test5)}`);

  log(`\n=== 诊断完成 ===`);
  log(`共收集 ${apiCalls.length} 个相关 API 调用`);
  log('浏览器保持打开，可手动检查');
}

main().catch(err => {
  log(`❌ 异常: ${err.message}`);
  log(err.stack);
});
