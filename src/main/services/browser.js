/**
 * browser.js - 已废弃，保留空导出防止引用报错
 * 
 * 原功能（Playwright 浏览器管理）已全链路迁移到即梦官方 CLI (dreamina)
 * 参考：https://github.com/7INLUCk/vidclaw/issues/14
 */

module.exports = { 
  BrowserManager: class BrowserManager {
    constructor() {
      console.warn('[browser.js] 已废弃，请使用即梦 CLI login');
    }
    isReady() { return false; }
    getPage() { return null; }
    async launch() { return { success: false, error: '已废弃' }; }
    async close() {}
  }
};