# 可灵链路修复与积分系统分离 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复 5 个相互关联的 Kling 链路问题：积分字段混用、确认框双余额展示、时长 3s、批量"待提交"、Kling 并发控制。

**Architecture:** 在 store 新增独立的 `jimengBalance` 字段彻底隔离两套积分；三张确认卡统一展示双余额；主进程内嵌 `klingQueue` 实现最多 5 并发；`handleConfirmBatch` 提交后清空 `batchTasks` 防止状态残留。

**Tech Stack:** Electron + React + TypeScript + Zustand；改动集中在 `src/store.ts`、`src/App.tsx`、`src/components/SettingsPanel.tsx`、`src/components/ChatPanel.tsx`、`electron/main.js`。

---

## 文件结构

| 文件 | 改动 |
|------|------|
| `src/store.ts` | 新增 `jimengBalance: number` + `setJimengBalance` |
| `src/App.tsx` | `init()` 里调 `checkCredits()` 写 `jimengBalance` |
| `src/components/SettingsPanel.tsx` | `syncBalance` → `setJimengBalance` |
| `src/components/ChatPanel.tsx` | 确认框双余额；时长 3s；批量后清空 batchTasks |
| `electron/main.js` | klingQueue 并发控制 |

---

## Task 1: store.ts — 新增 jimengBalance 字段

**Files:**
- Modify: `src/store.ts`

- [ ] **Step 1: 在 interface 里的积分区域加字段**

在 `src/store.ts` 第 302 行（`syncBalance` 下方）插入：

```typescript
  // 即梦账号余额（缓存，不持久化）
  jimengBalance: number;
  setJimengBalance: (balance: number) => void;
```

完整区域变为：
```typescript
  // 鉴权 & 积分
  auth: AuthUser | null;
  credits: CreditsState;
  setAuth: (auth: AuthUser | null) => void;
  deductCredits: (amount: number, description: string) => boolean;
  addCredits: (amount: number, description: string) => void;
  syncBalance: (balance: number) => void;
  // 即梦账号余额（缓存，不持久化）
  jimengBalance: number;
  setJimengBalance: (balance: number) => void;
```

- [ ] **Step 2: 在初始状态里加初始值**

在 `src/store.ts` 的 `credits: (()...` 块之后（约第 437 行）加：
```typescript
  jimengBalance: 0,
```

- [ ] **Step 3: 在 actions 里实现 setJimengBalance**

在 `syncBalance` 实现（约第 528 行）之后加：
```typescript
  setJimengBalance: (balance) => set({ jimengBalance: balance }),
```

- [ ] **Step 4: 验证 TypeScript 编译无报错**

```bash
cd /Users/yuchuyang/.openclaw/workspace-alex/projects/jimeng-desktop
npx tsc --noEmit 2>&1 | head -30
```
Expected: 无新增 error（原有 pre-existing TS 错误可忽略）

- [ ] **Step 5: Commit**

```bash
git add src/store.ts
git commit -m "feat(store): 新增 jimengBalance 字段，彻底分离即梦账号积分与 VidClaw 积分"
```

---

## Task 2: SettingsPanel.tsx — 停止污染 VidClaw 余额

**Files:**
- Modify: `src/components/SettingsPanel.tsx:36`

- [ ] **Step 1: 把 syncBalance 调用改为 setJimengBalance**

找到 `src/components/SettingsPanel.tsx` 第 36 行：
```typescript
useStore.getState().syncBalance(d.totalCredit);
```
改为：
```typescript
useStore.getState().setJimengBalance(d.totalCredit);
```

- [ ] **Step 2: 验证 TypeScript 无报错**

