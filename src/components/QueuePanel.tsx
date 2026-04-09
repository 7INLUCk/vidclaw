import { useMemo, useState } from 'react';
import { Loader2, Clock, Film, Image as ImageIcon, CheckCircle, XCircle, AlertTriangle, Trash2, RefreshCw, Download, Play } from 'lucide-react';
import { useStore, type TaskRecord } from '../store';

// 时间估算工具函数
function estimateRemainingTime(progress: number, startTime: number): string {
  if (progress <= 0 || progress >= 100) return ''; 
  const elapsed = (Date.now() - startTime) / 1000; // 秒
  const rate = progress / elapsed;
  if (rate <= 0) return '--';
  const remaining = (100 - progress) / rate;
  if (remaining < 60) return `${Math.round(remaining)}秒`;
  if (remaining < 3600) return `${Math.round(remaining / 60)}分钟`;
  return `${Math.round(remaining / 3600)}小时`;
}

const statusColor: Record<string, string> = {
  pending: 'text-text-muted',
  queued: 'text-warning',
  generating: 'text-brand',
  uploading: 'text-brand',
  completed: 'text-success',
  downloaded: 'text-success',
  failed: 'text-error',
};

const statusLabel: Record<string, string> = {
  pending: '等待中',
  queued: '排队中',
  generating: '生成中',
  uploading: '上传中',
  completed: '已完成',
  downloaded: '已下载',
  failed: '失败',
};

type FilterType = 'active' | 'completed' | 'failed' | 'all';

