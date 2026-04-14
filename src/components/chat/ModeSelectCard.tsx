import { FileStack, Layers } from 'lucide-react';
import type { TaskMode } from '../../store';

export function ModeSelectCard({ onSelect }: { onSelect: (mode: TaskMode) => void }) {
  return (
    <div className="bg-surface-2 border border-border rounded-md overflow-hidden max-w-[85%] animate-fade-in-up">
      <div className="h-px bg-brand flex-shrink-0" />
      <div className="p-4">
        <p className="text-xs text-brand font-medium mb-3 flex items-center gap-1.5">
          <span>🎯</span> 选择任务模式
        </p>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => onSelect('single')}
            className="flex flex-col items-center gap-2 p-4 bg-surface-3 hover:bg-border rounded-md transition-all hover:-translate-y-0.5"
          >
            <FileStack size={24} className="text-brand" />
            <span className="text-sm font-medium">单个任务</span>
            <span className="text-xs text-text-muted">快速生成一个视频</span>
          </button>
          <button
            onClick={() => onSelect('batch')}
            className="flex flex-col items-center gap-2 p-4 bg-surface-3 hover:bg-border rounded-md transition-all hover:-translate-y-0.5"
          >
            <Layers size={24} className="text-brand" />
            <span className="text-sm font-medium">批量任务</span>
            <span className="text-xs text-text-muted">批量生成多个视频</span>
          </button>
        </div>
      </div>
    </div>
  );
}