```bash
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 3: Commit**

```bash
git add src/components/SettingsPanel.tsx
git commit -m "fix(settings): syncBalance 改为 setJimengBalance，防止即梦积分覆盖 VidClaw 余额"
```

---

## Task 3: App.tsx — 启动时拉取即梦余额

**Files:**
- Modify: `src/App.tsx` (init 函数，约第 200-208 行)

- [ ] **Step 1: 在 init() 的 setAppState('ready') 之前加余额拉取**

找到 `src/App.tsx` 的 `init()` 函数，在 `setAppState('ready')` 这行（约第 204 行）之前插入：

```typescript
      // 静默拉取即梦账号余额（不阻塞启动）
      window.api.checkCredits().then(result => {
        if (result.success && typeof result.credits === 'number') {
          useStore.getState().setJimengBalance(result.credits);
        }
      }).catch(() => { /* 静默失败，不阻塞启动 */ });
```

完整修改后区域：
```typescript
      } catch (err) {
        console.error('[Init] getBatchStatus failed:', err);
      }

      // 静默拉取即梦账号余额（不阻塞启动）
      window.api.checkCredits().then(result => {
        if (result.success && typeof result.credits === 'number') {
          useStore.getState().setJimengBalance(result.credits);
        }
      }).catch(() => { /* 静默失败，不阻塞启动 */ });

      setAppState('ready');
```

- [ ] **Step 2: 验证 TypeScript 无报错**

```bash
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat(app): 启动时静默拉取即梦账号余额到 jimengBalance"
```

---

## Task 4: ChatPanel.tsx — 可灵时长 3s + 批量后清空 batchTasks

**Files:**
- Modify: `src/components/ChatPanel.tsx`

### Part A: 时长加 3s

- [ ] **Step 1: 修改 ConfirmCard 的 durations**

找到 `ConfirmCard` 组件（约第 1138 行）：
```typescript
  const durations = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
