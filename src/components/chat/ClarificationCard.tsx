import { useState } from 'react';
import { CheckCircle } from 'lucide-react';
import { MaterialTag } from './ConfirmCard';
import type { ClarificationData } from '../../store';

export function ClarificationCard({
  data,
  onConfirm,
  onEditMaterial,
}: {
  data: ClarificationData;
  onConfirm: (selections: Record<string, string>) => void;
  onEditMaterial?: (index: number, newDesc: string) => void;
}) {
  const [selections, setSelections] = useState<Record<string, string>>({});
  const allAnswered = data.questions.length > 0 && data.questions.every(q => selections[q.id]);

  return (
    <div className="bg-surface-2 border border-border rounded-md overflow-hidden max-w-[85%] animate-fade-in-up">
      <div className="h-px bg-brand flex-shrink-0" />
      <div className="p-4">
        <p className="text-xs text-brand font-medium mb-3 flex items-center gap-1.5">
          <span>🤔</span> 请确认素材用途
        </p>

        {(data.materials || []).length > 0 && (
          <div className="mb-3">
            <p className="text-[10px] text-text-muted uppercase tracking-wider mb-2">已上传素材</p>
            <div className="flex flex-wrap gap-2">
              {(data.materials || []).map((m, i) => (
                <MaterialTag key={i} material={m} index={i} onEdit={(d) => onEditMaterial?.(i, d)} />
              ))}
            </div>
          </div>
        )}

        <div className="space-y-3">
          {data.questions.map((q) => (
            <div key={q.id}>
              <p className="text-xs text-text-primary mb-2">{q.text}</p>
              <div className="flex flex-wrap gap-2">
                {q.options.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setSelections(prev => ({ ...prev, [q.id]: opt.value }))}
                    className={`px-3 py-1.5 text-xs rounded-lg transition-all ${
                      selections[q.id] === opt.value
                        ? 'bg-brand text-white'
                        : 'bg-surface-3 hover:bg-border text-text-secondary'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4">
          <button
            onClick={() => onConfirm(selections)}
            disabled={!allAnswered}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-md transition-all ${
              allAnswered
                ? 'bg-brand hover:bg-brand/90 text-white'
                : 'bg-surface-3 text-text-muted cursor-not-allowed'
            }`}
          >
            <CheckCircle size={14} />
            确认并生成
          </button>
        </div>
      </div>
    </div>
  );
}
