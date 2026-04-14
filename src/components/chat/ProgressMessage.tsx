import { ArrowUp, CheckCircle, AlertTriangle } from 'lucide-react';
import type { Message } from '../../store';

export function ProgressMessage({ msg }: { msg: Message }) {
  const data = msg.data as any;
  const progressType = data?.progressType || 'generating';
  const percent = data?.percent;
  const error = data?.error;

  if (progressType === 'uploading') {
    return (
      <div className="flex justify-start animate-fade-in">
        <div className="bg-surface-2 border border-border-subtle rounded-md px-4 py-3 max-w-xs">
          <div className="flex items-center gap-2.5">
            <ArrowUp size={16} className="text-brand" />
            <span className="text-xs text-text-secondary">{msg.content || '正在上传素材...'}</span>
          </div>
        </div>
      </div>
    );
  }

  if (progressType === 'completed') {
    return (
      <div className="flex justify-start animate-fade-in">
        <div className="bg-success/10 border border-success/20 rounded-md px-4 py-3 max-w-xs">
          <div className="flex items-center gap-2.5">
            <CheckCircle size={16} className="text-success animate-check-pop" />
            <span className="text-xs text-success font-medium">{msg.content || '生成完成'}</span>
          </div>
        </div>
      </div>
    );
  }

  if (progressType === 'failed') {
    return (
      <div className="flex justify-start animate-fade-in">
        <div className="bg-error/10 border border-error/20 rounded-md px-4 py-3 max-w-xs animate-shake">
          <div className="flex items-center gap-2.5 mb-2">
            <AlertTriangle size={16} className="text-error" />
            <span className="text-xs text-error font-medium">{msg.content || '生成失败'}</span>
          </div>
          {error && <p className="text-[11px] text-error/70 mb-2">{error}</p>}
          <button
            onClick={data?.onRetry}
            className="text-[11px] text-error hover:text-error/80 font-medium underline underline-offset-2"
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start animate-fade-in">
      <div className="bg-surface-2 border border-border-subtle rounded-md px-4 py-3 max-w-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-text-secondary">{msg.content || '正在生成...'}</span>
          {percent !== undefined && (
            <span className="text-[11px] text-brand font-mono font-medium">{percent}%</span>
          )}
        </div>
      </div>
    </div>
  );
}