```
改为：
```typescript
  const durations = isKling ? [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] : [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
```

- [ ] **Step 2: 修改 BatchConfirmCard 的 DURATION_OPTIONS**

找到 `BatchConfirmCard` 组件（约第 135 行）：
```typescript
  const DURATION_OPTIONS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
```
改为：
```typescript
  const DURATION_OPTIONS = isKling ? [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] : [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
```

### Part B: 批量提交后清空 batchTasks

- [ ] **Step 3: handleConfirmBatch Kling 分支加 setBatchTasks([])**

找到 `handleConfirmBatch` 函数（约第 2479 行），Kling 分支末尾：
```typescript
        setSubmitting(false);
        setStatusText('');
        setGuidedStep('logged-in-ready');
        return;
```
在 `setSubmitting(false)` 之前插入一行：
```typescript
        setBatchTasks([]);  // 清空确认状态，防止 BatchQueueCard 显示过期"待提交"
        setSubmitting(false);
        setStatusText('');
        setGuidedStep('logged-in-ready');
        return;
```

- [ ] **Step 4: 验证 TypeScript 无报错**

```bash
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 5: Commit**

```bash
git add src/components/ChatPanel.tsx
git commit -m "fix(chat): 可灵时长加 3s 选项；批量提交后清空 batchTasks 防止待提交残留"
```

---

## Task 5: ChatPanel.tsx — 确认框双余额展示

**Files:**
- Modify: `src/components/ChatPanel.tsx`

所有三张确认卡均需改造。

### Part A: KlingConfirmCard

- [ ] **Step 1: 读取 jimengBalance**

在 `KlingConfirmCard` 组件（约第 4102 行），将：
```typescript
  const { credits } = useStore();
  const canAfford = credits.balance >= data.cost;
```
改为：
```typescript
  const { credits, jimengBalance } = useStore();
  const canAfford = credits.balance >= data.cost;
```

- [ ] **Step 2: 在积分消耗行下方加即梦余额行**

找到积分显示区域（约第 4132-4142 行）：
```tsx
        {/* Credit cost */}
        <div className={`flex items-center justify-between px-3 py-2 rounded-lg ${canAfford ? 'bg-brand/10 border border-brand/20' : 'bg-error/10 border border-error/20'}`}>
          <div className="flex items-center gap-1.5">
            <Zap size={11} className={canAfford ? 'text-brand' : 'text-error'} />
            <span className={`text-[11px] font-medium ${canAfford ? 'text-brand' : 'text-error'}`}>
              消耗 {data.cost} 积分
            </span>
          </div>
          <span className={`text-[10px] ${canAfford ? 'text-text-muted' : 'text-error'}`}>
            余额 {credits.balance.toLocaleString()} {!canAfford && '· 不足'}
          </span>
        </div>
```
替换为：
```tsx
        {/* Credit cost */}
        <div className={`px-3 py-2 rounded-lg space-y-1.5 ${canAfford ? 'bg-brand/10 border border-brand/20' : 'bg-error/10 border border-error/20'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Zap size={11} className={canAfford ? 'text-brand' : 'text-error'} />
              <span className={`text-[11px] font-medium ${canAfford ? 'text-brand' : 'text-error'}`}>
                消耗 {data.cost} 积分
              </span>
            </div>
            <span className={`text-[10px] ${canAfford ? 'text-text-muted' : 'text-error'}`}>
              VidClaw 余额 {credits.balance.toLocaleString()} {!canAfford && '· 不足'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-text-disabled">即梦账号余额</span>
            <span className="text-[10px] text-text-muted">{jimengBalance.toLocaleString()} 积分</span>
          </div>
        </div>
```

### Part B: ConfirmCard（智能生成）

- [ ] **Step 3: 读取 jimengBalance**

在 `ConfirmCard` 组件（约第 1126 行），将：
```typescript
  const { credits } = useStore();
  const isKling = selectedModel === 'kling-o1';
```
改为：
```typescript
  const { credits, jimengBalance } = useStore();
  const isKling = selectedModel === 'kling-o1';
```

- [ ] **Step 4: 替换积分展示区（ConfirmCard 约第 1306-1319 行）**

找到：
```tsx
          {/* 可灵 O1 积分消耗（仅可灵模式显示）*/}
          {isKling && (
            <div className={`flex items-center justify-between px-3 py-2 rounded-lg mb-3 ${canAfford ? 'bg-brand/10 border border-brand/20' : 'bg-error/10 border border-error/20'}`}>
              <div className="flex items-center gap-1.5">
                <Zap size={11} className={canAfford ? 'text-brand' : 'text-error'} />
                <span className={`text-[11px] font-medium ${canAfford ? 'text-brand' : 'text-error'}`}>
                  消耗 {klingCost} 积分
                </span>
              </div>
              <span className={`text-[10px] ${canAfford ? 'text-text-muted' : 'text-error'}`}>
                余额 {credits.balance.toLocaleString()} {!canAfford && '· 不足'}
              </span>
            </div>
          )}
```
替换为：
```tsx
          {/* 积分信息行（可灵显示消耗+双余额，Seedance 仅显示即梦余额）*/}
          <div className={`px-3 py-2 rounded-lg mb-3 space-y-1.5 ${isKling ? (canAfford ? 'bg-brand/10 border border-brand/20' : 'bg-error/10 border border-error/20') : 'bg-surface-3 border border-border-subtle'}`}>
            {isKling && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Zap size={11} className={canAfford ? 'text-brand' : 'text-error'} />
                  <span className={`text-[11px] font-medium ${canAfford ? 'text-brand' : 'text-error'}`}>
                    消耗 {klingCost} 积分
                  </span>
                </div>
                <span className={`text-[10px] ${canAfford ? 'text-text-muted' : 'text-error'}`}>
                  VidClaw 余额 {credits.balance.toLocaleString()} {!canAfford && '· 不足'}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-text-disabled">即梦账号余额</span>
              <span className="text-[10px] text-text-muted">{jimengBalance.toLocaleString()} 积分</span>
            </div>
          </div>
```

### Part C: BatchConfirmCard（批量规划）

- [ ] **Step 5: 读取 jimengBalance（BatchConfirmCard 约第 144-148 行）**

将：
```typescript
  const [showParamEditor, setShowParamEditor] = useState(false);
  const { credits } = useStore();
  const klingTotalCost = isKling ? batchTasks.reduce((sum, t) => sum + (t.duration * 10), 0) : 0;
  const canAfford = !isKling || credits.balance >= klingTotalCost;
```
改为：
```typescript
  const [showParamEditor, setShowParamEditor] = useState(false);
  const { credits, jimengBalance } = useStore();
  const klingTotalCost = isKling ? batchTasks.reduce((sum, t) => sum + (t.duration * 10), 0) : 0;
  const canAfford = !isKling || credits.balance >= klingTotalCost;
```

- [ ] **Step 6: 替换积分展示区（BatchConfirmCard 约第 328-341 行）**

找到：
```tsx
        {/* 可灵 O1 积分消耗（仅可灵模式显示）*/}
        {isKling && (
          <div className={`flex items-center justify-between px-3 py-2 rounded-lg ${canAfford ? 'bg-brand/10 border border-brand/20' : 'bg-error/10 border border-error/20'}`}>
            <div className="flex items-center gap-1.5">
              <Zap size={11} className={canAfford ? 'text-brand' : 'text-error'} />
              <span className={`text-[11px] font-medium ${canAfford ? 'text-brand' : 'text-error'}`}>
                共 {batchTasks.length} 条 · 合计消耗 {klingTotalCost} 积分
              </span>
            </div>
            <span className={`text-[10px] ${canAfford ? 'text-text-muted' : 'text-error'}`}>
              余额 {credits.balance.toLocaleString()} {!canAfford && '· 不足'}
            </span>
          </div>
        )}
```
替换为：
```tsx
        {/* 积分信息（可灵显示消耗+双余额，Seedance 仅显示即梦余额）*/}
        <div className={`px-3 py-2 rounded-lg space-y-1.5 ${isKling ? (canAfford ? 'bg-brand/10 border border-brand/20' : 'bg-error/10 border border-error/20') : 'bg-surface-3 border border-border-subtle'}`}>
          {isKling && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Zap size={11} className={canAfford ? 'text-brand' : 'text-error'} />
                <span className={`text-[11px] font-medium ${canAfford ? 'text-brand' : 'text-error'}`}>
                  共 {batchTasks.length} 条 · 合计消耗 {klingTotalCost} 积分
                </span>
              </div>
              <span className={`text-[10px] ${canAfford ? 'text-text-muted' : 'text-error'}`}>
                VidClaw 余额 {credits.balance.toLocaleString()} {!canAfford && '· 不足'}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-text-disabled">即梦账号余额</span>
            <span className="text-[10px] text-text-muted">{jimengBalance.toLocaleString()} 积分</span>
          </div>
        </div>
```

- [ ] **Step 7: 验证 TypeScript 无报错**

```bash
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 8: Commit**

```bash
git add src/components/ChatPanel.tsx
git commit -m "feat(chat): 确认框展示 VidClaw + 即梦双余额；可灵时长加 3s；批量后清空 batchTasks"
```

---

## Task 6: electron/main.js — Kling 并发队列

**Files:**
- Modify: `electron/main.js`（约第 937-995 行，`kling:generate` handler 区域）

- [ ] **Step 1: 在 setupIpcHandlers 函数顶部加队列变量**

找到 `electron/main.js` 中 `function setupIpcHandlers` 的定义（或 `ipcMain.handle(` 第一次出现的上方），加：

```javascript
  // ── Kling 并发控制 ──────────────────────────────────────────────────
  const klingQueue = [];          // { params, submitId, taskFn }[]
  let klingRunning = 0;
  const KLING_MAX_CONCURRENT = 5;

  function drainKlingQueue() {
    while (klingRunning < KLING_MAX_CONCURRENT && klingQueue.length > 0) {
      klingRunning++;
      const { taskFn } = klingQueue.shift();
      taskFn().finally(() => {
        klingRunning--;
        drainKlingQueue();
      });
    }
  }
```

- [ ] **Step 2: 重写 kling:generate handler，加入队列逻辑**

找到当前 handler（约第 939 行）：
```javascript
  ipcMain.handle('kling:generate', (_event, { imagePaths, prompt, duration, aspectRatio, submitId: clientSubmitId }) => {
    const submitId = clientSubmitId || 'kling_' + Date.now();
    const downloadDir = path.join(settings.downloadDir || path.join(require('os').homedir(), 'Downloads', '即梦'), '可灵O1');

    function sendKlingProgress(stage, message, progress) {
      sendToRenderer('task:progress', {
        event: 'kling-progress',
        data: { submitId, stage, message, progress },
      });
    }

    // Fire-and-forget: start generation in background, return submitId immediately
    setImmediate(async () => {
      console.log('[Kling] 开始生成，图片数:', imagePaths?.length, '时长:', duration, '比例:', aspectRatio);
      sendKlingProgress('upload', `上传图片 (共 ${imagePaths.length} 张)...`, 5);
      let uploadedCount = 0;
      const totalImages = imagePaths.length;
      try {
        const result = await klingGenerate(
          { imagePaths, prompt, duration, aspectRatio, downloadDir },
          (msg) => {
            if (msg.includes('上传图片') || msg.includes('上传完成')) {
              uploadedCount++;
              const pct = 5 + Math.round((uploadedCount / totalImages) * 20);
              sendKlingProgress('upload', msg, Math.min(pct, 25));
            } else if (msg.includes('已提交') || msg.includes('等待生成')) {
              sendKlingProgress('submitted', msg, 30);
            } else if (msg.includes('下载')) {
              sendKlingProgress('downloading', msg, 90);
            } else {
              sendKlingProgress('generating', msg, 30);
            }
          }
        );
        if (result.success) {
          sendToRenderer('task:progress', {
            event: 'result',
            data: { submitId, status: 'completed', filePath: result.localPath || '', resultUrl: result.videoUrl, downloadDir, prompt },
          });
        } else {
          sendToRenderer('task:progress', {
            event: 'failed',
            data: { submitId, error: result.error },
          });
        }
      } catch (err) {
        console.error('[Kling] 生成异常:', err);
        sendToRenderer('task:progress', {
          event: 'failed',
          data: { submitId, error: err.message },
        });
      }
    });

    // Return immediately so renderer can unlock input right away
    return { success: true, submitId };
  });
```

替换为：
```javascript
  ipcMain.handle('kling:generate', (_event, { imagePaths, prompt, duration, aspectRatio, submitId: clientSubmitId }) => {
    const submitId = clientSubmitId || 'kling_' + Date.now();
    const downloadDir = path.join(settings.downloadDir || path.join(require('os').homedir(), 'Downloads', '即梦'), '可灵O1');

    function sendKlingProgress(stage, message, progress) {
      sendToRenderer('task:progress', {
        event: 'kling-progress',
        data: { submitId, stage, message, progress },
      });
    }

    async function runThisTask() {
      console.log('[Kling] 开始生成，图片数:', imagePaths?.length, '时长:', duration, '比例:', aspectRatio);
      sendKlingProgress('upload', `上传图片 (共 ${imagePaths.length} 张)...`, 5);
      let uploadedCount = 0;
      const totalImages = imagePaths.length;
      try {
        const result = await klingGenerate(
          { imagePaths, prompt, duration, aspectRatio, downloadDir },
          (msg) => {
            if (msg.includes('上传图片') || msg.includes('上传完成')) {
              uploadedCount++;
              const pct = 5 + Math.round((uploadedCount / totalImages) * 20);
              sendKlingProgress('upload', msg, Math.min(pct, 25));
            } else if (msg.includes('已提交') || msg.includes('等待生成')) {
              sendKlingProgress('submitted', msg, 30);
            } else if (msg.includes('下载')) {
              sendKlingProgress('downloading', msg, 90);
            } else {
              sendKlingProgress('generating', msg, 30);
            }
          }
        );
        if (result.success) {
          sendToRenderer('task:progress', {
            event: 'result',
            data: { submitId, status: 'completed', filePath: result.localPath || '', resultUrl: result.videoUrl, downloadDir, prompt },
          });
        } else {
          sendToRenderer('task:progress', {
            event: 'failed',
            data: { submitId, error: result.error },
          });
        }
      } catch (err) {
        console.error('[Kling] 生成异常:', err);
        sendToRenderer('task:progress', {
          event: 'failed',
          data: { submitId, error: err.message },
        });
      }
    }

    // 立即返回 submitId，任务进入并发队列
    const queuePos = klingQueue.length;
    if (klingRunning < KLING_MAX_CONCURRENT) {
      // 有空位：setImmediate 立即执行
      setImmediate(() => {
        klingRunning++;
        runThisTask().finally(() => {
          klingRunning--;
          drainKlingQueue();
        });
      });
    } else {
      // 队列已满：排队，并告知渲染进程排队位置
      klingQueue.push({ taskFn: runThisTask });
      sendKlingProgress('queued', `排队中，前方还有 ${queuePos} 个任务`, 0);
    }

    return { success: true, submitId };
  });
```

- [ ] **Step 3: 确认 drainKlingQueue 变量在 handler 闭包内可见**

`drainKlingQueue`、`klingQueue`、`klingRunning`、`KLING_MAX_CONCURRENT` 均在 Step 1 加入到与 `kling:generate` handler 同级的作用域，闭包可访问。检查方式：确保 Step 1 的代码块与 Step 2 的 handler 在同一个函数体（`setupIpcHandlers` 或模块顶层）内。

- [ ] **Step 4: 启动验证（语法检查）**

```bash
node --check electron/main.js 2>&1
```
Expected: 无 SyntaxError

- [ ] **Step 5: Commit**

```bash
git add electron/main.js
git commit -m "feat(main): Kling 并发队列控制（最多 5 并发），超限任务排队等待"
```

---

## Task 7: 集成验证 + 重启

- [ ] **Step 1: Kill 旧进程**

```bash
kill $(lsof -ti :5173,:5174,:5175,:5176,:5177 2>/dev/null) 2>/dev/null
pkill -9 -f "jimeng-desktop" 2>/dev/null
pkill -9 -f "electron" 2>/dev/null
sleep 1
lsof -ti :5173 2>/dev/null | wc -l
```
Expected: 输出 `0`

- [ ] **Step 2: 启动并检查日志**

```bash
npm run electron:dev > /tmp/vidclaw-dev.log 2>&1 &
sleep 8 && grep -E "(Local|port|Error|error|Kling|jimeng)" /tmp/vidclaw-dev.log | head -20
```
Expected: 包含 `Local: http://localhost:5173/`，无新 Error

- [ ] **Step 3: 验收清单（手动验证）**

1. 内部用户 VidClaw 余额固定显示 99,xxx（不被即梦积分覆盖）
2. Settings 页点"刷新"后 jimengBalance 更新，VidClaw 余额不变
3. 可灵模式确认框显示：消耗行 + VidClaw 余额 + 即梦余额（3 行）
4. Seedance 模式确认框显示：即梦余额（1 行）
5. 时长选项含 3s（可灵模式）
6. Kling 批量提交后 BatchQueueCard 消失，个人 QueueCard 正常显示生成进度
7. 同时提交 6 个可灵单任务：前 5 个立即显示进度，第 6 个显示"排队中"

- [ ] **Step 4: 更新 CLAUDE.md 和 memory**

在 `CLAUDE.md` 的 `## 已实现功能` 段加：
```markdown
### 积分系统分离（2026-04-15 完成）
- `credits.balance` 仅表示 VidClaw 平台积分，与即梦账号积分彻底隔离
- `jimengBalance`（store 字段）= 即梦账号余额缓存，启动时静默拉取
- SettingsPanel 刷新时只写 `jimengBalance`，不再调 `syncBalance`
- 三张确认卡均展示双余额（VidClaw + 即梦），Seedance 确认卡仅展示即梦余额
- Kling 并发上限 5，超限进队列，完成一个补一个（`klingQueue` 内嵌 main.js）
```

- [ ] **Step 5: 最终 commit + push**

```bash
git add CLAUDE.md
git commit -m "docs: 更新 CLAUDE.md — 积分分离 + Kling 并发控制"
git push origin main
```