export function QueuePanel() {
  const { tasks } = useStore();
  const [filter, setFilter] = useState<FilterType>('active');

  // 分类任务
  const categorizedTasks = useMemo(() => {
    const active = tasks.filter(t => ['pending', 'queued', 'generating', 'uploading'].includes(t.status));
    const completed = tasks.filter(t => ['completed', 'downloaded'].includes(t.status));
    const failed = tasks.filter(t => t.status === 'failed');
    return { active, completed, failed, all: tasks };
  }, [tasks]);

  const filteredTasks = categorizedTasks[filter];
  const activeCount = categorizedTasks.active.length;
  const completedCount = categorizedTasks.completed.length;
  const failedCount = categorizedTasks.failed.length;

  // Tab 配置
  const tabs: { key: FilterType; label: string; count: number; icon?: React.ReactNode }[] = [
    { key: 'active', label: '进行中', count: activeCount, icon: activeCount > 0 ? <Loader2 size={12} className="animate-spin" /> : undefined },
    { key: 'completed', label: '已完成', count: completedCount, icon: completedCount > 0 ? <CheckCircle size={12} /> : undefined },
    { key: 'failed', label: '失败', count: failedCount, icon: failedCount > 0 ? <XCircle size={12} /> : undefined },
    { key: 'all', label: '全部', count: tasks.length },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Tab 切换 */}
      <div className="px-3 pt-3 pb-2 border-b border-border-subtle">
        <div className="flex items-center gap-1.5">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                filter === tab.key
                  ? 'bg-brand text-white'
                  : 'bg-transparent text-text-secondary hover:bg-surface-2 hover:text-text-primary'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {tab.count > 0 && (
                <span className={`px-1 py-0.5 rounded text-[10px] ${
                  filter === tab.key ? 'bg-white/20' : 'bg-surface-2'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* 任务列表 */}
      <div className="flex-1 overflow-y-auto px-3 py-2">
        {filteredTasks.length === 0 ? (
          <EmptyState filter={filter} />
        ) : (
          <div className="space-y-2">
            {filteredTasks.map(task => (
              <TaskCard key={task.id} task={task} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({ filter }: { filter: FilterType }) {
  const messages: Record<FilterType, { title: string; subtitle: string; icon: React.ReactNode }> = {
    active: { title: '队列为空', subtitle: '新任务会在这里显示', icon: <Loader2 size={20} className="text-text-muted" /> },
    completed: { title: '暂无已完成任务', subtitle: '完成的任务会在这里展示', icon: <CheckCircle size={20} className="text-success/40" /> },
    failed: { title: '暂无失败任务', subtitle: '失败的任务会在这里记录', icon: <XCircle size={20} className="text-error/40" /> },
    all: { title: '暂无任务', subtitle: '开始创作吧', icon: <Film size={20} className="text-text-muted" /> },
  };
  const msg = messages[filter];

  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center py-8">
        <div className="w-12 h-12 rounded-md bg-surface-2 flex items-center justify-center mx-auto mb-3">
          {msg.icon}
        </div>
        <p className="text-text-primary text-sm font-medium">{msg.title}</p>
        <p className="text-text-muted text-xs mt-1">{msg.subtitle}</p>
      </div>
    </div>
  );
}

function TaskCard({ task }: { task: TaskRecord }) {
  const { retryTask, deleteTask, downloadTask } = useStore();
  const isGenerating = task.status === 'generating';
  const isCompleted = ['completed', 'downloaded'].includes(task.status);
  const isFailed = task.status === 'failed';
  const progress = task.progress ?? 0;
  const startTime = task.startTime ?? Date.now();
  const remainingTime = isGenerating && progress > 0 ? estimateRemainingTime(progress, startTime) : '';

  return (
    <div className={`bg-surface-1 border rounded-md p-3 transition-colors ${
      isCompleted ? 'border-success/30' :
      isFailed ? 'border-error/30' :
      'border-border'
    }`}>
      <div className="flex items-start gap-2.5">
        {/* Icon */}
        <div className={`w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 ${
          isCompleted ? 'bg-success/10' :
          isFailed ? 'bg-error/10' :
          'bg-surface-2'
        }`}>
          {task.type === 'image' ? (
            <ImageIcon size={16} className={isFailed ? 'text-error' : 'text-text-muted'} />
          ) : (
            <Film size={16} className={isFailed ? 'text-error' : 'text-text-muted'} />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-text-primary line-clamp-2 leading-tight">{task.prompt}</p>

          {/* Status row */}
          <div className="flex items-center gap-1.5 mt-1.5">
            {isGenerating && <Loader2 size={12} className="animate-spin text-brand" />}
            {isCompleted && <CheckCircle size={12} className="text-success" />}
            {isFailed && <AlertTriangle size={12} className="text-error" />}
            <span className={`text-xs font-medium ${statusColor[task.status]}`}>
              {statusLabel[task.status]}
            </span>
            {isGenerating && progress > 0 && (
              <>
                <span className="text-xs text-text-muted">{progress}%</span>
                {remainingTime && (
                  <span className="text-xs text-text-muted flex items-center gap-0.5">
                    <Clock size={10} />
                    {remainingTime}
                  </span>
                )}
              </>
            )}
            {isFailed && task.error && (
              <span className="text-xs text-error/70 truncate max-w-[180px]">{task.error}</span>
            )}
          </div>

          {/* Progress bar */}
          {isGenerating && progress > 0 && (
            <div className="mt-2">
              <div className="h-1 bg-surface-3 rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {isFailed && (
            <button
              onClick={() => retryTask?.(task.id)}
              className="p-1 rounded-md hover:bg-brand/15 hover:text-brand text-text-muted transition-colors"
              title="重试"
            >
              <RefreshCw size={14} />
            </button>
          )}
          {isCompleted && !task.downloaded && task.filePath && (
            <button
              onClick={() => downloadTask?.(task.id)}
              className="p-1 rounded-md hover:bg-success/15 hover:text-success text-text-muted transition-colors"
              title="下载"
            >
              <Download size={14} />
            </button>
          )}
          {isCompleted && task.filePath && (() => {
            const filePath = task.filePath;
            return (
              <button
                onClick={() => window.api.openFile?.(filePath)}
              className="p-1 rounded-md hover:bg-brand/15 hover:text-brand text-text-muted transition-colors"
              title="打开文件"
            >
              <Play size={14} />
            </button>
            );
          })()}
          <button
            onClick={() => deleteTask?.(task.id)}
            className="p-1 rounded-md hover:bg-error/15 hover:text-error text-text-muted transition-colors"
            title="删除"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}