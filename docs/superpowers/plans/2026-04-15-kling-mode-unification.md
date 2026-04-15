# 可灵模式统一 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让三种发送模式（智能生成 / 批量规划 / 专业模式）对可灵 O1 和 Seedance 均生效，交互逻辑完全对齐，仅在确认卡片增加积分信息。

**Architecture:** 删除 `handleSend()` 中的可灵短路返回，让模式系统正常路由。在各执行节点（`handleConfirmTask` / `handleConfirmBatch` / `handleDirectSend`）按 `selectedModel === 'kling-o1'` 分叉到正确 API。确认卡片在可灵模式下额外显示本产品积分消耗。

**Tech Stack:** React, TypeScript, Zustand (`credits`, `deductCredits` 已在 ChatPanel 解构)

---

## 改动文件

- **Modify:** `src/components/ChatPanel.tsx`（唯一改动文件）
  - Line 1753–1757: 删除可灵短路
  - Line 1759: 在 `if (!input.trim())` 前加图片校验
  - Line 1107: `ConfirmCard` 组件加积分行
  - Line 125: `BatchConfirmCard` 组件加积分行
  - Line 2005: `handleDirectSend()` 加可灵分支
  - Line 2101: `handleConfirmTask()` 加可灵执行分支
  - Line 2249: `handleConfirmBatch()` 加可灵执行分支

---

### Task 1: 删除可灵短路，加图片校验

**Files:**
- Modify: `src/components/ChatPanel.tsx:1753-1768`

- [ ] **Step 1: 删除短路，加图片校验**

将 `handleSend()` 里 lines 1753–1768 替换为：

```typescript
    // Kling O1: 必须上传图片
    if (selectedModel === 'kling-o1') {
      const imageFiles = selectedFiles.filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));
      if (imageFiles.length === 0) {
        addMessage({
          id: Date.now().toString() + '_kling_noimgs',
          role: 'assistant',
          content: '⚠️ 可灵 O1 是图生视频模型，请先上传至少一张图片（支持 jpg/png/webp）',
          timestamp: new Date(),
          type: 'error',
        });
        return;
      }
    }

    if (!input.trim() && selectedModel !== 'kling-o1') return;

    if (sendMode === 'ai-batch') {
      await handleBatchSend();
      return;
    }
    if (sendMode === 'direct') {
      await handleDirectSend();
      return;
    }
```

> 注意：`if (!input.trim())` 条件加了 `&& selectedModel !== 'kling-o1'`，因为可灵专业模式允许不填提示词（只上传图片也可以）。

- [ ] **Step 2: 启动应用，测试图片校验**

在界面选可灵模型、不上传图片、点发送，应弹出提示"⚠️ 可灵 O1 是图生视频模型..."。

- [ ] **Step 3: commit**

```bash
git add src/components/ChatPanel.tsx
git commit -m "refactor: remove Kling sendMode bypass, add image guard in handleSend"
```

---

### Task 2: 专业模式下可灵显示确认卡

**Files:**
- Modify: `src/components/ChatPanel.tsx:2005` (`handleDirectSend`)

- [ ] **Step 1: 在 handleDirectSend() 顶部加可灵分支**

在 `async function handleDirectSend()` 的第一行后面（`const prompt = input.trim();` 之后）插入：

```typescript
    // 专业模式 + 可灵：弹出确认卡（需积分确认），不直接提交
    if (selectedModel === 'kling-o1') {
      const imageFiles = selectedFiles.filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));
      const cost = selectedDuration * 10;
      const userMsg: Message = {
        id: Date.now().toString(),
        role: 'user',
        content: prompt || '（未输入提示词）',
        timestamp: new Date(),
        data: { materials: imageFiles.map((f, i) => ({ type: 'image', name: `图片${i + 1}`, path: f })) },
      };
      addMessage(userMsg);
      addMessage({
        id: Date.now().toString() + '_kling_confirm',
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        type: 'kling-confirm',
        data: { prompt, imagePaths: imageFiles, duration: selectedDuration, aspectRatio: selectedRatio, cost },
      });
      setInput('');
      return;
    }
```

