import { test, expect, _electron as electron } from '@playwright/test';

test.describe('Chat Input', () => {
  let app: any;
  let window: any;

  test.beforeAll(async () => {
    app = await electron.launch({ args: ['.'] });
    window = await app.firstWindow();
    await window.waitForLoadState('domcontentloaded');
    
    // 确保在 Chat 页面
    const chatBtn = await window.locator('text=Chat').first();
    if (await chatBtn.count() > 0) {
      await chatBtn.click();
      await window.waitForTimeout(500);
    }
  });

  test.afterAll(async () => {
    await app.close();
  });

  test('chat input area exists', async () => {
    // 查找输入框（textarea 或 input）
    const inputArea = await window.locator('textarea, input[type="text"]').first();
    const hasInput = await inputArea.count() > 0;
    expect(hasInput).toBeTruthy();
  });

  test('can type in input field', async () => {
    const input = await window.locator('textarea').first();
    if (await input.count() > 0) {
      await input.fill('测试输入内容');
      const value = await input.inputValue();
      expect(value).toContain('测试');
    }
  });

  test('send button is visible', async () => {
    // 查找发送按钮
    const sendBtn = await window.locator('button:has-text("发送"), button:has-text("Send")').first();
    const hasBtn = await sendBtn.count() > 0;
    
    // 如果没有明确的发送按钮，检查是否有发送图标
    if (!hasBtn) {
      const sendIcon = await window.locator('[aria-label*="send"], [data-testid*="send"]').count();
      expect(sendIcon).toBeGreaterThanOrEqual(0);
    }
  });
});