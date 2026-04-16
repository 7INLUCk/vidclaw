import { useState } from 'react';
import { CheckCircle, RefreshCw, Zap, Play } from 'lucide-react';
import { useStore } from '../../store';
import { localFileUrlSync } from '../../utils/localFile';
import { VideoThumb } from './VideoThumb';
import { SaveSkillModal } from './SaveSkillModal';

function cyclePill<T>(current: T, options: T[]): T {
  const idx = options.indexOf(current);
  return options[(idx + 1) % options.length];
}

const MODEL_OPTIONS = [
  { value: 'kling-o1',        label: 'Kling O1' },
  { value: 'seedance2.0fast', label: 'Seedance Fast' },
  { value: 'seedance2.0',     label: 'Seedance 2.0' },
];

const RATIO_OPTIONS = ['9:16', '16:9', '1:1', '4:3', '3:4', '21:9'];
const KLING_RATIO_OPTIONS = ['9:16', '16:9', '1:1'];

interface MaterialItem {
  type: string;
  name: string;
  path: string;
  description?: string;
}

export function ConfirmCard({
  task, onConfirm, onEdit, hasFiles, selectedModel, selectedDuration, selectedRatio,
  materials, onDurationChange, onRatioChange, onModelChange, onEditMaterial,
}: {
  task: any;
  onConfirm: (editedPrompt?: string) => void;
  onEdit: () => void;
  hasFiles?: boolean;
  selectedModel?: string;
  selectedDuration?: number;
  selectedRatio?: string;
  materials?: { images: MaterialItem[]; videos: MaterialItem[]; audios: MaterialItem[] };
  onDurationChange?: (d: number) => void;
  onRatioChange?: (r: string) => void;
  onModelChange?: (m: string) => void;
  onEditMaterial?: (index: number, newDesc: string) => void;
}) {
  const [editedPrompt, setEditedPrompt] = useState<string>(task.prompt || '');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const setPreviewUrl = useStore(s => s.setPreviewUrl);
  const { credits, jimengBalance } = useStore();
  const isKling = selectedModel === 'kling-o1';
  const klingCost = isKling ? (selectedDuration ?? 5) * 10 : 0;
  const canAfford = !isKling || credits.balance >= klingCost;

  const currentModelLabel = MODEL_OPTIONS.find(m => m.value === selectedModel)?.label ?? 'Seedance Fast';
  const durations = isKling ? [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] : [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
  const ratios = isKling ? KLING_RATIO_OPTIONS : RATIO_OPTIONS;
  const modelValues = MODEL_OPTIONS.map(m => m.value);

  function handleModelCycle() {
    const next = cyclePill(selectedModel ?? 'seedance2.0fast', modelValues);
    onModelChange?.(next);
    if (next === 'kling-o1' && selectedDuration !== undefined && ![3,4,5,6,7,8,9,10,11,12,13,14,15].includes(selectedDuration)) {
      onDurationChange?.(5);
    }
  }

  function handleDurationCycle() {
    onDurationChange?.(cyclePill(selectedDuration ?? 5, durations));
  }

  function handleRatioCycle() {
    onRatioChange?.(cyclePill(selectedRatio ?? '9:16', ratios));
  }

  const allMaterials = [
    ...(materials?.images || []),
    ...(materials?.videos || []),
    ...(materials?.audios || []),
  ];

  return (
    <>
      <div className="bg-surface-2 border border-border rounded-md overflow-hidden max-w-[85%] animate-fade-in-up">
        <div className="h-px bg-brand flex-shrink-0" />
        <div className="p-4">
          {/* Header */}
          <p className="text-xs text-brand font-medium flex items-center gap-1.5 mb-3">
            <span>✨</span> AI 优化后的提示词
          </p>

          {/* Always-editable prompt */}
          <textarea
            value={editedPrompt}
            onChange={e => setEditedPrompt(e.target.value)}
            className="w-full bg-surface-3 border border-border-subtle rounded-md px-3 py-2 text-sm text-text-primary leading-relaxed resize-none outline-none focus:border-brand mb-2 transition-colors"
            rows={4}
          />

          {/* AI reason */}
          {task.reason && (
            <p className="text-xs text-text-secondary mb-3 bg-surface-3 rounded-md px-3 py-2">
              💡 <span className="font-medium">改写理由：</span>{task.reason}
            </p>
          )}

          {/* Material thumbnails */}
          {allMaterials.length > 0 && (
            <div className="mb-3">
              <p className="text-[10px] text-text-muted uppercase tracking-wider mb-2">已上传素材</p>
              <div className="flex flex-wrap gap-2">
                {allMaterials.map((m, i) => {
                  const isImg = m.type === 'image';
                  const isVid = m.type === 'video';
                  return (
                    <div key={i} className="flex flex-col items-center gap-1">
                      {isImg && (
                        <div className="w-16 h-16 rounded-lg overflow-hidden border border-border bg-surface-3">
                          <img src={localFileUrlSync(m.path)} alt={m.name} className="w-full h-full object-cover" />
                        </div>
                      )}
                      {isVid && (
                        <button
                          onClick={() => setPreviewUrl(localFileUrlSync(m.path))}
                          className="w-16 h-16 rounded-lg overflow-hidden border border-border hover:border-brand transition-all relative"
                        >
                          <VideoThumb path={m.path} size={40} />
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="w-5 h-5 rounded-full bg-black/50 flex items-center justify-center">
                              <Play size={9} className="text-white ml-0.5" />
                            </div>
                          </div>
                        </button>
                      )}
                      {!isImg && !isVid && (
                        <div className="w-16 h-16 rounded-lg border border-border bg-surface-3 flex items-center justify-center">
                          <span className="text-purple-400 text-lg">♪</span>
                        </div>
                      )}
                      <span className="text-[9px] text-text-muted max-w-[64px] truncate text-center">{m.name}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Clickable param pills */}
          <div className="flex items-center gap-1.5 flex-wrap mb-4">
            <button onClick={handleModelCycle} className="px-2 py-0.5 bg-surface-3 hover:bg-border rounded text-[10px] text-text-secondary font-mono transition-colors" title="点击切换模型">
              {currentModelLabel}
            </button>
            <button onClick={handleDurationCycle} className="px-2 py-0.5 bg-surface-3 hover:bg-border rounded text-[10px] text-text-secondary font-mono transition-colors" title="点击切换时长">
              {selectedDuration ?? 5}s
            </button>
            <button onClick={handleRatioCycle} className="px-2 py-0.5 bg-surface-3 hover:bg-border rounded text-[10px] text-text-secondary font-mono transition-colors" title="点击切换比例">
              {selectedRatio ?? '9:16'}
            </button>
          </div>

          {hasFiles && (
            <p className="text-[10px] text-text-muted mb-3">
              {isKling ? '📎 素材将提交给可灵 O1' : '📎 素材将随任务一起提交给即梦 CLI'}
            </p>
          )}

          {/* Credit row */}
          {isKling ? (
            <div className={`flex items-center justify-between px-3 py-2 rounded-lg mb-3 ${canAfford ? 'bg-brand/10 border border-brand/20' : 'bg-error/10 border border-error/20'}`}>
              <div className="flex items-center gap-1.5">
                <Zap size={11} className={canAfford ? 'text-brand' : 'text-error'} />
                <span className={`text-[11px] font-medium ${canAfford ? 'text-brand' : 'text-error'}`}>消耗 {klingCost} 积分</span>
              </div>
              <span className={`text-[10px] ${canAfford ? 'text-text-muted' : 'text-error'}`}>
                余额 {credits.balance.toLocaleString()} {!canAfford && '· 不足'}
              </span>
            </div>
          ) : (
            <div className="flex items-center justify-between px-3 py-2 rounded-lg mb-3 bg-surface-3">
              <span className="text-[10px] text-text-muted">即梦账号余额</span>
              <span className="text-[10px] text-text-secondary font-medium">{jimengBalance.toLocaleString()} 积分</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => onConfirm(editedPrompt)}
              disabled={!canAfford}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg transition-all duration-150 bg-brand hover:bg-brand/90 disabled:opacity-40 disabled:cursor-not-allowed text-white hover:-translate-y-0.5"
            >
              <CheckCircle size={14} /> 确认提交
            </button>
            <button
              onClick={onEdit}
              className="flex items-center gap-1.5 px-4 py-2 bg-surface-3 hover:bg-border text-text-secondary text-xs font-medium rounded-lg transition-all duration-150"
            >
              <RefreshCw size={14} /> 重新描述
            </button>
            <div className="flex-1" />
            <button
              onClick={() => setShowSaveModal(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] text-text-muted hover:text-brand hover:bg-brand/10 rounded-md transition-all border border-border-subtle hover:border-brand/30"
            >
              <Zap size={11} /> 保存为技能
            </button>
          </div>
        </div>
      </div>

      {showSaveModal && (
        <SaveSkillModal
          onClose={() => setShowSaveModal(false)}
          tasks={[{ prompt: editedPrompt }]}
          model={selectedModel ?? 'seedance2.0fast'}
          duration={selectedDuration ?? 5}
          aspectRatio={selectedRatio ?? '9:16'}
        />
      )}
    </>
  );
}
