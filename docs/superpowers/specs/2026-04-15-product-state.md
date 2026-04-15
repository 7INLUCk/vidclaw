# jimeng-desktop 产品状态文档

> 这是 Superpowers 的产品基线文档。记录所有已完成功能的设计决策。
> 新功能完成后，在本文件末尾追加，或新建独立 spec 文件。

## 产品定位

Electron 桌面应用，封装即梦（Dreamina/Seedance）AI 视频生成能力。
目标用户：需要批量/高效生成 AI 视频的创作者。

---

## 已完成功能设计

### 双链路生成系统（稳定）

**设计决策：**
- Seedance 链路：通过 `dreamina` CLI 提交，支持单任务和批量任务
- Kling O1 链路：通过 Coze workflow（PAT token）提交，仅支持单任务
- 并发上限：Seedance 同账号最多 2 个任务同时生成（`MAX_CONCURRENT_JIMENG = 2`）

**不能改的地方：**
- 两条链路完全独立，不要混用 IPC 通道
- Kling O1 的 PAT token 在 `electron/coze.js`，不要硬编码到前端

---

### 认证系统（稳定）

**设计决策：**
- 邮箱登录仅允许 `@miaoboai.com` 后缀（内部用户限制）
- `auth: AuthUser | null` 为 null 时 App.tsx 显示 AuthModal，完全阻断操作
- 积分余额 < 50 显示顶部警告横幅，引导充值

---

### 批量任务系统（稳定，2026-04-15 完成）

**设计决策：**
- `BatchTaskManager`（`electron/services/batch-task-manager.js`）管理全生命周期
- `createBatch()` 无条件重置旧批次，解决"已在运行中"错误
- 轮询用 `setTimeout` 链（非 setInterval）：5s → Queuing 时 180s → 其他 30s
- 连续 10 次失败自动标记 `failed`，防止 ret=2008 死循环

**队列位置显示逻辑（关键，容易搞错）：**
```
Dreamina CLI 返回的 queue_status 字段含义：
- "Generating" = 正在生成，不是排队，不显示位数
- "Queuing"    = 在服务端排队，queue_idx 才是真实位置（0-based，显示时 +1）
```

**App 启动恢复（2026-04-15 修复）：**
- `_onBatchComplete()` 必须调用 `_persistTasks()` 保存 running: false
- App.tsx init() 恢复批次时，若全部完成且不在 batchHistory 中，自动补录

---

### 生成队列 UI（稳定，2026-04-15 完成）

**设计决策：**
- 队列区域放在 WorksPanel 顶部，已完成作品列表上方
- 批量任务显示为**单个卡片**（BatchQueueCard），与单任务 QueueCard 同等尺寸
- 卡片默认折叠子任务，点击"查看N条明细"展开
- 无折叠数量上限，所有在排任务全部显示

**统一状态标签：**
| 状态 | 显示文字 | 颜色 |
|------|---------|------|
| 未提交 | 待提交 | text-text-muted |
| 提交中（无队列信息）| 提交中 | text-brand |
| queueStatus=Queuing | 排队第N位 | text-warning |
| queueStatus=Generating | 生成中 | text-brand |
| 完成 | 已完成/完成 | text-success |
| 失败 | 失败 | text-error |

---

## 变更记录

| 日期 | 变更 | commit |
|------|------|--------|
| 2026-04-15 | 批量任务队列位置显示、重启恢复、BatchQueueCard 重设计 | d9e5c24 |
| 2026-04-15 | CLAUDE.md + PreCompact Hook + 本文档 | fb15b6e |
| 2026-04-14 | 基础功能完整性修复（7个功能修复）| b953742 |
| 2026-04-14 | Kling O1 + 积分 + 邮箱认证 | 51443f8 |
| 2026-04-14 | Skills 技能库功能 | 5b4cff3 |
