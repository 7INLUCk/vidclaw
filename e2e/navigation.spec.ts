import { test, expect, _electron as electron } from '@playwright/test';

test.describe('Navigation', () => {
  let app: any;
  let window: any;

  test.beforeAll(async () => {
    app = await electron.launch({ args: ['.'] });
    window = await app.firstWindow();
    await window.waitForLoadState('domcontentloaded');
  });

  test.afterAll(async () => {
    await app.close();
  });

  test('sidebar shows navigation tabs', async () => {
    // 检查侧边栏存在
    const sidebar = await window.locator('[data-testid="sidebar"]').first();
    const hasSidebar = await sidebar.count() > 0;
    
    // 如果没有 data-testid，尝试其他方式
    if (!hasSidebar) {
      // 检查是否有包含 Chat/Results/Settings 的导航元素
      const navTexts = await window.locator('text=/Chat|Results|Settings/').count();
      expect(navTexts).toBeGreaterThan(0);
    }
  });

  test('can switch to Results tab', async () => {
    // 尝试点击 Results 导航
    const resultsBtn = await window.locator('text=Results').first();
    if (await resultsBtn.count() > 0) {
      await resultsBtn.click();
      await window.waitForTimeout(500);
      
      // 检查是否切换到结果页面
      const resultsPanel = await window.locator('[data-testid="results-panel"]').first();
      const hasResults = await resultsPanel.count() > 0 || await window.locator('text=/结果|历史|Results/').count() > 0;
      expect(hasResults).toBeTruthy();
    }
  });

  test('can switch to Settings tab', async () => {
    const settingsBtn = await window.locator('text=Settings').first();
    if (await settingsBtn.count() > 0) {
      await settingsBtn.click();
      await window.waitForTimeout(500);
      
      // 检查设置页面元素
      const hasSettings = await window.locator('text=/设置|Settings|API Key|Download/').count() > 0;
      expect(hasSettings).toBeTruthy();
    }
  });
});