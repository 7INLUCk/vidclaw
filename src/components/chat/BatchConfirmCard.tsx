import { CheckCircle, RefreshCw, ChevronDown } from 'lucide-react';
import { useStore, type BatchTaskItem } from '../../store';

export function BatchConfirmCard({
  tasks,
  batchName,
  description,
  onConfirm,
  onEdit,
  onTaskDelete,
  onBack,
}: {
  tasks: BatchTaskItem[];
  batchName: string;
  description: string;
  onConfirm: () => void;
  onEdit: () => void;
  onTaskEdit: (index: number) => void;
  onTaskDelete: (index: number) => void;
  onBack: () => void;
}) {
  const editingTaskIndex = useStore((s) => s.editingTaskIndex);
  const setEditingTaskIndex = useStore((s) => s.setEditingTaskIndex);
  const batchTasks = useStore((s) => s.batchTasks);
  const setBatchTasks = useStore((s) => s.setBatchTasks);

  const editingTask = editingTaskIndex !== null ? batchTasks[editingTaskIndex] : null;

  return (
    <div className="bg-surface-2 border border-border rounded-md overflow-hidden max-w-[90%] animate-fade-in-up">
      <div className="h-px bg-brand flex-shrink-0" />
      <div className="p-4 max-h-[400px] overflow-y-auto">
        <p className="text-xs text-brand font-medium mb-2 flex items-center gap-1.5">
          <span>📦</span> 批量任务确认
        </p>
        <p className="text-sm text-text-primary font-medium mb-1">{batchName}</p>
        {description && <p className="text-xs text-text-secondary mb-3">{description}</p>}
        <p className="text-[10px] text-text-muted uppercase tracking-wider mb-2">共 {tasks.length} 个任务</p>

        {/* 编辑表单 */}
        {editingTaskIndex !== null && editingTask && (
          <div className="bg-surface-3 rounded-lg p-3 mb-3 border border-brand">
            <p className="text-xs font-medium text-brand mb-2">✏️ 编辑任务 #{editingTaskIndex + 1}</p>
            <div className="space-y-2">
              <div>
                <label className="text-[10px] text-text-muted mb-1 block">描述</label>
                <textarea
                  value={editingTask.prompt}
                  onChange={(e) => {
                    const updated = [...batchTasks];
                    updated[editingTaskIndex] = { ...updated[editingTaskIndex], prompt: e.target.value };
                    setBatchTasks(updated);
                  }}
                  className="w-full bg-surface-2 border border-border rounded-md px-2 py-1.5 text-xs text-text-primary resize-none"
                  rows={2}
                />
              </div>
              <div className="flex gap-2">
                <div>
                  <label className="text-[10px] text-text-muted mb-1 block">时长</label>
                  <select
                    value={editingTask.duration}
                    onChange={(e) => {
                      const updated = [...batchTasks];
                      updated[editingTaskIndex] = { ...updated[editingTaskIndex], duration: parseInt(e.target.value) };
                      setBatchTasks(updated);
                    }}
                    className="bg-surface-2 border border-border rounded-md px-2 py-1.5 text-xs text-text-primary"
                  >
                    {[4, 5, 6, 8, 10, 12, 15].map((d) => (
                      <option key={d} value={d}>{d}s</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-text-muted mb-1 block">比例</label>
                  <select
                    value={editingTask.aspectRatio}
                    onChange={(e) => {
                      const updated = [...batchTasks];
                      updated[editingTaskIndex] = { ...updated[editingTaskIndex], aspectRatio: e.target.value };
                      setBatchTasks(updated);
                    }}
                    className="bg-surface-2 border border-border rounded-md px-2 py-1.5 text-xs text-text-primary"
                  >
                    {['9:16', '16:9', '1:1', '4:3', '3:4', '21:9'].map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => setEditingTaskIndex(null)}
                  className="px-3 py-1.5 text-xs bg-brand text-white rounded-md"
                >
                  ✓ 保存
                </button>
                <button
                  onClick={() => setEditingTaskIndex(null)}
                  className="px-3 py-1.5 text-xs text-text-secondary bg-surface-2 rounded-md"
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 任务列表 */}
        <div className="space-y-2 mb-4">
          {batchTasks.map((task, i) => (
            <div key={task.id} className={`bg-surface-3 rounded-md p-3 ${editingTaskIndex === i ? 'ring-1 ring-brand' : ''}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-text-primary mb-1">
                    #{i + 1} {task.expectedEffect || '视频生成'}
                  </p>
                  <p className="text-[11px] text-text-secondary line-clamp-2">{task.prompt}</p>
                  {task.reason && (
                    <p className="text-[10px] text-text-muted mt-1">💡 {task.reason}</p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button onClick={() => setEditingTaskIndex(i)} className="text-[10px] text-brand hover:underline">编辑</button>
                  <button onClick={() => onTaskDelete(i)} className="text-[10px] text-error hover:underline">删除</button>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-2 text-[10px] text-text-muted">
                <span>{task.duration}s</span>
                <span>·</span>
                <span>{task.aspectRatio}</span>
                {task.materials?.length > 0 && (
                  <><span>·</span><span>{task.materials.length} 素材</span></>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center gap-2">
          <button
            onClick={onConfirm}
            className="flex items-center gap-1.5 px-4 py-2 bg-brand hover:bg-brand/90 text-white text-xs font-medium rounded-md transition-all hover:-translate-y-0.5"
          >
            <CheckCircle size={14} />
            确认全部提交
          </button>
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 px-4 py-2 bg-surface-3 hover:bg-border text-text-secondary text-xs font-medium rounded-lg transition-all"
          >
            <ChevronDown size={14} className="rotate-180" />
            返回调整
          </button>
          <button
            onClick={onEdit}
            className="flex items-center gap-1.5 px-4 py-2 bg-surface-3 hover:bg-border text-text-secondary text-xs font-medium rounded-lg transition-all"
          >
            <RefreshCw size={14} />
            重新描述
          </button>
        </div>
      </div>
    </div>
  );
}
