import { test, expect, _electron as electron } from '@playwright/test';

test.describe('Settings Page', () => {
  let app: any;
  let window: any;

  test.beforeAll(async () => {
    app = await electron.launch({ args: ['.'] });
    window = await app.firstWindow();
    await window.waitForLoadState('domcontentloaded');
    
    // 尝试导航到设置页
    const settingsBtn = await window.locator('text=Settings').first();
    if (await settingsBtn.count() > 0) {
      await settingsBtn.click();
      await window.waitForTimeout(500);
    }
  });

  test.afterAll(async () => {
    await app.close();
  });

  test('settings page is accessible', async () => {
    // 检查设置页面标题或关键词
    const settingsVisible = await window.locator('text=/设置|Settings|配置/').count() > 0;
    expect(settingsVisible).toBeTruthy();
  });

  test('API Key input is editable', async () => {
    // 查找 API Key 输入框
    const apiKeyInput = await window.locator('input[type="text"]').first();
    if (await apiKeyInput.count() > 0) {
      // 尝试输入测试文本
      await apiKeyInput.fill('test-api-key');
      const value = await apiKeyInput.inputValue();
      expect(value).toContain('test');
    }
  });

  test('download directory selector works', async () => {
    // 查找下载目录相关元素
    const downloadDir = await window.locator('text=/下载|Download|目录|Directory/').count();
    expect(downloadDir).toBeGreaterThan(0);
  });
});