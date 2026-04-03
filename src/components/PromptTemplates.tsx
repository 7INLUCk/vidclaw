import { useState } from 'react';
import { ChevronDown, ChevronUp, Plus, Trash2, Sparkles } from 'lucide-react';
import { useStore, type PromptTemplate } from '../store';

interface PromptTemplatesProps {
  onSelect: (prompt: string) => void;
}

export function PromptTemplates({ onSelect }: PromptTemplatesProps) {
  const { templates, addTemplate, removeTemplate } = useStore();
  const [expanded, setExpanded] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPrompt, setNewPrompt] = useState('');
  const [newEmoji, setNewEmoji] = useState('✨');

  const handleAdd = () => {
    if (!newName.trim() || !newPrompt.trim()) return;
    addTemplate({
      id: `custom_${Date.now()}`,
      name: newName.trim(),
      emoji: newEmoji,
      prompt: newPrompt.trim(),
      isPreset: false,
    });
    setNewName('');
    setNewPrompt('');
    setShowAdd(false);
  };

  return (
    <div className="border-t border-border-subtle">
      {/* Toggle bar */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-2 text-[11px] text-text-muted hover:text-text-secondary transition-colors"
      >
        <span className="flex items-center gap-1.5">
          <Sparkles size={12} />
          常用模板
          <span className="px-1 py-0.5 rounded bg-surface-3 text-[10px]">{templates.length}</span>
        </span>
        {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-3 space-y-1.5 animate-fade-in">
          {templates.map((t) => (
            <div
              key={t.id}
              className="flex items-center gap-2 group"
            >
              <button
                onClick={() => { onSelect(t.prompt); setExpanded(false); }}
                className="flex-1 flex items-center gap-2 px-3 py-2 bg-surface-2 hover:bg-surface-3 rounded-lg text-left transition-all text-xs"
              >
                <span>{t.emoji}</span>
                <span className="text-text-primary font-medium">{t.name}</span>
                <span className="text-text-muted truncate flex-1">· {t.prompt}</span>
              </button>
              {!t.isPreset && (
                <button
                  onClick={() => removeTemplate(t.id)}
                  className="p-1 text-text-disabled hover:text-error opacity-0 group-hover:opacity-100 transition-all"
                >
                  <Trash2 size={11} />
                </button>
              )}
            </div>
          ))}

          {/* Add custom template */}
          {showAdd ? (
            <div className="bg-surface-2 rounded-lg p-3 space-y-2 animate-fade-in">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newEmoji}
                  onChange={e => setNewEmoji(e.target.value)}
                  className="w-10 bg-surface-3 border border-border-subtle rounded-md px-2 py-1.5 text-center text-sm"
                  placeholder="✨"
                />
                <input
                  type="text"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="模板名称"
                  className="flex-1 bg-surface-3 border border-border-subtle rounded-md px-3 py-1.5 text-xs text-text-primary placeholder-text-muted"
                />
              </div>
              <input
                type="text"
                value={newPrompt}
                onChange={e => setNewPrompt(e.target.value)}
                placeholder="提示词内容"
                className="w-full bg-surface-3 border border-border-subtle rounded-md px-3 py-1.5 text-xs text-text-primary placeholder-text-muted"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleAdd}
                  disabled={!newName.trim() || !newPrompt.trim()}
                  className="flex-1 py-1.5 bg-brand text-white text-xs rounded-md disabled:opacity-40 transition-all"
                >
                  保存
                </button>
                <button
                  onClick={() => setShowAdd(false)}
                  className="px-3 py-1.5 text-xs text-text-muted hover:text-text-secondary transition-colors"
                >
                  取消
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAdd(true)}
              className="w-full flex items-center justify-center gap-1.5 py-2 text-[11px] text-text-muted hover:text-brand hover:bg-surface-2 rounded-lg transition-all"
            >
              <Plus size={12} />
              添加自定义模板
            </button>
          )}
        </div>
      )}
    </div>
  );
}
