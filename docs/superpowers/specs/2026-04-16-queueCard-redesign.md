# 排队卡片全面重设计 — Design Spec

**日期：** 2026-04-16  
**状态：** 已审批

---

## 目标

重设计生成队列区的 `QueueCard`（单任务）和 `BatchQueueCard`（批量任务），解决以下问题：
1. 卡片太小、信息太少，用户无法理解当前任务状态
2. 单任务 / 批量任务视觉无区分
3. 批量任务并发状态（运行中 N / 等待中 M）不可见
4. 提示词 / 参数 / 素材无完整展示入口
5. 状态流转不清晰

新增 `QueueDetailDrawer` 右侧抽屉，承载完整详情。

---

## 受影响文件

| 文件 | 操作 |
|------|------|
| `src/components/WorksPanel.tsx` | 修改 `QueueCard`、`BatchQueueCard` 组件 |
| `src/components/QueueDetailDrawer.tsx` | **新建**，详情抽屉组件 |

---

## 设计详情

### 一、QueueCard（单任务）

#### 1.1 尺寸

去掉 `max-w-[320px]`，改为 `max-w-[400px]`，给内容更多横向空间。

#### 1.2 整体 JSX 结构

```
┌──────────────────────────────────────────┐
│ [●] 状态标签          [模型] [时长]      │  状态行
├──────────────────────────────────────────┤
│ prompt 文字（3 行 clamp）                │
│ [素材缩略图] （有素材时显示）            │
├──────────────────────────────────────────┤
│ 提交中 ──●── 平台排队 ── 生成中 ── 完成  │  4 步状态管道
├──────────────────────────────────────────┤
│ [进度条]                          50%    │
│ 状态补充文字（队列位置 / 生成进度）      │
├──────────────────────────────────────────┤
│                                  详情 ›  │
└──────────────────────────────────────────┘
```

#### 1.3 4 步状态管道

| 步骤 | 标签 | 触发条件 |
|------|------|---------|
| 1 | 提交中 | `status === 'pending' \| 'uploading'`；或 Kling `status === 'generating' && progress === 0` |
| 2 | 平台排队 | `status === 'queued'`（Seedance）；或 Kling `status === 'queued'`（kling-progress stage=queued） |
| 3 | 生成中 | `status === 'generating' && (progress ?? 0) > 0`（Seedance/Kling 均适用） |
| 4 | 已完成 / 下载中 | `status === 'completed' \| 'downloaded'` |

步骤判断函数（供实现参考）：
```tsx
function getQueueStep(task: TaskRecord): 1 | 2 | 3 | 4 {
  if (task.status === 'completed' || task.status === 'downloaded') return 4;
  if (task.status === 'generating' && (task.progress ?? 0) > 0) return 3;
  if (task.status === 'queued') return 2;
  return 1; // pending / uploading / kling initial generating(progress=0)
}
```

第 4 步标签：
```tsx
const lastStepLabel = settings.autoDownload ? '下载中' : '已完成';
```

当前激活步骤高亮（`bg-brand` 圆点），已过步骤用 `bg-success` 实线，未到步骤用 `bg-surface-3` 虚线。

#### 1.4 状态补充文字

```tsx
// Seedance 排队
status === 'queued' && task.queueStatus === 'Queuing':
  → `队列第 ${task.queuePosition + 1} 位 / 共 ${task.queueLength} 位`

// Kling 内部并发排队
status === 'queued' && task.model === 'kling-o1':
  → `内部队列第 ${task.queuePosition} 位`

// 生成中带进度
status === 'generating':
  → task.statusMessage || '正在生成中…'
```

#### 1.5 素材缩略图

`task.materials` 长度 > 0 时，在 prompt 下方渲染，每个 `w-10 h-10 rounded-md object-cover`，最多显示 4 个，超出显示 `+N`。

#### 1.6 详情按钮

```tsx
<button onClick={() => onOpenDrawer(task)}>
  详情 ›
</button>
```

---

### 二、BatchQueueCard（批量任务）

#### 2.1 尺寸

同 QueueCard，`max-w-[400px]`。

#### 2.2 整体 JSX 结构

```
┌──────────────────────────────────────────────┐
│ 批量任务名称            [模型] [时长] [比例]  │  批次头部
├──────────────────────────────────────────────┤
│ ▶ 运行中 3   ◌ 等待中 5   ✓ 完成 2   ✗ 失败 0│  并发状态行
├──────────────────────────────────────────────┤
│ [● 生成中] prompt 截断…                      │  子任务列表
│ [● 生成中] prompt 截断…                      │  最多 3 条
│ [◌ 等待中] prompt 截断…                      │  优先运行中
│                                    + 7 条    │  超出折叠
├──────────────────────────────────────────────┤
│ 整体进度 [████░░░░░░░]  2 / 10               │
│                                     详情 ›   │
└──────────────────────────────────────────────┘
```

#### 2.3 并发状态计算

