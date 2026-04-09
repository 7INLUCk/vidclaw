# VidClaw 即梦账号管理功能开发需求

## 目标
在 VidClaw 设置页新增「即梦账号管理」区域，实现：
1. **积分余额展示** — 实时显示即梦账号的积分信息
2. **账号切换** — 支持多个即梦账号存储和切换
3. **UI 设计** — 遵循 impeccable 设计规范，不做成 AI slop

## 项目信息
- 路径：`/Users/yuchuyang/.openclaw/workspace-alex/projects/jimeng-desktop/`
- 技术栈：Electron + Vite + React 18 + Tailwind CSS v4 + Zustand
- 浏览器管理：Playwright（BrowserManager）
- 状态管理：Zustand（store.ts）
- 设计系统：`src/styles/` 有 CSS variables（--brand, --surface-0/1/2/3, --text-primary/muted/disabled, --border-subtle 等）

---

## 后端开发（electron/ 目录）

### 1. 新增 IPC 通道（electron/main.js）

```js
// 获取积分余额 — 通过 Playwright 请求即梦 API
ipcMain.handle('account:get-credits', async () => { ... });

// 获取账号列表 + 当前账号
ipcMain.handle('account:list', async () => { ... });

// 切换账号
ipcMain.handle('account:switch', async (_event, accountId) => { ... });

// 添加新账号（触发扫码登录流程）
ipcMain.handle('account:add', async () => { ... });

// 删除账号
ipcMain.handle('account:remove', async (_event, accountId) => { ... });

// 检查账号登录状态
ipcMain.handle('account:check-login', async (_event, accountId) => { ... });
```

### 2. 账号管理服务（新建 electron/services/account-manager.js）

核心职责：
- **账号存储**：JSON 文件持久化（`app.getPath('userData')/accounts.json`），存储格式：
  ```json
  {
    "accounts": [
      {
        "id": "acc_001",
        "nickname": "主账号",
        "avatarUrl": "",
        "sessionData": { "cookies": [...] },
        "addedAt": "2026-04-04T19:00:00Z"
      }
    ],
    "activeAccountId": "acc_001"
  }
  ```
- **积分查询**：通过 Playwright page.evaluate() 调用即梦 API
  - 端点：`/commerce/v1/benefits/user_credit`（已有 isCreditApi 识别）
  - 或参考 iptag/jimeng-api 的 GET `/api/token/check` 返回 giftCredit/purchaseCredit/vipCredit/totalCredit
  - 备选方案：直接 fetch `https://jimeng.jianying.com/commerce/v1/benefits/user_credit` 带 cookie
- **Cookie 管理**：每个账号存储独立 cookie，切换时替换 Playwright context 的 cookie
- **登录态检测**：请求 user_credit，如果 401/未授权则标记为过期

### 3. 更新 preload.js

新增暴露的 API：
```js
getAccountCredits: () => ipcRenderer.invoke('account:get-credits'),
listAccounts: () => ipcRenderer.invoke('account:list'),
switchAccount: (accountId) => ipcRenderer.invoke('account:switch', accountId),
addAccount: () => ipcRenderer.invoke('account:add'),
removeAccount: (accountId) => ipcRenderer.invoke('account:remove'),
checkAccountLogin: (accountId) => ipcRenderer.invoke('account:check-login', accountId),
```

### 4. 更新 BrowserManager（electron/services/browser.js）

- 支持多 context 或 cookie 注入方式切换账号
- 切换账号时：清除当前 cookie → 注入目标账号 cookie → 刷新页面
- 新增 `switchAccountCookies(cookies)` 方法

---

## 前端开发（src/ 目录）

### 1. 更新 store.ts

新增状态和类型：
```ts
export interface JimengAccount {
  id: string;
  nickname: string;
  avatarUrl: string;
  addedAt: number;
  isActive: boolean;
}

export interface JimengCredits {
  giftCredit: number;
  purchaseCredit: number;
  vipCredit: number;
  totalCredit: number;
  fetchedAt: number;
  error?: string;
}

// store 新增字段
accounts: JimengAccount[];
activeAccountId: string | null;
credits: JimengCredits | null;
creditsLoading: boolean;
accountsLoading: boolean;

// Actions
fetchCredits: () => Promise<void>;
fetchAccounts: () => Promise<void>;
switchAccount: (accountId: string) => Promise<void>;
addAccount: () => Promise<void>;
removeAccount: (accountId: string) => Promise<void>;
```

