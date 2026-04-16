import { useState } from 'react';
import { CheckCircle, RefreshCw, ChevronDown } from 'lucide-react';
import { MODEL_OPTIONS, DURATION_OPTIONS, RATIO_OPTIONS } from './constants';

// ── Material Tag (可编辑素材标签) ──
export function MaterialTag({
  material, index, onEdit,
}: {
  material: { type: string; name: string; path: string; description?: string };
  index: number;
  onEdit: (newDesc: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [desc, setDesc] = useState(material.description || material.name);
  const icon = material.type === 'image' ? '📷' : material.type === 'video' ? '🎬' : '🎵';

  if (isEditing) {
    return (
      <div className="flex items-center gap-1 bg-surface-2 rounded-lg p-1">
        <span className="text-xs">{icon}</span>
        <input
          type="text"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          className="bg-transparent text-xs text-text-primary outline-none w-32"
          autoFocus
        />
        <button onClick={() => { onEdit(desc); setIsEditing(false); }} className="text-xs text-brand hover:underline">✓</button>
        <button onClick={() => setIsEditing(false)} className="text-xs text-text-muted hover:underline">✕</button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setIsEditing(true)}
      className="flex items-center gap-1 bg-surface-2 hover:bg-surface-3 rounded-lg px-2 py-1 transition-colors"
    >
      <span className="text-xs">{icon}</span>
      <span className="text-xs text-text-primary">{desc}</span>
      <span className="text-xs text-text-muted">✏️</span>
    </button>
  );
}

// ── File Preview Chip (点击预览) ──
function FilePreviewChip({ material }: { material: { type: string; name: string; path: string } }) {
  const handlePreview = async () => {
    if (!material.path) { alert('文件路径无效'); return; }
    const result = await window.api.openFile(material.path);
    if (!result.success) await window.api.openDownloadDir();
  };

  return (
    <button
      onClick={handlePreview}
      className="inline-flex items-center gap-1.5 px-2 py-1 bg-surface-3 hover:bg-border rounded-md text-xs transition-all group"
      title={`点击预览: ${material.path}`}
    >
      {material.type === 'image' && <span className="text-green-400">🖼️</span>}
      {material.type === 'video' && <span className="text-blue-400">🎬</span>}
      {material.type === 'audio' && <span className="text-purple-400">🎵</span>}
      <span className="text-text-secondary group-hover:text-text-primary">{material.name}</span>
      <span className="text-text-muted opacity-0 group-hover:opacity-100 transition-opacity">👁️</span>
    </button>
  );
}

// ── Confirm Card ──
export function ConfirmCard({
  task, onConfirm, onEdit, onBack, hasFiles, selectedModel, selectedDuration, selectedRatio,
  materials, onDurationChange, onRatioChange, onModelChange, onEditMaterial,
}: {
  task: any;
  onConfirm: () => void;
  onEdit: () => void;
  onBack?: () => void;
  hasFiles?: boolean;
  selectedModel?: string;
  selectedDuration?: number;
  selectedRatio?: string;
  materials?: { images: any[]; videos: any[]; audios: any[] };
  onDurationChange?: (d: number) => void;
  onRatioChange?: (r: string) => void;
  onModelChange?: (m: string) => void;
  onEditMaterial?: (index: number, newDesc: string) => void;
}) {
  const [paramsConfirmed, setParamsConfirmed] = useState(false);
  const allMaterials = [
    ...(materials?.images || []),
    ...(materials?.videos || []),
    ...(materials?.audios || []),
  ];

  return (
    <div className="bg-surface-2 border border-border rounded-md overflow-hidden max-w-[85%] animate-fade-in-up">
      <div className="h-px bg-brand flex-shrink-0" />
      <div className="p-4">
        <p className="text-xs text-brand font-medium mb-2 flex items-center gap-1.5">
          <span>✨</span> AI 优化后的提示词
        </p>
        <p className="text-sm text-text-primary leading-relaxed mb-3">{task.prompt}</p>

        {task.reason && (
          <p className="text-xs text-text-secondary mb-3 bg-surface-3 rounded-md px-3 py-2">
            💡 <span className="font-medium">改写理由:</span>{task.reason}
          </p>
        )}

        {allMaterials.length > 0 && (
          <div className="mb-3">
            <p className="text-[10px] text-text-muted uppercase tracking-wider mb-2">已上传素材（点击可编辑描述）</p>
            <div className="flex flex-wrap gap-2">
              {allMaterials.map((m, i) => (
                <MaterialTag key={i} material={m} index={i} onEdit={(d) => onEditMaterial?.(i, d)} />
              ))}
            </div>
          </div>
        )}

        {hasFiles && (
          <div className="mb-4 p-3 bg-surface-3 rounded-lg border border-border-subtle">
            <p className="text-xs text-text-primary font-medium mb-3 flex items-center gap-1.5">
              <span>⚙️</span> 请确认生成参数
            </p>
            <div className="mb-3">
              <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1">模型版本</p>
              <div className="flex gap-2">
                {MODEL_OPTIONS.map((m) => (
                  <button
                    key={m.key}
                    onClick={() => onModelChange?.(m.key)}
                    className={`px-3 py-1.5 text-[11px] rounded-md transition-all flex-1 ${
                      selectedModel === m.key || (!selectedModel && m.key === MODEL_OPTIONS[0].key)
                        ? 'bg-brand text-white' : 'bg-surface-2 text-text-secondary hover:bg-border'
                    }`}
                  >
                    <span className="font-medium">{m.label}</span>
                    <span className="block text-[10px] opacity-80">{m.desc}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="mb-3">
              <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1">时长</p>
              <div className="grid grid-cols-6 gap-1">
                {DURATION_OPTIONS.map((d) => (
                  <button
                    key={d}
                    onClick={() => onDurationChange?.(d)}
                    className={`px-2 py-1 text-[11px] rounded-md transition-all ${
                      selectedDuration === d ? 'bg-brand text-white' : 'bg-surface-2 text-text-secondary hover:bg-border'
                    }`}
                  >
                    {d}s
                  </button>
                ))}
              </div>
            </div>
            <div className="mb-3">
              <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1">画幅比例</p>
              <div className="grid grid-cols-3 gap-1">
                {RATIO_OPTIONS.map((r) => (
                  <button
                    key={r}
                    onClick={() => onRatioChange?.(r)}
                    className={`px-2 py-1 text-[11px] rounded-md transition-all ${
                      selectedRatio === r ? 'bg-brand text-white' : 'bg-surface-2 text-text-secondary hover:bg-border'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
            {!paramsConfirmed ? (
              <button
                onClick={() => setParamsConfirmed(true)}
                className="w-full flex items-center justify-center gap-1.5 px-4 py-2 bg-brand hover:bg-brand/90 text-white text-xs font-medium rounded-lg transition-all"
              >
                <CheckCircle size={14} />
                确认参数并继续
              </button>
            ) : (
              <p className="text-[10px] text-brand flex items-center gap-1">
                <CheckCircle size={12} />
                参数已确认
              </p>
            )}
          </div>
        )}

        {!hasFiles && (
          <div className="flex items-center gap-2 text-xs text-text-secondary mb-4 flex-wrap">
            <span className="bg-surface-3 rounded-md px-2 py-0.5 font-mono">{task.type || 'video'}</span>
            {task.duration && <span className="bg-surface-3 rounded-md px-2 py-0.5 font-mono">{task.duration}s</span>}
            <span className="bg-surface-3 rounded-md px-2 py-0.5 font-mono">{task.aspectRatio || '16:9'}</span>
            {task.style && <span className="bg-surface-3 rounded-md px-2 py-0.5">{task.style}</span>}
          </div>
        )}

        {hasFiles && (
          <p className="text-[10px] text-brand mb-3">
            {selectedModel === 'kling-o1' ? '📎 素材将提交给可灵 O1' : '⚡ 结构化模式：素材将通过 API 直接上传'}
          </p>
        )}

        <div className="flex items-center gap-2">
          <button
            onClick={onConfirm}
            disabled={hasFiles && !paramsConfirmed}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg transition-all duration-150 ${
              hasFiles && !paramsConfirmed
                ? 'bg-surface-3 text-text-muted cursor-not-allowed'
                : 'bg-brand hover:bg-brand/90 text-white hover:-translate-y-0.5'
            }`}
          >
            <CheckCircle size={14} />
            确认提交
          </button>
          {onBack && (
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 px-4 py-2 bg-surface-3 hover:bg-border text-text-secondary text-xs font-medium rounded-lg transition-all duration-150"
            >
              <ChevronDown size={14} className="rotate-180" />
              返回修改
            </button>
          )}
          <button
            onClick={onEdit}
            className="flex items-center gap-1.5 px-4 py-2 bg-surface-3 hover:bg-border text-text-secondary text-xs font-medium rounded-lg transition-all duration-150"
          >
            <RefreshCw size={14} />
            重新描述
          </button>
        </div>
      </div>
    </div>
  );
}
