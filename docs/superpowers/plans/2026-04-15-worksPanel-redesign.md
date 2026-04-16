# WorksPanel UI Redesign (方案A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign WorksPanel queue cards and works cards with a more refined, polished aesthetic — tighter visual hierarchy, consistent `rounded-xl/2xl` radii, `active:scale-[0.97]` press feedback, persistent-dim action buttons, two-step delete confirm, stacked batch folder layers, and an Activity Rail on `BatchQueueCard`.

**Architecture:** All changes are contained in two files: `src/index.css` (add easing CSS tokens + progress keyframe) and `src/components/WorksPanel.tsx` (replace every sub-component's JSX/Tailwind classes). Logic, state, and IPC plumbing are **not changed**.

**Tech Stack:** React + TypeScript + Tailwind v4 CSS-first (`@theme` OKLCH variables, no tailwind.config.js) + Lucide icons

---

## File Map

| Action | File |
|--------|------|
| Modify | `src/index.css` — add `--ease-enter`, `--ease-exit` tokens + `@keyframes progress-fill` |
| Modify | `src/components/WorksPanel.tsx` — rewrite `QueueCard`, `BatchQueueCard`, `SingleCardGrid`, `SingleCardList`, `BatchCardGrid`, `BatchCardList`, date group header, empty state |

---

## Task 1: Add Animation Easing Tokens to `src/index.css`

**Files:**
- Modify: `src/index.css` (lines 9–26 — the `@theme` block)

- [ ] **Step 1: Add easing variables to the `@theme` block**

Open `src/index.css`. The `@theme` block currently ends at line 26 (`}`). Insert two new lines **before** the closing `}` of the `@theme` block:

```css
  /* Easing tokens */
  --ease-enter: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-exit: cubic-bezier(0.4, 0, 1, 1);
```

After the edit the bottom of the `@theme` block should look like:

```css
  --color-error: var(--color-error);

  /* Easing tokens */
  --ease-enter: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-exit: cubic-bezier(0.4, 0, 1, 1);
}
```

- [ ] **Step 2: Add `@keyframes progress-fill` after the existing `@keyframes card-pop` block (around line 244)**

Insert right after the `card-pop` closing `}`:

```css

@keyframes progress-fill {
  from { transform: scaleX(0); transform-origin: left; }
  to   { transform: scaleX(1); transform-origin: left; }
}
```

- [ ] **Step 3: Add `.animate-progress-fill` utility after the existing `.animate-card-pop` utility (around line 274)**

```css
.animate-progress-fill {
  animation: progress-fill 600ms var(--ease-enter) both;
}
```

- [ ] **Step 4: Verify the app still compiles**

```bash
cd /Users/yuchuyang/.openclaw/workspace-alex/projects/jimeng-desktop
lsof -ti:5173 | xargs kill -9 2>/dev/null; lsof -ti:5174 | xargs kill -9 2>/dev/null; pkill -f "electron" 2>/dev/null
npm run electron:dev > /tmp/electron-dev.log 2>&1 &
sleep 8 && grep -i "error\|ERR\|failed" /tmp/electron-dev.log | head -20
```

Expected: no TypeScript/Vite build errors.

- [ ] **Step 5: Commit**

```bash
cd /Users/yuchuyang/.openclaw/workspace-alex/projects/jimeng-desktop
git add src/index.css
git commit -m "feat: add ease-enter/exit tokens and progress-fill keyframe to design system"
```

---

## Task 2: Redesign `QueueCard`

**Files:**
- Modify: `src/components/WorksPanel.tsx` — replace `function QueueCard` (lines 227–304)

**Design spec:**
- Container: `rounded-xl` (was `rounded-md`), `border-[rgba(255,255,255,0.08)]` hairline border, `active:scale-[0.97] transition-transform duration-150`, `max-w-[320px]`
- Status indicator: colored dot `w-2 h-2 rounded-full` instead of Loader2/Clock icon (brand=generating, warning=queued, success=done)
- Progress bar: `h-0.5` (was `h-1`), show percentage text right-aligned in `text-[10px]` on same line
- Easing: `transition-[width] duration-[3000ms]` on the progress fill

- [ ] **Step 1: Replace the `QueueCard` function**

Find the block starting at `function QueueCard(` and ending at the first `}` that closes it (around line 304). Replace the entire function with:

```tsx
function QueueCard({ task }: { task: TaskRecord }) {
  const isActive = ['generating', 'uploading'].includes(task.status);
  const isQueued = task.status === 'queued';
  const isKling = task.model === 'kling-o1';
  const progress = task.progress ?? 0;
  const statusText = isQueued && isKling && task.statusMessage
    ? task.statusMessage
    : isQueued && task.queuePosition != null
      ? `第 ${task.queuePosition + 1} 位`
      : STATUS_LABEL[task.status];

  // Dot color
  const dotColor = isActive
    ? 'bg-brand animate-pulse'
    : isQueued
      ? 'bg-warning'
      : task.status === 'failed'
        ? 'bg-error'
        : 'bg-success';

  return (
    <div className="bg-surface-2 border border-[rgba(255,255,255,0.08)] rounded-xl p-3 flex flex-col gap-2 min-w-0 max-w-[320px] active:scale-[0.97] transition-transform duration-150">
      {/* Top row: status dot + label + params */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor}`} />
          <span className={`text-[11px] font-medium ${STATUS_COLOR[task.status]}`}>
            {statusText}
          </span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <span className="text-[10px] text-text-disabled bg-surface-3 px-1.5 py-0.5 rounded">
            {modelShort(task.model)}
          </span>
          <span className="text-[10px] text-text-disabled bg-surface-3 px-1.5 py-0.5 rounded">
            {task.duration}s
          </span>
        </div>
      </div>

      {/* Prompt */}
      <p className="text-xs text-text-secondary line-clamp-2 leading-snug">{task.prompt}</p>

      {/* Material thumbnails */}
      {task.materials?.length > 0 && (
        <div className="flex gap-1.5">
          {task.materials.slice(0, 4).map((m, i) => (
            <div key={i} className="w-10 h-10 rounded-lg overflow-hidden border border-[rgba(255,255,255,0.08)] flex-shrink-0 bg-surface-3">
              {m.type === 'image'
                ? <img src={localFileUrlSync(m.path)} alt="" className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center"><Film size={12} className="text-text-disabled" /></div>
              }
            </div>
          ))}
          {task.materials.length > 4 && (
            <div className="w-10 h-10 rounded-lg border border-[rgba(255,255,255,0.08)] flex items-center justify-center flex-shrink-0 bg-surface-3">
              <span className="text-[10px] text-text-disabled">+{task.materials.length - 4}</span>
            </div>
          )}
        </div>
      )}

      {/* Progress bar + percentage */}
      {(isActive || isKling) && (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-0.5 bg-surface-3 rounded-full overflow-hidden">
              <div
                className="h-full bg-brand rounded-full transition-[width] duration-[3000ms] ease-linear"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-[10px] text-text-disabled flex-shrink-0 w-7 text-right">
              {progress}%
            </span>
          </div>
          {task.statusMessage && (
            <p className="text-[10px] text-text-disabled">{task.statusMessage}</p>
          )}
        </div>
      )}

      {/* Queue countdown */}
      {isQueued && task.nextPollAt && (
        <p className="text-[10px] text-text-disabled">
          {Math.max(0, Math.ceil((task.nextPollAt - Date.now()) / 60_000))} 分钟后刷新进度
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify compilation and visual check**

Restart dev server and check WorksPanel with an active queue task. Confirm:
- Status dot appears (colored circle, not Loader2)
- Progress bar is thinner (`h-0.5`)
- Percentage shows to the right of the bar
- Card has `rounded-xl` corners

- [ ] **Step 3: Commit**

```bash
cd /Users/yuchuyang/.openclaw/workspace-alex/projects/jimeng-desktop
git add src/components/WorksPanel.tsx
git commit -m "feat: redesign QueueCard — status dot, thin progress bar, percentage, rounded-xl"
```

---

## Task 3: Redesign `BatchQueueCard` with Activity Rail

**Files:**
- Modify: `src/components/WorksPanel.tsx` — replace `function BatchQueueCard` (lines 115–225)

**Design spec:**
- Same shell as `QueueCard`: `rounded-xl`, `border-[rgba(255,255,255,0.08)]`, `max-w-[320px]`, `active:scale-[0.97]`
- Activity Rail replaces the "expand toggle + sub-task rows":
  - If `total ≤ 3`: show inline dots/avatars with status colors, no scroll
  - If `total > 3`: horizontal scroll container with a right-side `mask-image` CSS fade-out, each item is a small square chip
- Progress bar: same `h-0.5` style as `QueueCard`
- Remove the expand/collapse toggle entirely (Activity Rail is always visible)

- [ ] **Step 1: Replace the `BatchQueueCard` function**

Find the block starting at `// ── Batch queue card` (around line 113) and ending just before `function QueueCard` (around line 226). Replace it entirely with:

```tsx
// ── Batch queue card — same size/style as QueueCard ──────────────────────────

function BatchQueueCard() {
  const { batchTasks, batchInfo } = useStore();
  const hasActiveTasks = batchTasks.some((t: BatchTaskItem) =>
    ['pending', 'submitted', 'generating'].includes(t.status)
  );

  const total = batchTasks.length;
  if (total === 0 || !hasActiveTasks) return null;

  const doneBatch = batchTasks.filter((t: BatchTaskItem) =>
    ['completed', 'downloaded', 'failed'].includes(t.status)
  );
  const progressPct = Math.round((doneBatch.length / total) * 100);
  const isRunning = doneBatch.length < total;

  const activeTask = batchTasks.find((t: BatchTaskItem) =>
    ['submitted', 'generating'].includes(t.status)
  );
  const isQueuing    = activeTask && activeTask.queueStatus === 'Queuing';
  const isGenerating = activeTask && activeTask.queueStatus === 'Generating';

  let statusLabel: string;
  let statusColor: string;
  let dotColor: string;
  if (!isRunning)        { statusLabel = '已完成';  statusColor = 'text-success'; dotColor = 'bg-success'; }
  else if (isQueuing)    { statusLabel = `排队第${activeTask!.queuePosition! + 1}位`; statusColor = 'text-warning'; dotColor = 'bg-warning'; }
  else if (isGenerating) { statusLabel = '生成中';  statusColor = 'text-brand';   dotColor = 'bg-brand animate-pulse'; }
  else                   { statusLabel = '提交中';  statusColor = 'text-brand';   dotColor = 'bg-brand animate-pulse'; }

  // Task dot color per status
  const taskDotColor = (t: BatchTaskItem): string => {
    if (['completed', 'downloaded'].includes(t.status)) return 'bg-success';
    if (t.status === 'failed') return 'bg-error';
    if (['submitted', 'generating'].includes(t.status)) return 'bg-brand';
    return 'bg-surface-3';
  };

  const showScrollRail = total > 3;

  return (
    <div className="bg-surface-2 border border-[rgba(255,255,255,0.08)] rounded-xl p-3 flex flex-col gap-2 min-w-0 max-w-[320px] active:scale-[0.97] transition-transform duration-150">
      {/* Top row: status dot + label + badges */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor}`} />
          <span className={`text-[11px] font-medium ${statusColor}`}>{statusLabel}</span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <span className="text-[10px] text-text-disabled bg-surface-3 px-1.5 py-0.5 rounded">批量</span>
          <span className="text-[10px] text-brand bg-brand/10 px-1.5 py-0.5 rounded">
            {doneBatch.length}/{total}
          </span>
        </div>
      </div>

      {/* Batch name */}
      <p className="text-xs text-text-secondary line-clamp-2 leading-snug">
        {batchInfo?.name || batchInfo?.description || batchTasks[0]?.prompt || '批量生成任务'}
      </p>

      {/* Progress bar + percentage */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-0.5 bg-surface-3 rounded-full overflow-hidden">
          <div
            className="h-full bg-brand rounded-full transition-[width] duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <span className="text-[10px] text-text-disabled flex-shrink-0 w-7 text-right">
          {progressPct}%
        </span>
      </div>

      {/* Activity Rail */}
      {showScrollRail ? (
        // >3 tasks: horizontal scroll with right fade mask
        <div
          className="relative overflow-hidden"
          style={{ maskImage: 'linear-gradient(to right, black 80%, transparent 100%)' }}
        >
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
            {batchTasks.map((t: BatchTaskItem, i: number) => (
              <div
                key={t.id}
                className={`flex-shrink-0 w-5 h-5 rounded flex items-center justify-center text-[9px] font-mono
                  ${['completed','downloaded'].includes(t.status) ? 'bg-success/15 text-success'
                  : t.status === 'failed' ? 'bg-error/15 text-error'
                  : ['submitted','generating'].includes(t.status) ? 'bg-brand/15 text-brand'
                  : 'bg-surface-3 text-text-disabled'}`}
                title={t.prompt}
              >
                {String(i + 1).padStart(2, '0')}
              </div>
            ))}
          </div>
        </div>
      ) : (
        // ≤3 tasks: inline dots with prompt truncated
        <div className="flex items-center gap-2">
          {batchTasks.map((t: BatchTaskItem, i: number) => (
            <div key={t.id} className="flex items-center gap-1 min-w-0">
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${taskDotColor(t)}`} />
              <span className="text-[10px] text-text-disabled truncate max-w-[72px]">
                {t.prompt.slice(0, 14)}{t.prompt.length > 14 ? '…' : ''}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify compilation and visual check**

Restart dev server. Start a batch task (≥4 items) and confirm:
- Card has `rounded-xl` and hairline border
- Status dot replaces loader icon
- Activity Rail chips appear in a scrollable row with right fade
- Progress bar is `h-0.5` with percentage

- [ ] **Step 3: Commit**

```bash
cd /Users/yuchuyang/.openclaw/workspace-alex/projects/jimeng-desktop
git add src/components/WorksPanel.tsx
git commit -m "feat: redesign BatchQueueCard — Activity Rail, status dot, thin progress bar"
```

---

## Task 4: Redesign `SingleCardGrid` (overlay gradient + persistent-dim buttons + delete confirm)

**Files:**
- Modify: `src/components/WorksPanel.tsx` — replace `function SingleCardGrid` (lines 308–426)

**Design spec:**
- Container: `rounded-2xl` (was `rounded-md`), `border-[rgba(255,255,255,0.08)]`, `active:scale-[0.97] transition-transform duration-150`
- Thumbnail overlay: `bg-gradient-to-t from-black/70 via-black/20 to-transparent` pinned to bottom half
- Action buttons: always visible at `opacity-30` when not hovered; `group-hover:opacity-100` — NOT `opacity-0`
- Delete two-step confirm:
  - First click on `Trash2`: sets local `deleteConfirm` state → button changes to red countdown (`3…2…1`)  
  - During countdown: a second click confirms delete; if no click within 3s → state resets
  - Use `useEffect` with a 3-second countdown interval
- Info section: moved **inside the overlay** (overlaid on the video, not a separate white panel below), prompt text + model/duration badge

- [ ] **Step 1: Replace the `SingleCardGrid` function**

Find `function SingleCardGrid` and replace it entirely with:

```tsx
function SingleCardGrid({ task, onPreview, onDelete, onRetry, highlighted = false }: {
  task: TaskRecord;
  onPreview: (url: string) => void;
  onDelete: (id: string) => void;
  onRetry: (id: string) => void;
  highlighted?: boolean;
}) {
  const { downloadTask } = useStore();
  const isFailed = task.status === 'failed';
  const isDone = ['completed', 'downloaded'].includes(task.status);
  const cardRef = useRef<HTMLDivElement>(null);
  const openablePath = getOpenableLocalPath(task.localPath, task.filePath, task.resultUrl);
  const playUrl = task.localPath ? toPlayable(task.localPath) : task.resultUrl ? toPlayable(task.resultUrl) : '';
  const canManualDownload = Boolean(task.submitId || isRemoteHttpUrl(task.resultUrl));

  const [deleteCountdown, setDeleteCountdown] = useState(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (highlighted) {
      cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlighted]);

  // Reset delete confirm when countdown reaches 0
  useEffect(() => {
    if (deleteCountdown > 0) {
      countdownRef.current = setInterval(() => {
        setDeleteCountdown(c => {
          if (c <= 1) {
            if (countdownRef.current) clearInterval(countdownRef.current);
            return 0;
          }
          return c - 1;
        });
      }, 1000);
    }
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [deleteCountdown]);

  const handleDeleteClick = useCallback(() => {
    if (deleteCountdown > 0) {
      // Second click — confirm delete
      if (countdownRef.current) clearInterval(countdownRef.current);
      setDeleteCountdown(0);
      onDelete(task.id);
    } else {
      // First click — start countdown
      setDeleteCountdown(3);
    }
  }, [deleteCountdown, onDelete, task.id]);

  const handleDownload = useCallback(() => {
    if (openablePath) {
      window.api.openFile(openablePath);
      return;
    }
    if (task.status === 'completed' && canManualDownload) {
      void downloadTask(task.id);
    }
  }, [canManualDownload, downloadTask, openablePath, task]);

  return (
    <div
      ref={cardRef}
      className={`group relative bg-surface-1 border rounded-2xl overflow-hidden cursor-pointer
        active:scale-[0.97] transition-all duration-150 ${
        highlighted
          ? 'border-brand shadow-[0_0_0_1px_rgba(54,118,255,0.28)]'
          : 'border-[rgba(255,255,255,0.08)] hover:border-[rgba(255,255,255,0.16)]'
      }`}
    >
      {/* Thumbnail */}
      <div className="aspect-video bg-surface-2 relative overflow-hidden">
        {task.thumbnailUrl ? (
          <img
            src={toPlayable(task.thumbnailUrl)}
            alt=""
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : isDone && playUrl ? (
          <video
            src={playUrl}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            muted
            preload="metadata"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            {isFailed
              ? <AlertTriangle size={24} className="text-error/50" />
              : <Film size={24} className="text-text-disabled" />
            }
          </div>
        )}

        {/* Duration badge — top left */}
        <div className="absolute top-2 left-2 flex gap-1">
          <span className="px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur-sm text-[10px] text-white/80 font-mono">
            {task.duration}s
          </span>
          {task.status === 'downloaded' && (
            <span className="px-1.5 py-0.5 rounded-md bg-success/80 text-[10px] text-white">已下载</span>
          )}
          {isFailed && (
            <span className="px-1.5 py-0.5 rounded-md bg-error/80 text-[10px] text-white">失败</span>
          )}
        </div>

        {/* Bottom overlay gradient + info + actions */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent pt-8 pb-2.5 px-2.5">
          {/* Prompt text */}
          <p className="text-[11px] text-white/90 line-clamp-2 leading-snug mb-2">
            {task.prompt || '无提示词'}
          </p>

          {/* Model badge + actions row */}
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] text-white/50">{modelShort(task.model)}</span>

            <div className="flex items-center gap-1">
              <button
                onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(task.prompt); }}
                className="p-1.5 rounded-lg bg-black/50 text-white/30 hover:text-white/90 transition-colors opacity-30 group-hover:opacity-100"
                title="复制提示词"
              >
                <Copy size={11} />
              </button>
              {!isFailed && playUrl && (
                <button
                  onClick={(e) => { e.stopPropagation(); onPreview(playUrl); }}
                  className="p-1.5 rounded-lg bg-black/50 text-white/30 hover:text-white/90 transition-colors opacity-30 group-hover:opacity-100"
                  title="播放"
                >
                  <Play size={11} />
                </button>
              )}
              {!isFailed && (openablePath || canManualDownload) && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleDownload(); }}
                  className="p-1.5 rounded-lg bg-black/50 text-white/30 hover:text-white/90 transition-colors opacity-30 group-hover:opacity-100"
                  title="下载"
                >
                  <Download size={11} />
                </button>
              )}
              {isFailed && (
                <button
                  onClick={(e) => { e.stopPropagation(); onRetry(task.id); }}
                  className="p-1.5 rounded-lg bg-black/50 text-white/30 hover:text-white/90 transition-colors opacity-30 group-hover:opacity-100"
                  title="重试"
                >
                  <RefreshCw size={11} />
                </button>
              )}
              {/* Delete — two-step confirm */}
              <button
                onClick={(e) => { e.stopPropagation(); handleDeleteClick(); }}
                className={`p-1.5 rounded-lg transition-colors opacity-30 group-hover:opacity-100 ${
                  deleteCountdown > 0
                    ? 'bg-error/70 text-white opacity-100'
                    : 'bg-black/50 text-white/30 hover:text-error'
                }`}
                title={deleteCountdown > 0 ? `再次点击确认删除 (${deleteCountdown}s)` : '删除'}
              >
                {deleteCountdown > 0
                  ? <span className="text-[11px] font-mono w-3 text-center block">{deleteCountdown}</span>
                  : <Trash2 size={11} />
                }
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Failed error block below thumbnail */}
      {isFailed && (
        <div className="p-3">
          <TaskErrorDisplay
            rawError={task.error}
            source={task.model === 'kling-o1' ? 'kling' : 'seedance'}
            onRetry={onRetry ? () => onRetry(task.id) : undefined}
            onFix={onRetry ? () => onRetry(task.id) : undefined}
          />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify compilation and visual check**

Restart dev server. In WorksPanel grid view confirm:
- Cards have `rounded-2xl` corners
- Overlay gradient visible on hover, buttons show at 30% opacity even before hover
- Hovering a card brings buttons to full opacity
- First delete click shows countdown `3` in red; clicking again deletes; waiting 3s resets

- [ ] **Step 3: Commit**

```bash
cd /Users/yuchuyang/.openclaw/workspace-alex/projects/jimeng-desktop
git add src/components/WorksPanel.tsx
git commit -m "feat: redesign SingleCardGrid — overlay info, persistent-dim buttons, delete confirm countdown"
```

---

## Task 5: Redesign `SingleCardList` (consistent style + delete confirm)

**Files:**
- Modify: `src/components/WorksPanel.tsx` — replace `function SingleCardList` (lines 430–520)

**Design spec:**
- Container: `rounded-xl` (was `rounded-md`), `border-[rgba(255,255,255,0.08)]`, `active:scale-[0.97]`
- Thumbnail: `rounded-lg` (was `rounded-md`)
- Delete two-step: same `deleteCountdown` pattern as `SingleCardGrid`
- Action buttons: always visible at `opacity-50` in list mode (less invisible than grid), `group-hover:opacity-100`

- [ ] **Step 1: Replace the `SingleCardList` function**

Find `function SingleCardList` and replace it entirely with:

```tsx
function SingleCardList({ task, onPreview, onDelete, onRetry, highlighted = false }: {
  task: TaskRecord;
  onPreview: (url: string) => void;
  onDelete: (id: string) => void;
  onRetry: (id: string) => void;
  highlighted?: boolean;
}) {
  const { downloadTask } = useStore();
  const isFailed = task.status === 'failed';
  const cardRef = useRef<HTMLDivElement>(null);
  const openablePath = getOpenableLocalPath(task.localPath, task.filePath, task.resultUrl);
  const playUrl = task.localPath ? toPlayable(task.localPath) : task.resultUrl ? toPlayable(task.resultUrl) : '';
  const canManualDownload = Boolean(task.submitId || isRemoteHttpUrl(task.resultUrl));

  const [deleteCountdown, setDeleteCountdown] = useState(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (highlighted) {
      cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlighted]);

  useEffect(() => {
    if (deleteCountdown > 0) {
      countdownRef.current = setInterval(() => {
        setDeleteCountdown(c => {
          if (c <= 1) {
            if (countdownRef.current) clearInterval(countdownRef.current);
            return 0;
          }
          return c - 1;
        });
      }, 1000);
    }
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [deleteCountdown]);

  const handleDeleteClick = useCallback(() => {
    if (deleteCountdown > 0) {
      if (countdownRef.current) clearInterval(countdownRef.current);
      setDeleteCountdown(0);
      onDelete(task.id);
    } else {
      setDeleteCountdown(3);
    }
  }, [deleteCountdown, onDelete, task.id]);

  const handleDownload = useCallback(() => {
    if (openablePath) {
      window.api.openFile(openablePath);
      return;
    }
    if (task.status === 'completed' && canManualDownload) {
      void downloadTask(task.id);
    }
  }, [canManualDownload, downloadTask, openablePath, task]);

  return (
    <div
      ref={cardRef}
      className={`group flex items-center gap-3 bg-surface-1 border rounded-xl p-3
        active:scale-[0.97] transition-all duration-150 ${
        highlighted
          ? 'border-brand shadow-[0_0_0_1px_rgba(54,118,255,0.28)]'
          : 'border-[rgba(255,255,255,0.08)] hover:border-[rgba(255,255,255,0.16)]'
      }`}
    >
      {/* Thumbnail */}
      <div className="w-20 h-14 rounded-lg overflow-hidden bg-surface-2 flex-shrink-0 relative">
        {task.thumbnailUrl
          ? <img src={toPlayable(task.thumbnailUrl)} alt="" className="w-full h-full object-cover" loading="lazy" />
          : !isFailed && playUrl
            ? <video src={playUrl} className="w-full h-full object-cover" muted preload="metadata" />
            : <div className="w-full h-full flex items-center justify-center">
                {isFailed ? <AlertTriangle size={16} className="text-error/50" /> : <Film size={16} className="text-text-disabled" />}
              </div>
        }
        {isFailed && <div className="absolute inset-0 bg-error/20" />}
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-text-primary line-clamp-1">{task.prompt || '无提示词'}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className={`text-[11px] ${STATUS_COLOR[task.status]}`}>{STATUS_LABEL[task.status]}</span>
          <span className="text-[11px] text-text-disabled">{modelShort(task.model)} · {task.duration}s · {fmtDate(task.createdAt)}</span>
        </div>
        {isFailed && (
          <p className={`text-[10px] mt-0.5 ${CATEGORY_COLORS[parseTaskError(task.error, task.model === 'kling-o1' ? 'kling' : 'seedance').category].text}`}>
            {parseTaskError(task.error, task.model === 'kling-o1' ? 'kling' : 'seedance').title}
            {task.error ? ` — ${task.error.slice(0, 50)}${task.error.length > 50 ? '…' : ''}` : ''}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0 opacity-50 group-hover:opacity-100 transition-opacity">
        {!isFailed && playUrl && (
          <button onClick={() => onPreview(playUrl)} className="p-1.5 rounded-lg bg-surface-3 hover:bg-brand hover:text-white text-text-muted transition-colors">
            <Play size={12} />
          </button>
        )}
        {!isFailed && (openablePath || canManualDownload) && (
          <button onClick={handleDownload} className="p-1.5 rounded-lg bg-surface-3 hover:bg-brand hover:text-white text-text-muted transition-colors">
            <Download size={12} />
          </button>
        )}
        {isFailed && (
          <button onClick={() => onRetry(task.id)} className="p-1.5 rounded-lg bg-surface-3 hover:bg-brand hover:text-white text-text-muted transition-colors">
            <RefreshCw size={12} />
          </button>
        )}
        {/* Delete — two-step confirm */}
        <button
          onClick={handleDeleteClick}
          className={`p-1.5 rounded-lg transition-colors ${
            deleteCountdown > 0
              ? 'bg-error/70 text-white'
              : 'bg-surface-3 hover:bg-error hover:text-white text-text-muted'
          }`}
          title={deleteCountdown > 0 ? `再次点击确认 (${deleteCountdown}s)` : '删除'}
        >
          {deleteCountdown > 0
            ? <span className="text-[11px] font-mono w-3 text-center block">{deleteCountdown}</span>
            : <Trash2 size={12} />
          }
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify compilation and visual check**

In WorksPanel list view confirm:
- Cards have `rounded-xl`
- Action buttons visible at 50% opacity (not hidden)
- Delete confirm countdown works same as grid

- [ ] **Step 3: Commit**

```bash
cd /Users/yuchuyang/.openclaw/workspace-alex/projects/jimeng-desktop
git add src/components/WorksPanel.tsx
git commit -m "feat: redesign SingleCardList — rounded-xl, semi-visible actions, delete countdown"
```

---

## Task 6: Redesign `BatchCardGrid` with Stacked Pseudo-Layer Effect

**Files:**
- Modify: `src/components/WorksPanel.tsx` — replace `function BatchCardGrid` (lines 524–578)

**Design spec:**
- The card renders **3 absolutely-positioned pseudo-layers** behind the main card:
  - Layer 3 (back): `z-index: 0`, `translate(6px, 6px)`, `opacity-30`, `scale-[0.93]`
  - Layer 2 (mid): `z-index: 1`, `translate(3px, 3px)`, `opacity-60`, `scale-[0.96]`
  - Layer 1 (front): `z-index: 2`, full card — cover thumbnail + info
- The outer wrapper has `relative` to contain the pseudo-layers, with enough bottom padding to not clip them
- Hover: `hover:-translate-y-1` on outer wrapper (layers follow)
- Container: `rounded-2xl`, `border-[rgba(255,255,255,0.08)]`, `active:scale-[0.97] transition-transform duration-150`

- [ ] **Step 1: Replace the `BatchCardGrid` function**

Find `function BatchCardGrid` and replace it entirely with:

```tsx
function BatchCardGrid({ record, onClick }: { record: BatchHistoryRecord; onClick: () => void }) {
  const doneCount = record.tasks.filter(t => t.status !== 'failed').length;
  const failCount = record.tasks.filter(t => t.status === 'failed').length;
  const cover = record.tasks.find(t => t.outputFile)?.outputFile;

  return (
    // Outer wrapper with bottom padding to show stacked layers
    <div
      className="relative pb-2 pr-2 cursor-pointer group"
      onClick={onClick}
    >
      {/* Layer 3 — back */}
      <div
        className="absolute inset-0 bg-surface-1 border border-[rgba(255,255,255,0.05)] rounded-2xl opacity-30"
        style={{ transform: 'translate(6px, 6px) scale(0.93)', zIndex: 0 }}
      />
      {/* Layer 2 — mid */}
      <div
        className="absolute inset-0 bg-surface-1 border border-[rgba(255,255,255,0.07)] rounded-2xl opacity-60"
        style={{ transform: 'translate(3px, 3px) scale(0.96)', zIndex: 1 }}
      />

      {/* Layer 1 — front (actual card) */}
      <div
        className="relative bg-surface-1 border border-[rgba(255,255,255,0.10)] rounded-2xl overflow-hidden
          transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.97]"
        style={{ zIndex: 2 }}
      >
        {/* Cover thumbnail */}
        <div className="aspect-video bg-surface-2 relative overflow-hidden">
          {cover ? (
            <video
              src={toPlayable(cover)}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              muted
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-1">
              <Layers size={28} className="text-text-disabled" />
            </div>
          )}

          {/* Task count badge */}
          <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur-sm text-[10px] text-white/90">
            {record.totalTasks} 个视频
          </div>
          {failCount > 0 && (
            <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md bg-error/70 text-[10px] text-white">
              {failCount} 失败
            </div>
          )}

          {/* Hover overlay */}
          <div className="absolute inset-0 bg-brand/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <span className="text-xs text-white bg-brand/80 px-3 py-1 rounded-full">查看详情</span>
          </div>
        </div>

        {/* Info */}
        <div className="p-3">
          <p className="text-xs font-medium text-text-primary truncate">{record.name}</p>
          <div className="flex items-center gap-1 mt-1">
            <span className="text-[11px] text-text-disabled">{modelShort(record.model)} · {record.duration}s · {record.aspectRatio}</span>
          </div>
          <div className="flex items-center gap-1 mt-1.5">
            <CheckCircle size={11} className="text-success" />
            <span className="text-[11px] text-success">{doneCount}</span>
            {failCount > 0 && (
              <>
                <AlertTriangle size={11} className="text-error ml-1" />
                <span className="text-[11px] text-error">{failCount}</span>
              </>
            )}
            <span className="text-[11px] text-text-disabled ml-auto">{fmtDate(record.completedAt)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify compilation and visual check**

In WorksPanel grid view with a completed batch confirm:
- Three stacked layers visible behind the main card
- Card has `rounded-2xl`
- Hover lifts card slightly
- Click opens batch drawer

- [ ] **Step 3: Commit**

```bash
cd /Users/yuchuyang/.openclaw/workspace-alex/projects/jimeng-desktop
git add src/components/WorksPanel.tsx
git commit -m "feat: redesign BatchCardGrid — three stacked pseudo-layer depth effect"
```

---

## Task 7: Redesign `BatchCardList` (minor consistency updates)

**Files:**
- Modify: `src/components/WorksPanel.tsx` — replace `function BatchCardList` (lines 582–608)

**Design spec:**
- Container: `rounded-xl`, `border-[rgba(255,255,255,0.08)]`, `active:scale-[0.97]`
- Layers icon container: `rounded-lg`

- [ ] **Step 1: Replace the `BatchCardList` function**

Find `function BatchCardList` and replace it entirely with:

```tsx
function BatchCardList({ record, onClick }: { record: BatchHistoryRecord; onClick: () => void }) {
  const doneCount = record.tasks.filter(t => t.status !== 'failed').length;
  const failCount = record.tasks.filter(t => t.status === 'failed').length;

  return (
    <div
      onClick={onClick}
      className="group flex items-center gap-3 bg-surface-1 border border-[rgba(255,255,255,0.08)] rounded-xl p-2.5
        hover:border-[rgba(255,255,255,0.16)] cursor-pointer transition-all duration-150 active:scale-[0.97]"
    >
      <div className="w-10 h-10 rounded-lg bg-surface-3 flex items-center justify-center flex-shrink-0">
        <Layers size={18} className="text-brand" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-text-primary truncate">{record.name}</p>
        <p className="text-[10px] text-text-disabled mt-0.5">
          {modelShort(record.model)} · {record.duration}s · {record.aspectRatio}
          <span className="ml-2 text-success">✓{doneCount}</span>
          {failCount > 0 && <span className="ml-1 text-error">✗{failCount}</span>}
          <span className="ml-2">{fmtDate(record.completedAt)}</span>
        </p>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <span className="text-[10px] text-brand">查看 →</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify compilation**

Confirm list mode batch cards show `rounded-xl` and have press scale.

- [ ] **Step 3: Commit**

```bash
cd /Users/yuchuyang/.openclaw/workspace-alex/projects/jimeng-desktop
git add src/components/WorksPanel.tsx
git commit -m "feat: update BatchCardList — rounded-xl, press scale consistency"
```

---

## Task 8: Redesign Date Group Header + Empty State

**Files:**
- Modify: `src/components/WorksPanel.tsx` — the `WorksPanel` function JSX (around lines 934–942 for date header, lines 923–931 for empty state)

**Design spec for date header:**
- Left: text label `text-[11px] font-medium text-text-muted`
- Center: `flex-1 h-px bg-[rgba(255,255,255,0.06)]` hairline divider
- Right: count `text-[10px] text-text-disabled`
- Remove the old badge-style count

**Design spec for empty state:**
- Larger icon container: `w-16 h-16 rounded-2xl bg-surface-2`
- Film icon size 32
- Primary text: `text-sm font-medium text-text-secondary`
- Sub text: `text-[11px] text-text-muted mt-1`
- CTA: a small button `切换到创作` pointing back to chat (via `window.dispatchEvent`)

- [ ] **Step 1: Update the date group header JSX in `WorksPanel`**

Find the `<h3 ...>` tag inside `groupedWorks.map` (around line 935):

Old code:
```tsx
<h3 className="text-[11px] font-medium text-text-muted mb-2.5 flex items-center gap-1.5">
  {group.label}
  <span className="text-[10px] text-text-disabled bg-surface-2 px-1.5 py-0.5 rounded-full">
    {group.items.length}
  </span>
</h3>
```

New code:
```tsx
<div className="flex items-center gap-2 mb-2.5">
  <span className="text-[11px] font-medium text-text-muted flex-shrink-0">{group.label}</span>
  <div className="flex-1 h-px bg-[rgba(255,255,255,0.06)]" />
  <span className="text-[10px] text-text-disabled flex-shrink-0">{group.items.length}</span>
</div>
```

- [ ] **Step 2: Update the empty state JSX in `WorksPanel`**

Find the empty state block (around line 924):

Old code:
```tsx
<div className="flex flex-col items-center justify-center h-48 text-center px-6">
  <div className="w-12 h-12 rounded-xl bg-surface-2 flex items-center justify-center mb-3">
    <Film size={24} className="text-text-disabled" />
  </div>
  <p className="text-sm font-medium text-text-secondary">暂无作品</p>
  <p className="text-[11px] text-text-muted mt-1">生成完成的视频会出现在这里</p>
</div>
```

New code:
```tsx
<div className="flex flex-col items-center justify-center h-64 text-center px-6">
  <div className="w-16 h-16 rounded-2xl bg-surface-2 flex items-center justify-center mb-4">
    <Film size={32} className="text-text-disabled" />
  </div>
  <p className="text-sm font-semibold text-text-secondary">还没有作品</p>
  <p className="text-[11px] text-text-muted mt-1.5">生成完成的视频会在这里展示</p>
  <button
    className="mt-4 px-4 py-1.5 rounded-lg bg-brand/15 text-brand text-xs hover:bg-brand/25 transition-colors active:scale-[0.97]"
    onClick={() => window.dispatchEvent(new CustomEvent('navigate-to-chat'))}
  >
    去创作第一个视频
  </button>
</div>
```

> Note: The `navigate-to-chat` custom event needs a listener in `App.tsx` to switch the active panel. Add this to the existing `useEffect` in `App.tsx` that handles panel navigation, OR just leave it as a visual button — the panel switch is a bonus.

- [ ] **Step 3: Verify compilation and visual check**

Confirm:
- Date group headers show as `Label ———————— count` format
- Empty state has larger icon, bigger spacing, and CTA button

- [ ] **Step 4: Commit**

```bash
cd /Users/yuchuyang/.openclaw/workspace-alex/projects/jimeng-desktop
git add src/components/WorksPanel.tsx
git commit -m "feat: redesign date group headers (divider line) and empty state with CTA"
```

---

## Task 9 (Optional): Wire `navigate-to-chat` Event in `App.tsx`

**Files:**
- Modify: `src/App.tsx`

**Only needed if you want the empty state CTA to actually switch to the chat panel.**

- [ ] **Step 1: Find the panel state setter in `App.tsx`**

Look for `const [activePanel, setActivePanel]` or similar state (the panel is controlled by App.tsx).

- [ ] **Step 2: Add event listener**

In an existing `useEffect` or a new one:

```tsx
useEffect(() => {
  const handleNavToChat = () => setActivePanel('chat');
  window.addEventListener('navigate-to-chat', handleNavToChat);
  return () => window.removeEventListener('navigate-to-chat', handleNavToChat);
}, []);
```

Replace `setActivePanel('chat')` with whatever the actual setter and panel name are in your codebase.

- [ ] **Step 3: Commit**

```bash
cd /Users/yuchuyang/.openclaw/workspace-alex/projects/jimeng-desktop
git add src/App.tsx
git commit -m "feat: wire navigate-to-chat event from WorksPanel empty state to App panel router"
```

---

## Final Verification Checklist

After all tasks are complete:

- [ ] `npm run electron:dev` starts without TypeScript errors
- [ ] Queue section: QueueCard and BatchQueueCard show rounded-xl corners, status dots, thin progress bars
- [ ] BatchQueueCard Activity Rail: ≤3 tasks → inline dots with labels; >3 tasks → scrollable chips with right fade
- [ ] Works grid: SingleCardGrid shows `rounded-2xl`, overlay gradient, buttons always dim-visible
- [ ] Works grid: Delete first click shows countdown in red; second click confirms; waiting 3s resets
- [ ] Works grid: BatchCardGrid shows three stacked layer effect
- [ ] Works list: SingleCardList shows `rounded-xl`, 50% opacity buttons, delete countdown
- [ ] Works list: BatchCardList shows `rounded-xl`, press scale
- [ ] Date group headers show `Label ─── count` divider style
- [ ] Empty state shows larger icon, CTA button
- [ ] All `active:scale-[0.97]` press feedbacks work on tap/click
- [ ] `git push origin main` succeeds
