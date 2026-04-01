import { Play, Pause, Trash2, Edit3, Download, FolderOpen, Clock, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { useStore, type BatchTaskItem, type QueueTask } from '../store';

// ── Task Status Badge ──
function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, { bg: string; text: string; icon?: React.ReactNode }> = {
    pending: { bg: 'bg-surface-3', text: 'text-text-secondary', icon: <Clock size={12} /> },
    submitted: { bg: 'bg-blue-500/20', text: 'text-blue-400', icon: <Loader2 size={12} className="animate-spin" /> },
    generating: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', icon: <Loader2 size={12} className="animate-spin" /> },
    completed: { bg: 'bg-green-500/20', text: 'text-green-400', icon: <CheckCircle size={12} /> },
    downloaded: { bg: 'bg-brand/20', text: 'text-brand', icon: <Download size={12} /> },
    failed: { bg: 'bg-red-500/20', text: 'text-red-400', icon: <XCircle size={12} /> },
  };

  const style = styles[status] || styles.pending;
  const statusText: Record<string, string> = {
    pending: '等待中',
    submitted: '已提交',
    generating: '生成中',
    completed: '已完成',
    downloaded: '已下载',
    failed: '失败',
  };

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${style.bg} ${style.text}`}>
      {style.icon}
      {statusText[status] || status}
    </span>
  );
}

// ── Task Item Card ──
function TaskItemCard({
  task,
  index,
  onEdit,
  onDelete,
  onOpenFolder,
}: {
  task: BatchTaskItem;
  index: number;
  onEdit?: () => void;
  onDelete?: () => void;
  onOpenFolder?: () => void;
}) {
  const isEditable = task.status === 'pending';
  const isDownloaded = task.status === 'downloaded';

  return (
    <div className="bg-surface-2 border border-border rounded-lg p-3 hover:border-border-hover transition-colors">
      <div className="flex items-start justify-between gap-2">
        {/* 左侧：序号 + 状态 */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="w-6 h-6 rounded-full bg-brand/20 text-brand text-xs font-bold flex items-center justify-center">
            {index}
          </span>
          <StatusBadge status={task.status} />
        </div>

        {/* 右侧：操作按钮 */}
        <div className="flex items-center gap-1">
          {isEditable && onEdit && (
            <button
              onClick={onEdit}
              className="p-1.5 rounded-md hover:bg-surface-3 text-text-muted hover:text-text-primary transition-colors"
              title="编辑任务"
            >
              <Edit3 size={14} />
            </button>
          )}
          {isEditable && onDelete && (
            <button
              onClick={onDelete}
              className="p-1.5 rounded-md hover:bg-red-500/20 text-text-muted hover:text-red-400 transition-colors"
              title="删除任务"
            >
              <Trash2 size={14} />
            </button>
          )}
          {isDownloaded && onOpenFolder && (
            <button
              onClick={onOpenFolder}
              className="p-1.5 rounded-md hover:bg-surface-3 text-text-muted hover:text-brand transition-colors"
              title="打开文件位置"
            >
              <FolderOpen size={14} />
            </button>
          )}
        </div>
      </div>

      {/* 提示词 */}
      <p className="text-xs text-text-primary mt-2 line-clamp-2">{task.prompt}</p>

      {/* 理由/测试目的 */}
      {task.reason && (
        <p className="text-[10px] text-text-muted mt-1">💡 {task.reason}</p>
      )}

      {/* 参数 */}
      <div className="flex items-center gap-2 mt-2 text-[10px] text-text-muted">
        <span>{task.duration}s</span>
        <span>·</span>
        <span>{task.aspectRatio}</span>
        {task.materials?.length > 0 && (
          <>
            <span>·</span>
            <span>{task.materials.length} 素材</span>
          </>
        )}
      </div>

      {/* 错误信息 */}
      {task.error && (
        <p className="text-[10px] text-red-400 mt-1">❌ {task.error}</p>
      )}

      {/* 下载路径 */}
      {task.outputFile && (
        <p className="text-[10px] text-brand mt-1 truncate" title={task.outputFile}>
          📁 {task.outputFile.split('/').pop()}
        </p>
      )}
    </div>
  );
}

// ── Batch Task Panel ──
export function BatchTaskPanel() {
  const { batchTasks, batchInfo, taskMode, setBatchTasks, setBatchInfo } = useStore();

  if (taskMode !== 'batch' || batchTasks.length === 0) {
    return null;
  }

  // 分类任务
  const runningTasks = batchTasks.filter(t => ['submitted', 'generating'].includes(t.status));
  const pendingTasks = batchTasks.filter(t => t.status === 'pending');
  const completedTasks = batchTasks.filter(t => ['completed', 'downloaded'].includes(t.status));
  const failedTasks = batchTasks.filter(t => t.status === 'failed');

  return (
    <div className="h-full flex flex-col bg-surface-1 border-l border-border">
      {/* Header */}
      <div className="p-4 border-b border-border shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
              <span className="text-lg">📋</span>
              {batchInfo?.name || '批量任务'}
            </h2>
            {batchInfo?.description && (
              <p className="text-xs text-text-muted mt-0.5">{batchInfo.description}</p>
            )}
          </div>
          <div className="text-right">
            <p className="text-xs text-text-secondary">
              {batchInfo?.completedTasks || 0} / {batchInfo?.totalTasks || batchTasks.length}
            </p>
            <div className="w-24 h-1.5 bg-surface-3 rounded-full mt-1 overflow-hidden">
              <div
                className="h-full bg-brand-gradient transition-all duration-300"
                style={{
                  width: `${((batchInfo?.completedTasks || 0) / (batchInfo?.totalTasks || 1)) * 100}%`,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Task Lists */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Running */}
        {runningTasks.length > 0 && (
          <section>
            <h3 className="text-[10px] text-text-muted uppercase tracking-wider mb-2 flex items-center gap-1">
              <Loader2 size={10} className="animate-spin text-yellow-400" />
              正在执行 ({runningTasks.length})
            </h3>
            <div className="space-y-2">
              {runningTasks.map((task, i) => (
                <TaskItemCard
                  key={task.id}
                  task={task}
                  index={batchTasks.indexOf(task) + 1}
                />
              ))}
            </div>
          </section>
        )}

        {/* Pending */}
        {pendingTasks.length > 0 && (
          <section>
            <h3 className="text-[10px] text-text-muted uppercase tracking-wider mb-2 flex items-center gap-1">
              <Clock size={10} />
              等待中 ({pendingTasks.length})
            </h3>
            <div className="space-y-2">
              {pendingTasks.map((task) => (
                <TaskItemCard
                  key={task.id}
                  task={task}
                  index={batchTasks.indexOf(task) + 1}
                  onEdit={() => {
                    // TODO: 打开编辑弹窗
                    console.log('Edit task', task.id);
                  }}
                  onDelete={() => {
                    window.api.deleteBatchTask(task.id);
                    // 刷新任务列表
                    window.api.getBatchStatus().then((result) => {
                      if (result.success && result.tasks) {
                        useStore.getState().setBatchTasks(result.tasks);
                      }
                    });
                  }}
                />
              ))}
            </div>
          </section>
        )}

        {/* Completed */}
        {completedTasks.length > 0 && (
          <section>
            <h3 className="text-[10px] text-text-muted uppercase tracking-wider mb-2 flex items-center gap-1">
              <CheckCircle size={10} className="text-green-400" />
              已完成 ({completedTasks.length})
            </h3>
            <div className="space-y-2">
              {completedTasks.map((task) => (
                <TaskItemCard
                  key={task.id}
                  task={task}
                  index={batchTasks.indexOf(task) + 1}
                  onOpenFolder={() => {
                    if (task.outputFile) {
                      window.api.openDownloadDir();
                    }
                  }}
                />
              ))}
            </div>
          </section>
        )}

        {/* Failed */}
        {failedTasks.length > 0 && (
          <section>
            <h3 className="text-[10px] text-text-muted uppercase tracking-wider mb-2 flex items-center gap-1">
              <XCircle size={10} className="text-red-400" />
              失败 ({failedTasks.length})
            </h3>
            <div className="space-y-2">
              {failedTasks.map((task) => (
                <TaskItemCard
                  key={task.id}
                  task={task}
                  index={batchTasks.indexOf(task) + 1}
                />
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Footer Actions */}
      <div className="p-4 border-t border-border shrink-0 space-y-2">
        <button
          onClick={() => window.api.openDownloadDir()}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-surface-2 hover:bg-surface-3 border border-border rounded-lg text-xs font-medium transition-colors"
        >
          <FolderOpen size={14} />
          打开下载目录
        </button>
        {batchInfo?.status === 'running' && (
          <button
            onClick={() => window.api.stopBatch()}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-xs font-medium transition-colors"
          >
            <Pause size={14} />
            停止批量任务
          </button>
        )}
        {pendingTasks.length > 0 && batchInfo?.status !== 'running' && (
          <button
            onClick={() => window.api.startBatch()}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-brand-gradient hover:shadow-[var(--shadow-brand)] text-white rounded-lg text-xs font-medium transition-all hover:-translate-y-0.5"
          >
            <Play size={14} />
            开始执行
          </button>
        )}
      </div>
    </div>
  );
}

// ── Mini Status Bar (在对话界面顶部显示) ──
export function BatchStatusMini() {
  const { batchTasks, batchInfo, taskMode, activePanel, setActivePanel } = useStore();

  if (taskMode !== 'batch' || !batchInfo) return null;

  const completed = batchTasks.filter(t => ['completed', 'downloaded'].includes(t.status)).length;
  const total = batchTasks.length;
  const running = batchTasks.filter(t => ['submitted', 'generating'].includes(t.status)).length;

  return (
    <div className="px-4 py-2 bg-surface-2 border-b border-border flex items-center justify-between text-xs">
      <div className="flex items-center gap-3">
        <span className="text-text-secondary">📦 {batchInfo.name}</span>
        <span className="text-text-muted">|</span>
        <span className="text-brand">{completed}/{total} 完成</span>
        {running > 0 && (
          <>
            <span className="text-text-muted">|</span>
            <span className="text-yellow-400 flex items-center gap-1">
              <Loader2 size={10} className="animate-spin" />
              {running} 个执行中
            </span>
          </>
        )}
      </div>
      <button
        onClick={() => setActivePanel('results')}
        className="text-brand hover:underline"
      >
        查看详情 →
      </button>
    </div>
  );
}