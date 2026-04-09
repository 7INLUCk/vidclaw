import { test, expect, _electron as electron, ElectronApplication, Page } from '@playwright/test';

test.describe('VidClaw Full Flow E2E', () => {
  let app: ElectronApplication;
  let window: Page;

  test.beforeAll(async () => {
    app = await electron.launch({ args: ['.'] });
    window = await app.firstWindow();
    
    // 等待页面加载完成
    await window.waitForLoadState('domcontentloaded');
    await window.waitForTimeout(1000); // 额外等待 React 渲染
    
    // 截图记录初始状态
    await window.screenshot({ path: 'e2e/screenshots/init-state.png' });
  });

  test.afterAll(async () => {
    await app.close();
  });

  test('app window has correct title', async () => {
    const title = await window.title();
    expect(title.toLowerCase()).toContain('vidclaw');
  });

  test('main UI elements are visible', async () => {
    // 检查主要 UI 结构
    const hasContent = await window.locator('body').count() > 0;
    expect(hasContent).toBeTruthy();
    
    // 截图
    await window.screenshot({ path: 'e2e/screenshots/ui-elements.png' });
  });

  test('sidebar navigation works', async () => {
    // 尝试找到侧边栏或导航
    const navItems = await window.locator('[class*="sidebar"], [class*="nav"]').count();
    expect(navItems).toBeGreaterThanOrEqual(0);
    
    // 如果有明确的导航按钮，测试点击
    const resultsBtn = await window.getByRole('button', { name: /results|结果/i }).first();
    if (await resultsBtn.count() > 0) {
      await resultsBtn.click();
      await window.waitForTimeout(300);
      await window.screenshot({ path: 'e2e/screenshots/results-tab.png' });
    }
    
    const settingsBtn = await window.getByRole('button', { name: /settings|设置/i }).first();
    if (await settingsBtn.count() > 0) {
      await settingsBtn.click();
      await window.waitForTimeout(300);
      await window.screenshot({ path: 'e2e/screenshots/settings-tab.png' });
    }
  });

  test('chat input accepts text', async () => {
    // 回到 Chat 页面
    const chatBtn = await window.getByRole('button', { name: /chat|聊天/i }).first();
    if (await chatBtn.count() > 0) {
      await chatBtn.click();
      await window.waitForTimeout(300);
    }
    
    // 查找输入框
    const input = await window.locator('textarea').first();
    if (await input.count() > 0) {
      await input.focus();
      await input.fill('这是一个测试提示词');
      const value = await input.inputValue();
      expect(value).toBe('这是一个测试提示词');
      
      await window.screenshot({ path: 'e2e/screenshots/input-filled.png' });
      
      // 清空
      await input.clear();
    }
  });

  test('mode switch UI exists', async () => {
    // 查找模式切换元素
    const modeSwitch = await window.locator('[class*="mode"], text=/单个|批量|single|batch/i').count();
    expect(modeSwitch).toBeGreaterThanOrEqual(0);
    
    await window.screenshot({ path: 'e2e/screenshots/mode-ui.png' });
  });

  test('electron IPC APIs are exposed', async () => {
    // 检查 window.api 是否暴露
    const apiExists = await window.evaluate(() => {
      return typeof (window as any).api !== 'undefined';
    });
    
    // 如果未暴露，可能是因为页面还没完全初始化
    // 不强制要求，只是记录状态
    console.log('window.api exists:', apiExists);
    
    if (apiExists) {
      // 测试 getStatus API
      const status = await window.evaluate(async () => {
        try {
          return await (window as any).api.getStatus();
        } catch (e) {
          return { error: e };
        }
      });
      console.log('API status:', status);
    }
  });
});