- [ ] **Step 2: 测试专业模式 + 可灵**

选「专业模式」+ 「可灵 O1」，上传图片，输入提示词，点发送。
预期：弹出现有的可灵确认卡（图片预览 + 积分消耗），点确认后任务进入排队。

- [ ] **Step 3: commit**

```bash
git add src/components/ChatPanel.tsx
git commit -m "feat: Kling direct mode shows confirm card instead of immediate submit"
```

---

### Task 3: 智能生成模式下可灵走 Seedance 链路 + 执行时路由到 klingGenerate

**Files:**
- Modify: `src/components/ChatPanel.tsx:2101` (`handleConfirmTask`)

- [ ] **Step 1: 在 handleConfirmTask() 的执行段加可灵分支**

在 `handleConfirmTask()` 的 `try {` 块内，`if (hasFiles) {` 之前插入：

```typescript
      // 可灵 O1 执行路径
      if (selectedModel === 'kling-o1') {
        const imagePaths = filesToSubmit.filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));
        const cost = selectedDuration * 10;
        if (credits.balance < cost) {
          addMessage({
            id: Date.now().toString() + '_credits_low',
            role: 'assistant',
            content: `❌ 积分不足。需要 ${cost} 积分，当前余额 ${credits.balance}`,
            timestamp: new Date(),
            type: 'error',
          });
          setPendingTask(null);
          setSubmitting(false);
          setStatusText('');
          setGuidedStep('logged-in-ready');
          return;
        }
        deductCredits(cost, `可灵 O1 · ${selectedDuration}s 视频`);
        const submitId = 'kling_' + Date.now();
        addTask({
          id: 'task_' + Date.now(),
          submitId,
          prompt: effectiveTask.prompt,
          type: 'video',
          status: 'generating',
          progress: 0,
          statusMessage: '准备中...',
          model: 'kling-o1',
          duration: selectedDuration,
          materials: imagePaths.map(p => ({ path: p, type: 'image' as const })),
          createdAt: Date.now(),
          retryCount: 0,
        });
        void window.api.klingGenerate({ imagePaths, prompt: effectiveTask.prompt, duration: selectedDuration, aspectRatio: selectedRatio, submitId });
        setSelectedFiles([]);
        setInput('');
        showQueueToast('✅ 已加入队列，前往排队区查看进度');
        setPendingTask(null);
        setSubmitting(false);
        setStatusText('');
        setGuidedStep('logged-in-ready');
        return;
      }
```

- [ ] **Step 2: 测试智能生成 + 可灵完整链路**

选「智能生成」+「可灵 O1」，上传图片，输入描述，点发送。
预期：AI 改写提示词 → 弹出 `ai-rewrite` 确认卡 → 点确认 → 任务进入排队区（status: generating）。

- [ ] **Step 3: commit**

```bash
git add src/components/ChatPanel.tsx
git commit -m "feat: route Kling through ai-rewrite flow, execute via klingGenerate in handleConfirmTask"
```

---

### Task 4: 批量规划模式下可灵执行路由

**Files:**
- Modify: `src/components/ChatPanel.tsx:2249` (`handleConfirmBatch`)

- [ ] **Step 1: 在 handleConfirmBatch() 的 try {} 块内加可灵分支**

在 `try {` 之后，`const batch = {` 之前插入：