```tsx
const running  = batchTasks.filter(t => t.status === 'generating' || t.status === 'submitted').length;
const waiting  = batchTasks.filter(t => t.status === 'pending').length;
const done     = batchTasks.filter(t => t.status === 'completed' || t.status === 'downloaded').length;
const failed   = batchTasks.filter(t => t.status === 'failed').length;
const total    = batchTasks.length;
```

失败数量 > 0 时才渲染 `✗ 失败 N`，否则不显示。

#### 2.4 子任务列表

展示优先级：运行中 > 等待中，最多 3 条，超出显示 `+ N 条`。
每条：`[状态圆点] prompt（单行 truncate）`

#### 2.5 整体进度条

```tsx
const progress = total > 0 ? (done / total) * 100 : 0;
```

#### 2.6 详情按钮

```tsx
<button onClick={() => onOpenBatchDrawer()}>
  详情 ›
</button>
```

---

### 三、QueueDetailDrawer

#### 3.1 新建文件

`src/components/QueueDetailDrawer.tsx`

#### 3.2 Props

```tsx
interface QueueDetailDrawerProps {
  open: boolean;
  onClose: () => void;
  // 单任务
  task?: TaskRecord;
  // 批量任务
  batchTasks?: BatchTaskItem[];
  batchInfo?: BatchInfo | null;
}
```

#### 3.3 容器与动画

```tsx
<div className={`fixed top-0 right-0 h-full w-[360px] z-50 bg-surface-1 border-l border-border
  transition-transform duration-300 ${open ? 'translate-x-0' : 'translate-x-full'}`}>
```

背后加半透明遮罩 `<div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />`，点击遮罩关闭。

#### 3.4 单任务抽屉内容

```
标题行：单条任务  [● 状态标签]  [✕]
─────────────────────────────────────
完整提示词（无截断，自然换行）
─────────────────────────────────────
参数
  模型：Kling O1 / Seedance 2.0
  时长：5s
  比例：9:16
─────────────────────────────────────
素材（点击放大预览）
  [80px 缩略图]  [80px 缩略图]
─────────────────────────────────────
状态记录（本地时间戳，useRef 存储）
  14:02  提交中
  14:02  已提交至平台
  14:03  排队中（第 3 位）
  14:05● 生成中
```

#### 3.5 批量任务抽屉内容

```
标题行：批量任务 · N 条  [运行中]  [✕]
─────────────────────────────────────
共用参数
  模型 · 时长 · 比例
  素材：[缩略图]
─────────────────────────────────────
全部任务（可滚动，每条一行）
  1  [● 生成中]  完整 prompt
  2  [● 生成中]  完整 prompt
  3  [◌ 等待]   完整 prompt
  …
```

#### 3.6 状态记录实现

在 `QueueDetailDrawer` 内部用 `useRef<StatusLog[]>` 记录，每次 `task.status` 变化时 push 一条：

```tsx
const logsRef = useRef<{ time: string; label: string }[]>([]);
// useEffect 监听 task.status / task.queueStatus 变化，push 新条目
```

不持久化，关闭抽屉再开清空（或保留至任务完成）。

#### 3.7 素材预览

图片：调用 `window.api.openFile(path)` 或复用 `setPreviewImg`（WorksPanel 已有）。
视频：复用 `setPreviewUrl` → `VideoModal`。

---

### 四、WorksPanel 集成

#### 4.1 抽屉状态

在 `WorksPanel` 组件顶层增加：

```tsx
const [drawerOpen, setDrawerOpen] = useState(false);
const [drawerTask, setDrawerTask] = useState<TaskRecord | null>(null);
const [drawerIsBatch, setDrawerIsBatch] = useState(false);
```

#### 4.2 QueueCard / BatchQueueCard 新增 prop

```tsx
// QueueCard
onOpenDrawer: (task: TaskRecord) => void;

// BatchQueueCard
onOpenDrawer: () => void;
```

#### 4.3 渲染抽屉

```tsx
<QueueDetailDrawer
  open={drawerOpen}
  onClose={() => setDrawerOpen(false)}
  task={drawerIsBatch ? undefined : drawerTask ?? undefined}
  batchTasks={drawerIsBatch ? batchTasks : undefined}
  batchInfo={drawerIsBatch ? batchInfo : undefined}
/>
```

---

## 不改动的部分

- 队列区父容器结构（`overflow-y-auto` 滚动）
- `QueueCard` 的 props 类型（仅新增 `onOpenDrawer`）
- `BatchQueueCard` 读取 store 的方式（`useStore()` 直接读 `batchTasks` / `batchInfo`）
- 终止任务功能：**不实现**（CLI/API 均不支持单任务终止，且提交后已计费）

---

## 边界情况

- `batchTasks` 为空时 `BatchQueueCard` 不渲染（现有逻辑不变）
- `task.materials` 为空时不渲染素材区
- 状态记录 `useRef` 在组件卸载后自动清空，无内存泄漏风险
- 抽屉打开时切换任务（单→批）：重置 `drawerTask` / `drawerIsBatch` 再设 `drawerOpen = true`
- `task.queuePosition` 为 `undefined` 时不渲染队列位置文字
