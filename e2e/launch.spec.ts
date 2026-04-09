import { test, expect, _electron as electron } from '@playwright/test';

test('app launches successfully', async () => {
  const app = await electron.launch({ args: ['.'] });
  const window = await app.firstWindow();
  await expect(window).toBeTruthy();
  const title = await window.title();
  expect(title).toBeTruthy();
  await window.screenshot({ path: 'e2e/screenshots/launch.png' });
  await app.close();
});