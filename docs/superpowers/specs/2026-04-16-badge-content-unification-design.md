# Badge Content Unification Design

## Goal

Unify the left-top thumbnail badge content across `SingleCardGrid` and `BatchCardGrid` so both cards use the same information categories in the same pill slots.

## Problem

Current state:

| | pill 1 | pill 2 | pill 3 |
|---|---|---|---|
| SingleCardGrid | `单个` | `4s` (duration) | `已下载` / `失败` |
| BatchCardGrid | `批量` | `✓2` (count) | `1 失败` |

Pill 2 and pill 3 show different *types* of information — `4s` vs `✓2` are different categories — making the two cards feel like separate design systems.

## Design

### Unified Badge Structure

Both cards follow the same three-pill schema:

| Slot | Role | Single | Batch |
|---|---|---|---|
| pill 1 | Mode label | `单个` | `批量` |
| pill 2 | Quantity | `1 个` | `N 个` (totalTasks) |
| pill 3 | Status | always shown, see below | always shown, see below |

### Pill 3 Status Logic

**SingleCardGrid** — derive from `task.status`:
- `status === 'failed'` → `失败` (red solid)
- `status === 'downloaded'` → `已下载` (green solid)
- otherwise (completed, no local file) → `已完成` (dark neutral)

**BatchCardGrid** — derive from `record.tasks`:
- `failCount > 0` → `{failCount} 失败` (red solid) — highest priority
- all tasks have `outputFile` (non-empty string) → `已下载` (green solid)
- otherwise → `已完成` (dark neutral)

"All tasks downloaded" condition: `record.tasks.every(t => !!t.outputFile)`

### Color / Style Tokens

All pills share the same base: `px-1.5 py-0.5 rounded-md text-[10px]`

| Status | Background | Text |
|---|---|---|
| `已下载` | `bg-success/80` | `text-white` |
| `已完成` | `bg-black/60 backdrop-blur-sm` | `text-white/80` |
| `失败` / `N 失败` | `bg-error/80` | `text-white` |
| pill 1 (mode) | `bg-black/60 backdrop-blur-sm` | `text-white/60` |
| pill 2 (quantity) | `bg-black/60 backdrop-blur-sm` | `text-white/80` |

## Files Changed

- `src/components/WorksPanel.tsx` — `SingleCardGrid` badge section (lines ~548–562) and `BatchCardGrid` badge section (lines ~929–939)

## What Does NOT Change

- Info section (Row 1/2/3) below the thumbnail — untouched
- Action row buttons — untouched
- List-view cards (`SingleCardList`, `BatchCardList`) — out of scope
- Any backend / IPC logic
