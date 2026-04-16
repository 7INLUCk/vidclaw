# Badge Content Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify left-top thumbnail badge pills across `SingleCardGrid` and `BatchCardGrid` so both use the same three-slot schema: mode | quantity | status.

**Architecture:** Two targeted edits in one file (`src/components/WorksPanel.tsx`). No new components, no new state, no backend changes. `SingleCardGrid` badge replaces `{duration}s` with `1 个` and adds always-shown pill 3. `BatchCardGrid` badge replaces `✓{doneCount}` with `{totalTasks} 个`, adds `allDownloaded` derived value, and makes pill 3 always shown.

**Tech Stack:** React, TypeScript, Tailwind v4 (CSS-first, OKLCH tokens). No tailwind.config.js.

---

## File Map

| File | Change |
|------|--------|
| `src/components/WorksPanel.tsx` lines ~548–562 | Replace `SingleCardGrid` badge block |
| `src/components/WorksPanel.tsx` lines ~832–836 | Add `allDownloaded` derived value in `BatchCardGrid` |
| `src/components/WorksPanel.tsx` lines ~929–939 | Replace `BatchCardGrid` badge block |

---

### Task 1: Update `SingleCardGrid` badge

**Files:**
- Modify: `src/components/WorksPanel.tsx` lines ~548–562

**Context:** `SingleCardGrid` receives a `task: TaskRecord` prop. `isFailed` is already derived earlier in the component as `task.status === 'failed'`. The badge currently shows `{task.duration}s` in pill 2 and conditionally shows `已下载`/`失败` pills. After this change pill 3 is always shown.

- [ ] **Step 1: Replace the badge block**

Find this block (lines ~548–562):

```tsx
        {/* Duration / status badges — top left */}
        <div className="absolute top-2 left-2 flex gap-1">
          {/* Mode label */}
          <span className="px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur-sm text-[10px] text-white/60">单个</span>
          {/* Duration */}
          <span className="px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur-sm text-[10px] text-white/80 font-mono">
            {task.duration}s
          </span>
          {/* Status */}
          {task.status === 'downloaded' && (
            <span className="px-1.5 py-0.5 rounded-md bg-success/80 text-[10px] text-white">已下载</span>
          )}
          {isFailed && (
            <span className="px-1.5 py-0.5 rounded-md bg-error/80 text-[10px] text-white">失败</span>
          )}
        </div>
```

Replace with:

```tsx
        {/* Top-left badges: mode | quantity | status (always 3 pills) */}
        <div className="absolute top-2 left-2 flex gap-1">
          <span className="px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur-sm text-[10px] text-white/60">单个</span>
          <span className="px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur-sm text-[10px] text-white/80">1 个</span>
          {isFailed
            ? <span className="px-1.5 py-0.5 rounded-md bg-error/80 text-[10px] text-white">失败</span>
            : task.status === 'downloaded'
              ? <span className="px-1.5 py-0.5 rounded-md bg-success/80 text-[10px] text-white">已下载</span>
              : <span className="px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur-sm text-[10px] text-white/80">已完成</span>
          }
        </div>
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/yuchuyang/.openclaw/workspace-alex/projects/jimeng-desktop
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors (or only pre-existing errors unrelated to WorksPanel badge section).

---

### Task 2: Update `BatchCardGrid` badge

**Files:**
- Modify: `src/components/WorksPanel.tsx` lines ~832–836 (add `allDownloaded`) and lines ~929–939 (replace badge block)

**Context:** `BatchCardGrid` receives `record: BatchHistoryRecord`. `doneCount` and `failCount` are already derived at the top of the function. `record.totalTasks` is the total task count. `record.tasks` is the array of all tasks — each task has `outputFile?: string` which is non-empty when the file is downloaded locally.

- [ ] **Step 1: Add `allDownloaded` derived value**

Find this block (lines ~832–836):

```tsx
function BatchCardGrid({ record, onClick }: { record: BatchHistoryRecord; onClick: () => void }) {
  const { removeBatchHistory } = useStore();
  const doneCount = record.tasks.filter(t => t.status !== 'failed').length;
  const failCount = record.tasks.filter(t => t.status === 'failed').length;
  const cover = record.tasks.find(t => t.outputFile)?.outputFile;
```

Replace with:

```tsx
function BatchCardGrid({ record, onClick }: { record: BatchHistoryRecord; onClick: () => void }) {
  const { removeBatchHistory } = useStore();
  const doneCount = record.tasks.filter(t => t.status !== 'failed').length;
  const failCount = record.tasks.filter(t => t.status === 'failed').length;
  const allDownloaded = record.tasks.length > 0 && record.tasks.every(t => !!t.outputFile);
  const cover = record.tasks.find(t => t.outputFile)?.outputFile;
```

- [ ] **Step 2: Replace the badge block**

Find this block (lines ~929–939):

```tsx
          {/* Top-left badges: mode | info | status? */}
          <div className="absolute top-2 left-2 flex gap-1">
            {/* pill 1: mode */}
            <span className="px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur-sm text-[10px] text-white/60">批量</span>
            {/* pill 2: done count — neutral dark, same style as single's duration pill */}
            <span className="px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur-sm text-[10px] text-white/80">✓{doneCount}</span>
            {/* pill 3: failure count — colored solid bg, only when failures exist */}
            {failCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-md bg-error/80 text-[10px] text-white">{failCount} 失败</span>
            )}
          </div>
```

Replace with:

```tsx
          {/* Top-left badges: mode | quantity | status (always 3 pills) */}
          <div className="absolute top-2 left-2 flex gap-1">
            <span className="px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur-sm text-[10px] text-white/60">批量</span>
            <span className="px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur-sm text-[10px] text-white/80">{record.totalTasks} 个</span>
            {failCount > 0
              ? <span className="px-1.5 py-0.5 rounded-md bg-error/80 text-[10px] text-white">{failCount} 失败</span>
              : allDownloaded
                ? <span className="px-1.5 py-0.5 rounded-md bg-success/80 text-[10px] text-white">已下载</span>
                : <span className="px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur-sm text-[10px] text-white/80">已完成</span>
            }
          </div>
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors related to `allDownloaded` or the badge block.

- [ ] **Step 4: Restart Electron and visually verify**

```bash
pkill -9 -f "electron" 2>/dev/null
pkill -9 -f "vite" 2>/dev/null
lsof -ti:5173 | xargs kill -9 2>/dev/null
lsof -ti:5174 | xargs kill -9 2>/dev/null
sleep 1
npm run electron:dev > /tmp/electron-dev.log 2>&1 &
sleep 5
tail -10 /tmp/electron-dev.log
```

Expected: Vite on port 5173, Electron single window launched.

Check in the Works panel:
- Single card: `单个` | `1 个` | `已下载`(green) or `已完成`(dark) or `失败`(red) — pill 3 always present
- Batch card: `批量` | `N 个` | `已下载`(green) or `已完成`(dark) or `N 失败`(red) — pill 3 always present

- [ ] **Step 5: Commit**

```bash
git add src/components/WorksPanel.tsx
git commit -m "fix: unify badge content — mode|quantity|status on both card types

Single: [单个][1 个][已下载/已完成/失败]
Batch:  [批量][N 个][已下载/已完成/N 失败]

pill 3 is now always shown on both cards. Batch pill 2 changes
from ✓doneCount to totalTasks (quantity, not completion count).
allDownloaded = record.tasks.every(t => !!t.outputFile)."
```

- [ ] **Step 6: Push**

```bash
git push origin main
```