```typescript
      // 可灵 O1 批量执行路径：逐条调用 klingGenerate
      if (liveTasks[0]?.model === 'kling-o1') {
        const imagePaths = (liveTasks[0]?.materials ?? [])
          .filter(m => m.type === 'image')
          .map(m => m.path);
        if (imagePaths.length === 0) {
          addMessage({
            id: Date.now().toString() + '_kling_noimgs',
            role: 'assistant',
            content: '❌ 可灵 O1 批量任务需要上传参考图片',
            timestamp: new Date(),
            type: 'error',
          });
          setSubmitting(false);
          setStatusText('');
          setGuidedStep('logged-in-ready');
          return;
        }
        const totalCost = liveTasks.reduce((sum, t) => sum + (t.duration * 10), 0);
        if (credits.balance < totalCost) {
          addMessage({
            id: Date.now().toString() + '_credits_low',
            role: 'assistant',
            content: `❌ 积分不足。${liveTasks.length} 条任务共需 ${totalCost} 积分，当前余额 ${credits.balance}`,
            timestamp: new Date(),
            type: 'error',
          });
          setSubmitting(false);
          setStatusText('');
          setGuidedStep('logged-in-ready');
          return;
        }
        deductCredits(totalCost, `可灵 O1 · ${liveTasks.length} 个批量任务`);
        liveTasks.forEach((t, i) => {
          const submitId = 'kling_batch_' + Date.now() + '_' + i;
          addTask({
            id: 'task_' + Date.now() + '_' + i,
            submitId,
            prompt: t.prompt,
            type: 'video',
            status: 'generating',
            progress: 0,
            statusMessage: '准备中...',
            model: 'kling-o1',
            duration: t.duration,
            materials: imagePaths.map(p => ({ path: p, type: 'image' as const })),
            createdAt: Date.now() + i,
            retryCount: 0,
          });
          void window.api.klingGenerate({ imagePaths, prompt: t.prompt, duration: t.duration, aspectRatio: t.aspectRatio, submitId });
        });
        addMessage({
          id: Date.now().toString() + '_kling_batch_started',
          role: 'assistant',
          content: `🚀 可灵批量任务已启动！共 ${liveTasks.length} 个任务，消耗 ${totalCost} 积分。可在作品页查看进度。`,
          timestamp: new Date(),
        });
        setSubmitting(false);
        setStatusText('');
        setGuidedStep('logged-in-ready');
        return;
      }
```

- [ ] **Step 2: 测试批量规划 + 可灵**

选「批量规划」+「可灵 O1」，上传图片，输入批量描述，点发送。
预期：AI 拆解任务 → `batch-confirm` 卡 → 确认 → 多条任务同时进入排队区。

- [ ] **Step 3: commit**

```bash
git add src/components/ChatPanel.tsx
git commit -m "feat: Kling batch mode submits each task via klingGenerate individually"
```

---

### Task 5: ConfirmCard（智能生成确认卡）加积分行

**Files:**
- Modify: `src/components/ChatPanel.tsx:1107` (`ConfirmCard` 组件)

- [ ] **Step 1: ConfirmCard 内读取积分，在按钮区上方插入积分行**

在 `ConfirmCard` 组件内，`const setPreviewUrl = useStore(s => s.setPreviewUrl);` 之后加：

```typescript
  const { credits } = useStore();
  const isKling = selectedModel === 'kling-o1';
  const klingCost = isKling ? (selectedDuration ?? 5) * 10 : 0;
  const canAfford = !isKling || credits.balance >= klingCost;
```

然后在 `ConfirmCard` 的按钮行（`<div className="flex items-center gap-2 flex-wrap">`）之前插入积分行：

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

同时在确认按钮上加 `disabled={!canAfford}` 和样式 `disabled:opacity-40 disabled:cursor-not-allowed`：

```tsx
            <button
              onClick={() => onConfirm(isEditingPrompt ? editedPrompt : undefined)}
              disabled={!canAfford}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg transition-all duration-150 bg-brand hover:bg-brand/90 disabled:opacity-40 disabled:cursor-not-allowed text-white hover:-translate-y-0.5"
            >
```

- [ ] **Step 2: 测试智能生成 + 可灵确认卡积分显示**

选「智能生成」+「可灵 O1」，上传图片，触发 AI 改写，确认卡底部应显示积分消耗行。
余额充足时显示品牌色，不足时显示红色且确认按钮禁用。

> **注意：积分来自 `credits.balance`（本产品积分），不是即梦账号积分。**

- [ ] **Step 3: commit**

