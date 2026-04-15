# 可灵模式统一设计文档

**日期：** 2026-04-15  
**状态：** 已批准，待实施

---

## 问题

用户选择「可灵 O1」模型后，系统完全绕过三种发送模式（智能生成 / 批量规划 / 专业模式），走一套独立的固定流程。导致可灵和 Seedance 的交互逻辑不一致。

**根因（代码层面）：**  
`handleSend()` 最顶部有一个短路判断：`if (selectedModel === 'kling-o1') → handleKlingSend()`，在检查 `sendMode` 之前就返回了，三种模式对可灵完全失效。

---

## 目标

让三种发送模式对可灵和 Seedance 均生效，交互逻辑完全一致。  
可灵唯一的特殊性：在确认环节额外展示**本产品积分消耗**（非即梦账号积分）。

---

## 设计

### 对齐基准

以 **Seedance 当前生效的链路**为基准，不参照可灵现有流程。  
Seedance 三种模式链路均已验证可用。

### 三种模式改后行为

| 模式 | Seedance（现状，基准）| 可灵（改后） |
|------|---------------------|------------|
| 智能生成 | 用户描述 → DeepSeek 改写 → `ai-rewrite` 确认卡 → 提交 Seedance | 用户描述 → DeepSeek 改写 → `ai-rewrite` 确认卡（底部加积分行）→ 提交可灵 |
| 批量规划 | 用户描述 → AI 拆解 → `batch-confirm` 卡 → 批量提交 Seedance | 用户描述 → AI 拆解 → `batch-confirm` 卡（底部加合计积分行）→ 批量提交可灵 |
| 专业模式 | 直接提交，无确认卡 | 弹出轻量确认卡（图片预览 + 提示词 + 积分消耗）→ 用户确认 → 提交可灵 |

### 积分展示规则

- 积分来源：`useStore().credits.balance`（本产品积分，非即梦账号）
- 单价：`selectedDuration × 10` 积分 / 条
- 智能生成确认卡：显示「本次消耗 XX 积分 · 余额 YYY」
- 批量规划确认卡：显示「共 N 条 · 合计消耗 XX 积分 · 余额 YYY」
- 积分不足时：显示红色警告，禁用确认按钮

### 图片校验

可灵必须上传图片。校验位置：每个 handler 最顶部，校验失败直接显示提示信息，不进入后续流程。  
校验失败不影响 Seedance 流程。

---

## 改动范围

**仅改 `src/components/ChatPanel.tsx`，共三处：**

1. **删除短路开关** — `handleSend()` 中删除 `if (kling-o1) → handleKlingSend()` 早返回
2. **确认卡加积分行** — `ai-rewrite` 卡和 `batch-confirm` 卡，当 `model === 'kling-o1'` 时底部渲染积分区域
3. **专业模式确认步** — `handleDirectSend()` 中，当 model 是 kling-o1 时改为弹出确认卡，而非直接提交

不改动：store、IPC、`electron/` 侧任何文件。

---

## 不做的事

- 不重构执行层（将来有第三个模型时再抽象）
- 不改 `KlingConfirmCard` 组件结构（用于专业模式确认卡复用）
- 不改 Seedance 任何现有逻辑

---

## 风险

- 低。改动集中在一个文件的三个位置，Seedance 链路完全不受影响。
- 需验证：可灵在智能生成和批量规划模式下，DeepSeek 改写后的提示词能正确传给 `klingGenerate` IPC。