### 2. 重写 SettingsPanel.tsx 中的「即梦账号」section

**设计规范（impeccable）：**
- 不使用 AI slop 风格（不要 cyan-on-dark、不要 glow 按钮、不要渐变背景）
- 使用项目现有的 design tokens（--surface-0/1/2/3, --text-primary/muted/disabled, --border-subtle, --brand）
- 排版层次清晰：section 标题 > 卡片标题 > 数据值 > 辅助文字
- 使用 oklch 色彩，不使用 hex 灰色
- 微交互：hover 状态、loading skeleton、状态切换动画

**UI 结构：**

```
┌─────────────────────────────────────┐
│ 🎯 即梦账号                          │
│                                     │
│ ┌─── 积分余额卡片 ──────────────┐  │
│ │  总积分    赠送    购买    会员  │  │
│ │  1,234    900     0      334   │  │
│ │  ────────────────────────────  │  │
│ │  📅 每日赠送: 66积分            │  │
│ │  🔄 最后更新: 2分钟前           │  │
│ │                  [刷新]         │  │
│ └────────────────────────────────┘  │
│                                     │
│ ┌─── 账号列表 ──────────────────┐   │
│ │  ✅ 主账号                      │  │
│ │     cookie有效 · 当前使用中     │  │
│ │                                │  │
│ │  ○ 备用账号                    │  │
│ │     cookie过期 · 需重新登录     │  │
│ │     [重新登录]                  │  │
│ │                                │  │
│ │  [+ 添加新账号]                 │  │
│ └────────────────────────────────┘  │
└─────────────────────────────────────┘
```

**交互细节：**
- 积分卡片：四列（总积分/赠送/购买/会员），使用 trisect 布局类似现有用量统计
- 积分数值：大号等宽字体，颜色用 oklch 绿色系表示充足、橙色表示紧张
- 账号列表：每项左侧状态指示器（绿色圆点=有效，红色=过期）
- 当前激活账号高亮显示
- 切换账号：点击 → loading 状态 → 成功后刷新积分
- 添加账号：点击 → 提示弹窗说明"将打开浏览器扫码登录" → 调用 addAccount
- 删除账号：hover 显示删除按钮，二次确认
- 加载中：skeleton placeholder，不使用 spinner

### 3. 更新 global.d.ts（TypeScript 类型声明）

确保 `window.api` 上新增的方法有类型定义。

---

## 关键实现细节

### 积分查询实现方案
优先使用 Playwright page.evaluate() 直接 fetch 即梦 API：
```js
const result = await page.evaluate(async () => {
  const resp = await fetch('/commerce/v1/benefits/user_credit', {
    method: 'GET',
    credentials: 'include',
  });
  return resp.json();
});
```
这种方式利用了已登录 Playwright context 的 cookie，无需额外鉴权。

### 账号切换实现方案
1. 切换前：保存当前账号的 cookie（`context().cookies()`）
2. 清除所有 cookie（`context().clearCookies()`）
3. 注入目标账号的 cookie（`context().addCookies(cookies)`）
4. 导航到即梦首页刷新状态
5. 检查登录态

### 数据持久化
- 账号列表：`app.getPath('userData')/accounts.json`
- 与现有 settings.json 独立，不混在一起
- cookies 以 JSON 形式存储在 accounts.json 的 sessionData 字段

---

## 文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `electron/services/account-manager.js` | 新建 | 账号管理服务 |
| `electron/main.js` | 修改 | 添加 IPC handlers |
| `electron/preload.js` | 修改 | 暴露新 API |
| `src/store.ts` | 修改 | 添加账号/积分状态 |
| `src/components/SettingsPanel.tsx` | 重写账号 section | 积分展示 + 账号管理 |
| `src/global.d.ts` | 修改 | 添加类型声明 |

## 验证标准
1. 启动 VidClaw → 设置页 → 显示积分余额（数据来自即梦 API）
2. 点击刷新 → 积分更新
3. 账号列表显示所有已添加账号，当前账号高亮
4. 点击其他账号 → 切换成功 → 积分更新为该账号的数据
5. 点击添加新账号 → 浏览器打开 → 扫码登录 → 账号添加到列表
6. 过期账号显示红色状态 + 重新登录按钮
7. 删除账号需要二次确认
8. 所有交互有合适的 loading/空状态/错误状态
