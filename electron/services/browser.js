const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
const path = require('path');
const fs = require('fs');

// 应用 stealth 插件
chromium.use(stealth);

const JIMENG_URL = 'https://jimeng.jianying.com/ai-tool/generate';
const LOGIN_CHECK_SELECTOR = '[class*="avatar"], [class*="user-info"], [class*="workspace"]';

class BrowserManager {
  constructor(userDataPath) {
    this.context = null;
    this.page = null;
    this.userDataDir = path.join(userDataPath, 'jimeng-profile');
    this.ready = false;
    this.launching = false;

    if (!fs.existsSync(this.userDataDir)) {
      fs.mkdirSync(this.userDataDir, { recursive: true });
    }
  }

  // 检查是否已有登录态（storage-state.json 或 Cookie 存在）
  hasLoginState() {
    const statePath = path.join(this.userDataDir, 'storage-state.json');
    if (fs.existsSync(statePath)) {
      try {
        const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
        if (state.cookies && state.cookies.length > 0) {
          return true;
        }
      } catch {}
    }
    // 检查 Chrome profile 的 Cookie 数据库
    const cookieDb = path.join(this.userDataDir, 'Default', 'Cookies');
    if (fs.existsSync(cookieDb)) {
      return true;
    }
    return false;
  }

  async launch(forceVisible = false) {
    if (this.context || this.launching) {
      console.log('浏览器已启动或正在启动，跳过');
      return;
    }
    this.launching = true;

    // 决定 headless 模式：有登录态 + 未强制可见 → headless
    const hasLogin = this.hasLoginState();
    const useHeadless = hasLogin && !forceVisible;
    console.log(`启动浏览器, userDataDir: ${this.userDataDir}, headless: ${useHeadless}, hasLogin: ${hasLogin}`);

    // ===== Step 0: 杀掉残留的 Chrome 进程（防止 SingletonLock 冲突）=====
    try {
      const { execSync } = require('child_process');
      // 只杀用 jimeng-profile 的 Chrome 进程
      execSync(`pkill -f "jimeng-profile" 2>/dev/null || true`);
      // 等进程真正退出
      await new Promise(r => setTimeout(r, 500));
      console.log('已清理残留 Chrome 进程');
    } catch {}

    // ===== Step 1: 清理残留的锁文件 =====
    const lockFile = path.join(this.userDataDir, 'SingletonLock');
    const singletonCookieDb = path.join(this.userDataDir, 'Default', 'Cookies-journal');

    // 清理 SingletonLock（重试机制）
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        if (fs.existsSync(lockFile)) {
          fs.unlinkSync(lockFile);
          console.log(`已清理残留 SingletonLock (attempt ${attempt + 1})`);
        }
        break;
      } catch (e) {
        console.log(`清理 SingletonLock 失败 (attempt ${attempt + 1}):`, e.message);
        await new Promise(r => setTimeout(r, 500));
      }
    }

    // 清理 Chrome Socket 文件
    try {
      const socketPath = path.join(this.userDataDir, 'SingletonSocket');
      const pipePath = path.join(this.userDataDir, 'SingletonPipe');
      const socketLockPath = path.join(this.userDataDir, 'SingletonCookie');
      [socketPath, pipePath, socketLockPath].forEach(f => {
        try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch {}
      });
    } catch {}

    // 清理 Chrome 崩溃标记，避免"恢复页面"弹窗
    try {
      const prefsPath = path.join(this.userDataDir, 'Default', 'Preferences');
      if (fs.existsSync(prefsPath)) {
        const prefs = JSON.parse(fs.readFileSync(prefsPath, 'utf8'));
        if (prefs.profile?.exit_type === 'Crashed' || prefs.profile?.exited_cleanly === false) {
          prefs.profile.exit_type = 'Normal';
          prefs.profile.exited_cleanly = true;
          fs.writeFileSync(prefsPath, JSON.stringify(prefs));
          console.log('已清理 Chrome 崩溃标记');
        }
      }
    } catch (e) {
      console.log('清理崩溃标记失败（可忽略）:', e.message);
    }

    const launchOptions = {
      headless: useHeadless,        // 有登录态时隐身运行
      channel: 'chrome',
      slowMo: useHeadless ? 0 : 50, // headless 时不需要放慢
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-session-crashed-bubble',
        '--disable-infobars',
      ],
      viewport: { width: 1280, height: 720 },
      acceptDownloads: true,
    };

    try {
      this.context = await chromium.launchPersistentContext(this.userDataDir, launchOptions);
    } catch (err) {
      if (err.message?.includes('SingletonLock') || err.message?.includes('ProcessSingleton')) {
        console.log('锁冲突，杀残留进程 + 清理后重试...');
        try { require('child_process').execSync(`pkill -f "jimeng-profile" 2>/dev/null || true`); } catch {}
        await new Promise(r => setTimeout(r, 1000));
        // 清理所有锁文件
        [lockFile, path.join(this.userDataDir, 'SingletonSocket'), path.join(this.userDataDir, 'SingletonPipe'), path.join(this.userDataDir, 'SingletonCookie')].forEach(f => {
          try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch {}
        });
        await new Promise(r => setTimeout(r, 500));
        this.context = await chromium.launchPersistentContext(this.userDataDir, launchOptions);
      } else {
        throw err;
      }
    }

    // 获取或创建页面
    const pages = this.context.pages();
    if (pages.length > 0) {
      this.page = pages[0];
    } else {
      this.page = await this.context.newPage();
    }

    // 打开即梦
    await this.page.goto(JIMENG_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    console.log('已打开即梦页面');

    // 捕获浏览器 console 日志，写入文件便于远程 debug
    this._browserLogFile = path.join(path.dirname(this.userDataDir), 'browser-console.log');
    this.page.on('console', msg => {
      const line = `[${new Date().toISOString().slice(11, 19)}] [${msg.type()}] ${msg.text()}`;
      // 只记录 warn/error 和自动化相关日志
      if (msg.type() === 'error' || msg.type() === 'warning' || msg.text().includes('[自动化]')) {
        try { require('fs').appendFileSync(this._browserLogFile, line + '\n'); } catch {}
      }
    });

    this.ready = true;
    this.launching = false;
  }

  async isLoggedIn() {
    if (!this.page) return false;
    try {
      await this.page.waitForSelector(LOGIN_CHECK_SELECTOR, { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  async clickLoginButton() {
    if (!this.page) return false;
    try {
      await this.page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

      const selectors = [
        'button:has-text("登录")',
        'a:has-text("登录")',
        'span:has-text("登录")',
        '[class*="login"]',
        '[class*="Login"]',
        '[class*="sign-in"]',
        '[class*="signin"]',
        '[data-testid*="login"]',
      ];

      for (const sel of selectors) {
        try {
          const el = await this.page.$(sel);
          if (el) {
            console.log('找到登录按钮:', sel);
            await el.click();
            console.log('已点击登录按钮');
            return true;
          }
        } catch {}
      }

      console.log('未找到登录按钮，可能已登录或页面结构不同');
      return false;
    } catch (err) {
      console.warn('点击登录按钮失败:', err.message);
      return false;
    }
  }

  isReady() {
    return this.ready;
  }

  getPage() {
    return this.page;
  }

  async close() {
    if (this.context) {
      const statePath = path.join(this.userDataDir, 'storage-state.json');
      try {
        const state = await this.context.storageState();
        fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
        console.log('登录态已备份到:', statePath);
      } catch (e) {
        console.warn('备份登录态失败:', e);
      }

      await this.context.close();
      this.context = null;
      this.page = null;
      this.ready = false;
      console.log('浏览器已关闭');
    }
  }
}

module.exports = { BrowserManager };
