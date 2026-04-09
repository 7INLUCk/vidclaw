# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: launch.spec.ts >> app launches successfully
- Location: e2e/launch.spec.ts:3:5

# Error details

```
Error: electron.launch: Electron failed to install correctly, please delete node_modules/electron and try installing again
```

# Test source

```ts
  1  | import { test, expect, _electron as electron } from '@playwright/test';
  2  | 
  3  | test('app launches successfully', async () => {
> 4  |   const app = await electron.launch({ args: ['.'] });
     |               ^ Error: electron.launch: Electron failed to install correctly, please delete node_modules/electron and try installing again
  5  |   const window = await app.firstWindow();
  6  |   await expect(window).toBeTruthy();
  7  |   const title = await window.title();
  8  |   expect(title).toBeTruthy();
  9  |   await window.screenshot({ path: 'e2e/screenshots/launch.png' });
  10 |   await app.close();
  11 | });
```