```bash
git add src/components/ChatPanel.tsx
git commit -m "feat: show Kling credit cost in ConfirmCard (ai-rewrite) with balance guard"
```

---

### Task 6: BatchConfirmCard（批量确认卡）加积分行

**Files:**
- Modify: `src/components/ChatPanel.tsx:125` (`BatchConfirmCard` 组件)

- [ ] **Step 1: BatchConfirmCard 内读取积分，在底部确认按钮上方加积分行**

在 `BatchConfirmCard` 中，`const [showParamEditor, setShowParamEditor] = useState(false);` 之后加：

```typescript
  const { credits } = useStore();
  const isKling = sharedModel === 'kling-o1';
  const klingTotalCost = isKling ? batchTasks.reduce((sum, t) => sum + (t.duration * 10), 0) : 0;
  const canAfford = !isKling || credits.balance >= klingTotalCost;
```

然后找到 `BatchConfirmCard` 的确认按钮（`onConfirm`），在其上方插入积分行：

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

确认按钮加 `disabled={hasEmptyPrompts || !canAfford}`：

```tsx
              <button
                onClick={onConfirm}
                disabled={hasEmptyPrompts || !canAfford}
                className="flex-1 py-2 bg-brand hover:bg-brand/90 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-medium rounded-lg transition-all"
              >
                确认并开始生成
              </button>
```

- [ ] **Step 2: 确认 `Zap` 图标已导入**

```bash
grep "Zap" src/components/ChatPanel.tsx | head -3
```

`Zap` 已在 line 1 的 import 中，无需修改。

- [ ] **Step 3: 测试批量规划 + 可灵确认卡积分显示**

选「批量规划」+「可灵 O1」，触发批量规划，`batch-confirm` 卡底部显示合计积分消耗行。
余额不足时红色警告，确认按钮禁用。

> **注意：积分来自 `credits.balance`（本产品积分），不是即梦账号积分。**

- [ ] **Step 4: commit**

```bash
git add src/components/ChatPanel.tsx
git commit -m "feat: show Kling total credit cost in BatchConfirmCard with balance guard"
```

---

### Task 7: 最终验证 + push

- [ ] **Step 1: TypeScript 类型检查**

```bash
npx tsc --noEmit 2>&1 | grep -v "ClarificationCard\|MessageBubble\|renderer/App\|ChatPanel.tsx:1784\|ChatPanel.tsx:1787\|ChatPanel.tsx:1790\|ChatPanel.tsx:1913\|ChatPanel.tsx:1916\|ChatPanel.tsx:1919"
```

预期：只有 pre-existing 错误，无新增错误。

- [ ] **Step 2: 三种模式完整验证**

| 测试场景 | 预期结果 |
|----------|---------|
| 智能生成 + 可灵 + 有图片 | AI 改写 → 确认卡（有积分行）→ 提交到排队 |
| 批量规划 + 可灵 + 有图片 | AI 规划 → 批量确认卡（有合计积分行）→ 多任务进排队 |
| 专业模式 + 可灵 + 有图片 | 弹出可灵确认卡 → 确认 → 进排队 |
| 任何模式 + 可灵 + 无图片 | 提示"请先上传图片" |
| 智能生成 + Seedance | 完全不变 |
| 批量规划 + Seedance | 完全不变 |
| 专业模式 + Seedance | 完全不变 |

- [ ] **Step 3: push**

```bash
git push origin main
```

- [ ] **Step 4: 更新 CLAUDE.md**

在 CLAUDE.md 的「已实现功能」章节补充：可灵模式已统一走三种发送模式，确认卡显示本产品积分消耗。

---

## 自检

- ✅ Spec 覆盖：3 处改动（短路删除 / 执行路由 / 积分显示）全部有对应任务
- ✅ 无 placeholder：所有步骤有完整代码
- ✅ 类型一致：`credits`, `deductCredits` 在 line 1514 已解构，直接可用
- ✅ 积分来源：全部使用 `credits.balance`（本产品积分），无误
- ✅ Seedance 链路：完全不触碰，零风险
