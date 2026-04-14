import { Download, Play, RefreshCw, CheckCircle } from 'lucide-react';
import { useStore, type Message, type GuidedStep, type TaskMode, type AiRewriteData, type BatchConfirmData, type ClarificationData, type QrCodeData, type LoginErrorData, type ResultData } from '../../store';
import { ProgressMessage } from './ProgressMessage';
import { GuideButton } from './ParameterPanel';
import { ModeSelectCard } from './ModeSelectCard';
import { BatchConfirmCard } from './BatchConfirmCard';
import { ConfirmCard, MaterialTag } from './ConfirmCard';
import { ClarificationCard } from './ClarificationCard';

export function MessageBubble({
  msg, onDownload, onGuideClick, onConfirm, onEdit, onRetry, task,
  onDurationChange, onRatioChange, onModelChange, onEditMaterial,
  setGuidedStep, setMessages, setTaskMode, onCancelLogin, onClarificationConfirm,
}: {
  msg: Message;
  onDownload?: () => void;
  onGuideClick?: () => void;
  onConfirm?: () => void;
  onEdit?: () => void;
  onRetry?: () => void;
  task?: AiRewriteData;
  onDurationChange?: (d: number) => void;
  onRatioChange?: (r: string) => void;
  onModelChange?: (m: string) => void;
  onEditMaterial?: (index: number, newDesc: string) => void;
  setGuidedStep?: (step: GuidedStep) => void;
  setMessages?: (fn: (prev: Message[]) => Message[]) => void;
  setTaskMode?: (mode: TaskMode) => void;
  onCancelLogin?: () => void;
  onClarificationConfirm?: (selections: Record<string, string>) => void;
}) {
  const isUser = msg.role === 'user';
  const isSystem = msg.role === 'system';

  if (isSystem) {
    return (
      <div className="flex justify-center">
        <p className="text-[11px] text-text-muted px-3 py-1">
          {msg.content}
        </p>
      </div>
    );
  }

  if (msg.type === 'progress') {
    return <ProgressMessage msg={msg} />;
  }

  if (msg.type === 'guide-button' && onGuideClick) {
    return (
      <div className="flex justify-start">
        <div className="max-w-[85%] rounded-md px-4 py-3 bg-surface-2 border border-border-subtle text-text-primary">
          <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
          <div className="mt-3">
            <GuideButton label="准备好了" onClick={onGuideClick} />
          </div>
        </div>
      </div>
    );
  }

  if (msg.type === 'qr-code' && (msg.data as QrCodeData)?.qrBase64) {
    const qrData = msg.data as QrCodeData;
    const isLoggedIn = useStore.getState().isLoggedIn;
    return (
      <div className="flex justify-start">
        <div className="max-w-[85%] rounded-md px-4 py-3 bg-surface-2 border border-border-subtle text-text-primary">
          <p className="text-sm whitespace-pre-wrap leading-relaxed mb-3">{msg.content}</p>
          <img
            src={qrData.qrBase64}
            alt="登录二维码"
            className="w-48 h-48 mx-auto border border-border rounded-md"
          />
          <p className="text-xs text-text-muted mt-2 text-center">打开抖音 APP 扫码授权</p>
          <div className="flex items-center justify-center gap-3 mt-3">
            <button
              onClick={onCancelLogin}
              className="px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary bg-surface-3 hover:bg-border rounded-lg transition-all"
            >
              取消登录
            </button>
            {isLoggedIn && (
              <button
                onClick={() => useStore.getState().setGuidedStep('checking-login')}
                className="px-3 py-1.5 text-xs text-brand hover:text-brand bg-brand/10 hover:bg-brand/20 rounded-lg transition-all"
              >
                切换账号
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (msg.type === 'login-error') {
    const errData = msg.data as LoginErrorData | undefined;
    return (
      <div className="flex justify-start">
        <div className="max-w-[85%] rounded-md px-4 py-3 bg-surface-2 border border-error/30 text-text-primary">
          <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
          {errData?.isVipError && (
            <a
              href="https://jimeng.jianying.com"
              target="_blank"
              className="inline-flex items-center gap-1 mt-3 text-xs text-brand hover:text-brand transition-colors"
            >
              前往即梦网页升级会员 →
            </a>
          )}
          {errData?.canRetry && (
            <button
              onClick={() => useStore.getState().setGuidedStep('welcome')}
              className="mt-3 px-4 py-2 text-xs rounded-lg bg-surface-3 hover:bg-border border border-border-subtle transition-colors"
            >
              重新登录
            </button>
          )}
        </div>
      </div>
    );
  }

  if (msg.type === 'mode-select') {
    return (
      <div className="flex justify-start">
        <ModeSelectCard
          onSelect={(mode) => {
            useStore.getState().setTaskMode(mode);
            if (mode === 'batch') {
              useStore.getState().setGuidedStep('batch-collecting');
              useStore.getState().addMessage({
                id: Date.now().toString() + '_batch_question',
                role: 'assistant',
                content: '好的,批量任务模式。请告诉我:\n\n1. 这次批量测试的目标是什么?\n2. 你想生成多少个视频?\n3. 每个视频的测试重点分别是什么?',
                timestamp: new Date(),
              });
            } else {
              useStore.getState().setGuidedStep('logged-in-ready');
              useStore.getState().addMessage({
                id: Date.now().toString() + '_single_ready',
                role: 'assistant',
                content: '好的,单个任务模式。请描述你想生成的视频。',
                timestamp: new Date(),
              });
            }
          }}
        />
      </div>
    );
  }

  if (msg.type === 'batch-confirm' && (msg.data as BatchConfirmData)?.tasks) {
    const data = msg.data as BatchConfirmData;
    return (
      <div className="flex justify-start">
        <BatchConfirmCard
          tasks={data.tasks}
          batchName={data.batchName || '批量任务'}
          description={data.description || ''}
          onConfirm={onConfirm || (() => {})}
          onEdit={onEdit || (() => {})}
          onTaskEdit={(index) => console.log('Edit task', index)}
          onTaskDelete={(index) => console.log('Delete task', index)}
          onBack={() => {
            setGuidedStep?.('logged-in-ready');
            setMessages?.(prev => prev.filter(m => m.id !== msg.id));
            setTaskMode?.('single');
          }}
        />
      </div>
    );
  }

  if (msg.type === 'clarification' && (msg.data as ClarificationData)?.questions) {
    const data = msg.data as ClarificationData;
    return (
      <div className="flex justify-start">
        <ClarificationCard
          data={data}
          onConfirm={(selections) => onClarificationConfirm?.(selections)}
          onEditMaterial={onEditMaterial}
        />
      </div>
    );
  }

  if (msg.type === 'ai-rewrite' && task && onConfirm) {
    return (
      <div className="flex justify-start">
        <ConfirmCard
          task={task}
          onConfirm={onConfirm}
          onEdit={onEdit!}
          onBack={() => {
            setGuidedStep?.('task-drafting');
            setMessages?.(prev => prev.filter(m => m.id !== msg.id));
          }}
          hasFiles={task.hasFiles}
          selectedModel={task.selectedModel}
          selectedDuration={task.selectedDuration}
          selectedRatio={task.selectedRatio}
          materials={task.materials}
          onDurationChange={onDurationChange}
          onRatioChange={onRatioChange}
          onModelChange={onModelChange}
          onEditMaterial={onEditMaterial}
        />
      </div>
    );
  }

  // User message — compact, right-aligned
  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[72%] bg-surface-3 rounded-2xl rounded-br-sm px-4 py-2.5">
          <p className="text-sm text-text-primary whitespace-pre-wrap leading-relaxed">{msg.content}</p>
          <p className="text-[10px] text-text-disabled mt-1 text-right">
            {msg.timestamp.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      </div>
    );
  }

  // Error message
  if (msg.type === 'error') {
    return (
      <div className="flex justify-start">
        <div className="max-w-[85%] bg-error/8 border border-error/25 rounded-lg px-4 py-3">
          <p className="text-sm text-text-primary whitespace-pre-wrap leading-relaxed">{msg.content}</p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="mt-2 flex items-center gap-1.5 text-xs text-error hover:text-error/80 font-medium transition-colors"
            >
              <RefreshCw size={11} />
              重试
            </button>
          )}
          <p className="text-[10px] text-text-disabled mt-1.5">
            {msg.timestamp.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      </div>
    );
  }

  // Result message with actions
  if (msg.type === 'result' && msg.data) {
    return (
      <div className="flex justify-start">
        <div className="max-w-[85%]">
          <p className="text-sm text-text-primary whitespace-pre-wrap leading-relaxed">{msg.content}</p>
          <div className="flex items-center gap-3 mt-2.5">
            {(msg.data as ResultData).url && (
              <button
                onClick={() => useStore.getState().setPreviewUrl((msg.data as ResultData).url)}
                className="flex items-center gap-1.5 text-xs text-brand hover:text-brand-light font-medium transition-colors"
              >
                <Play size={12} />
                预览
              </button>
            )}
            <button
              onClick={onDownload}
              className="flex items-center gap-1.5 text-xs text-brand hover:text-brand-light font-medium transition-colors"
            >
              <Download size={12} />
              下载
            </button>
          </div>
          <p className="text-[10px] text-text-disabled mt-1.5">
            {msg.timestamp.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      </div>
    );
  }

  // Default assistant message — no bubble, just text
  return (
    <div className="flex justify-start">
      <div className="max-w-[85%]">
        <p className="text-sm text-text-primary whitespace-pre-wrap leading-relaxed">{msg.content}</p>
        <p className="text-[10px] text-text-disabled mt-1.5">
          {msg.timestamp.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  );
}
