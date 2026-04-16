# WorksPanel 卡片视觉优化 — Design Spec

**日期：** 2026-04-16  
**状态：** 已审批

---

## 目标

修复作品网格区三个已知视觉问题：
1. 成功单任务卡底部出现空白黑区（CSS Grid stretch 行为）
2. 缩略图全部使用 16:9，与主要素材比例（1:1、9:16）不匹配
3. 叠在缩略图上的提示词文字可读性差

附带统一三种卡片（成功单任务 / 失败单任务 / 批量文件夹）的 footer 区域，消除信息展示的不一致性。

---

## 受影响文件

- **修改：** `src/components/WorksPanel.tsx`
  - `SingleCardGrid` 组件（缩略图比例、overlay 样式、footer 新增）
  - `BatchCardGrid` 组件（缩略图比例、footer 样式对齐）
  - grid 容器（`items-start`）

---

## 详细设计

### 1. Grid 容器 — `items-start`

**位置：** `WorksPanel.tsx` 约 line 1114，`grid` className

```diff
- className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3"
+ className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3 items-start"
```

**Why:** CSS Grid 默认 `align-items: stretch`，导致同行内较矮的卡片被撑高出现空白黑区。`items-start` 让每张卡高度由自身内容决定，互不影响。

---

### 2. 缩略图比例 — `aspect-square`

**位置：** `SingleCardGrid` 和 `BatchCardGrid` 各自的 thumbnail `<div>`

```diff
- <div className="aspect-video bg-surface-2 relative overflow-hidden">
+ <div className="aspect-square bg-surface-2 relative overflow-hidden">
```

两处都改，`object-cover` 保持不动（居中裁切）。

**Why:** 用户素材以 1:1 和 9:16 为主。16:9 容器会过度裁剪竖版内容，1:1 对三种比例都是最平衡的展示形态。

---

### 3. 提示词叠层可读性

**位置：** `SingleCardGrid` overlay 渐变 div + prompt `<p>`

渐变加深：
```diff
- bg-gradient-to-t from-black/70 via-black/20 to-transparent
+ bg-gradient-to-t from-black/85 via-black/40 to-transparent
```

prompt 文字：
```diff
- <p className="text-[11px] text-white/90 line-clamp-2 leading-snug mb-2">
+ <p
+   className="text-[11px] text-white line-clamp-2 leading-snug mb-2"
+   style={{ textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}
+ >
```

**Why:** 原渐变不足以与浅色背景图形成对比；`text-shadow` 为每个字符独立提供暗底，比加深背景更有效。

---

### 4. 统一 footer 条

#### 4a. SingleCardGrid — 成功/已下载

在 `</div>` 闭合缩略图 div 后，新增：

```tsx
{/* Footer — success */}
{!isFailed && (
  <div className="flex items-center justify-between px-3 py-2">
    <span className="text-[11px] text-text-muted">
      {modelShort(task.model)} · {task.duration}s
    </span>
    <span className="text-[11px] text-text-disabled">
      {task.completedAt ? fmtDate(task.completedAt) : ''}
    </span>
  </div>
)}
```

单行，`py-2` 固定高度。左边模型+时长，右边完成时间。

#### 4b. SingleCardGrid — 失败

替换现有 `{isFailed && <div className="p-3"><TaskErrorDisplay ... /></div>}` 块，改为：

```tsx
{/* Footer — failed */}
{isFailed && (
  <FailedFooter
    error={task.error}
    model={task.model}
    onRetry={() => onRetry(task.id)}
  />
)}
```

新增内部组件 `FailedFooter`（同文件内定义）：

```tsx
function FailedFooter({ error, model, onRetry }: {
  error?: string;
  model: string;
  onRetry: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const parsed = parseTaskError(error, model === 'kling-o1' ? 'kling' : 'seedance');

  return (
    <div className="border-t border-[rgba(255,255,255,0.06)]">
      {/* Summary row — always visible */}
      <div className="flex items-center gap-2 px-3 py-2">
        <AlertTriangle size={11} className="text-error flex-shrink-0" />
        <span className="text-[11px] text-error truncate flex-1">{parsed.title}</span>
        <button
          onClick={(e) => { e.stopPropagation(); onRetry(); }}
          className="text-[10px] text-text-muted hover:text-brand transition-colors flex-shrink-0"
        >
          重试
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); setExpanded(v => !v); }}
          className="text-[10px] text-text-disabled hover:text-text-muted transition-colors flex-shrink-0"
        >
          {expanded ? '收起' : '详情'}
        </button>
      </div>
      {/* Expanded detail */}
      {expanded && (
        <div className="px-3 pb-2.5">
          <p className="text-[11px] text-text-secondary leading-snug">{parsed.message}</p>
        </div>
      )}
    </div>
  );
}
```

**Why:** `TaskErrorDisplay` 高度不定且视觉噪声多。新组件固定一行摘要，展开时自然撑高，`items-start` 确保不影响同行其他卡片。

#### 4c. BatchCardGrid — footer 样式对齐

保留现有三行信息内容，padding 微调与单任务 footer 对齐：

```diff
- <div className="p-3">
+ <div className="px-3 py-2.5">
```

内容不变（name + model/duration/ratio + count/time）。

---

## 不改动的部分

- 叠层内的 model badge、action buttons（复制/播放/下载/删除）— 保持不动
- 删除二步倒计时逻辑 — 保持不动
- BatchCardGrid 三层叠影效果 — 保持不动
- List 视图（SingleCardList / BatchCardList）— 本次不涉及
- `TaskErrorDisplay` 组件本身 — 不删，只是 `SingleCardGrid` 不再调用它

---

## 边界情况

- `task.completedAt` 为 `undefined`（任务刚完成尚未写入）：footer 右侧显示空字符串，不报错
- 失败卡 expanded 状态：`parsed.message` 长度不定，`items-start` 确保只撑高自身
- BatchCardGrid 三层伪叠影：`pb-2 pr-2` outer wrapper 保持不动，仅内层 `p-3 → px-3 py-2.5`
