# 可灵链路修复与积分系统分离 — 设计文档

**日期：** 2026-04-15  
**状态：** 已批准，待实施

---

## 问题列表

| # | 问题 | 根因 |
|---|------|------|
| 1 | 可灵时长缺少 3s | `DURATION_OPTIONS` 写死从 4 开始 |
| 2 | 积分余额显示错误 | `SettingsPanel.syncBalance(d.totalCredit)` 把即梦账号积分覆盖进 `credits.balance`（VidClaw 字段），两套积分共用一个字段 |
| 3 | 确认框无即梦账号余额 | Store 无独立的即梦余额字段，确认框只展示 VidClaw 余额 |
| 4 | 可灵批量任务显示"待提交" | 批量确认提交后 `batchTasks` 未清空，`BatchQueueCard` 读到旧 `pending` 状态 |
| 5 | 无可灵并发限制 | 批量提交时全量并发，无排队机制 |

---

## Section A — 积分数据层分离

### 现状
`store.ts` 的 `credits.balance` 同时承担两个含义：
- VidClaw 平台积分（登录时 grant 99,999）
- 被 `SettingsPanel` 调 `syncBalance(d.totalCredit)` 覆盖成即梦账号积分

### 设计
新增独立字段到 `store.ts`（不在 `CreditsState` 内，单独放在顶层 store）：
```ts
jimengBalance: number;                        // 即梦账号余额缓存（默认 0）
setJimengBalance: (balance: number) => void;  // 写入缓存
```

- `credits.balance` 永远只代表 VidClaw 平台积分，不被即梦数据覆盖
- `syncBalance` 方法保留但**禁止在 SettingsPanel 调用**，改为调 `setJimengBalance`
- `jimengBalance` 不持久化到 localStorage（每次启动重新拉取）

---

## Section B — 启动时拉取即梦余额

`App.tsx` 的 `init()` 函数（登录态检测完成后）调一次：
```ts
window.api.checkCredits().then(result => {
  if (result.success) useStore.getState().setJimengBalance(result.credits);
});
```

这样确认框打开时即梦余额已有缓存值可展示，不需用户手动去 Settings 刷新。

---

## Section C — 确认框双余额展示

三张确认卡均改造（`ConfirmCard` / `BatchConfirmCard` / `KlingConfirmCard`）：

**可灵模式（ConfirmCard / BatchConfirmCard）：**
```
┌─────────────────────────────────────┐
│ ⚡ 本次消耗 50 积分                   │  VidClaw 行（已有，保留）
│ VidClaw 余额 99,949 · 即梦余额 2,381 │  新增余额行
└─────────────────────────────────────┘
```
余额不足时 VidClaw 行变红 + 禁用按钮（现有逻辑）。

**Seedance 模式（ConfirmCard / BatchConfirmCard）：**
仅展示即梦余额（VidClaw 积分不消耗，不展示消耗行）：
```
┌─────────────────────────────────────┐
│ 即梦余额 2,381 积分                  │
└─────────────────────────────────────┘
```

**KlingConfirmCard（专业模式）：**
已有积分消耗行，补充余额双行展示。

---

## Section D — 可灵时长 3-15s

`ConfirmCard` 和 `BatchConfirmCard`：
```ts
const durations = isKling
  ? [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]
  : [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
```

---

## Section E — 清空 batchTasks（修复"待提交"）

`handleConfirmBatch` Kling 分支的 `forEach` 结束后立即：
```ts
setBatchTasks([]);
```

可灵批量任务以独立 `QueueCard`（来自 `tasks` store）在 WorksPanel 展示，无需依赖 `BatchQueueCard`。

---

## Section F — 可灵并发控制（主进程）

在 `electron/main.js` 内嵌轻量队列，**不新建文件**：

```js
// 在 setupIpcHandlers() 顶部初始化
const klingQueue = [];     // { params, submitId, resolve }[]
let klingRunning = 0;
const KLING_MAX_CONCURRENT = 5;

function processKlingQueue(sendToRenderer) {
  while (klingRunning < KLING_MAX_CONCURRENT && klingQueue.length > 0) {
    klingRunning++;
    const { params, submitId, resolve } = klingQueue.shift();
    
    // 发送排队位数信息（如果任务曾等待）
    runKlingTask(params, submitId, sendToRenderer)
      .then(resolve)
      .finally(() => {
        klingRunning--;
        processKlingQueue(sendToRenderer);
      });
  }
}
```

`kling:generate` handler 改造：
1. 立即返回 `{ success: true, submitId }` 给渲染进程（不变）
2. 如果当前运行数 < 5，直接 `setImmediate` 执行（零延迟）
3. 如果已满，进入队列，并通过 `kling-progress` 事件告知渲染"排队中 第N位"

进度 / 结果 / 失败事件发送逻辑不变，只是执行时机由并发变为受控排队。

---

## 改动范围

| 文件 | 改动 |
|------|------|
| `src/store.ts` | 新增 `jimengBalance` + `setJimengBalance` |
| `src/App.tsx` | `init()` 调 `checkCredits()` 写 `jimengBalance` |
| `src/components/SettingsPanel.tsx` | `syncBalance` → `setJimengBalance` |
| `src/components/ChatPanel.tsx` | 确认框双余额；时长 3s；Kling 批量后 `setBatchTasks([])` |
| `electron/main.js` | klingQueue 并发控制 |

**不改动：** Seedance 链路、`BatchTaskManager`、`coze.js`

---

## 验收标准

1. 内部用户 VidClaw 余额稳定显示 99,999（减去消耗量），不被即梦积分覆盖
2. Settings 刷新积分后 `jimengBalance` 更新，VidClaw 余额不变
3. 确认框展示双余额行
4. 可灵时长选项含 3s
5. Kling 批量提交后 BatchQueueCard 不再显示"待提交"；个人 QueueCard 正常显示生成进度
6. 同时提交 6 个可灵任务：前 5 个立即开始，第 6 个等待，完成一个补一个
