import { useMemo, useState } from 'react';
import { Loader2, Clock, Film, Image as ImageIcon, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { useStore, type TaskRecord } from '../store';

const statusColor: Record<string, string> = {
  pending: 'oklch(0.65 0.02 260)',
  queued: 'oklch(0.75 0.16 75)',
  generating: 'oklch(0.65 0.25 270)',
  uploading: 'oklch(0.65 0.25 270)',
  completed: 'oklch(0.60 0.18 145)',
  downloaded: 'oklch(0.60 0.18 145)',
  failed: 'oklch(0.55 0.22 25)',
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
      <div className="px-4 pt-4 pb-2 border-b border-border-subtle">
        <div className="flex items-center gap-2">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                filter === tab.key
                  ? 'bg-brand text-white'
                  : 'bg-surface-2 text-text-secondary hover:bg-surface-3 hover:text-text-primary'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {tab.count > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                  filter === tab.key ? 'bg-white/20' : 'bg-surface-3'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* 任务列表 */}
      <div className="flex-1 overflow-y-auto p-4">
        {filteredTasks.length === 0 ? (
          <EmptyState filter={filter} />
        ) : (
          <div className="max-w-2xl mx-auto space-y-3">
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
  const messages: Record<FilterType, { title: string; subtitle: string }> = {
    active: { title: '队列为空', subtitle: '新任务会在这里显示' },
    completed: { title: '暂无已完成任务', subtitle: '完成的任务会在这里展示' },
    failed: { title: '暂无失败任务', subtitle: '失败的任务会在这里记录' },
    all: { title: '暂无任务', subtitle: '开始创作吧' },
  };

  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 rounded-full bg-surface-2 flex items-center justify-center mx-auto mb-4">
          <Clock size={28} className="text-text-muted" />
        </div>
        <p className="text-text-muted text-sm">{messages[filter].title}</p>
        <p className="text-text-disabled text-xs mt-1">{messages[filter].subtitle}</p>
      </div>
    </div>
  );
}

function TaskCard({ task }: { task: TaskRecord }) {
  const isGenerating = task.status === 'generating';
  const isCompleted = ['completed', 'downloaded'].includes(task.status);
  const isFailed = task.status === 'failed';
  const progress = task.progress ?? 0;

  return (
    <div className={`bg-surface-1 border rounded-xl p-4 transition-all ${
      isCompleted ? 'border-success/20' :
      isFailed ? 'border-error/20' :
      'border-border'
    }`}>
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
          isCompleted ? 'bg-success/10' :
          isFailed ? 'bg-error/10' :
          'bg-surface-2'
        }`}>
          {task.type === 'image' ? (
            <ImageIcon size={18} className={isFailed ? 'text-error' : 'text-text-muted'} />
          ) : (
            <Film size={18} className={isFailed ? 'text-error' : 'text-text-muted'} />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-text-primary line-clamp-2">{task.prompt}</p>

          {/* Status */}
          <div className="flex items-center gap-2 mt-2">
            {isGenerating && <Loader2 size={12} className="animate-spin text-brand" />}
            {isCompleted && <CheckCircle size={12} className="text-success" />}
            {isFailed && <AlertTriangle size={12} className="text-error" />}
            <span
              className="text-xs font-medium"
              style={{ color: statusColor[task.status] }}
            >
              {statusLabel[task.status]}
            </span>
            {isGenerating && progress > 0 && (
              <span className="text-xs text-text-muted">{progress}%</span>
            )}
            {isFailed && task.error && (
              <span className="text-xs text-error/70 truncate max-w-[200px]">{task.error}</span>
            )}
          </div>

          {/* Progress bar */}
          {isGenerating && progress > 0 && (
            <div className="mt-2 h-1 bg-surface-3 rounded-full overflow-hidden">
              <div
                className="h-full bg-brand transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}