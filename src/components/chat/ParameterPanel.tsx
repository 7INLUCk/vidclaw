import { MODEL_OPTIONS, DURATION_OPTIONS, RATIO_OPTIONS } from './constants';

// ── GuideButton ──
export function GuideButton({ label, onClick, disabled, icon }: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand hover:bg-brand/90 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-md transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0"
    >
      {icon}
      {label}
    </button>
  );
}

// ── ParamChip ──
export function ParamChip({ active, onClick, children }: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1.5 text-[11px] rounded-md transition-all duration-150 font-medium ${
        active
          ? 'bg-brand text-white'
          : 'bg-surface-2 text-text-secondary hover:bg-surface-3 hover:text-text-primary'
      }`}
    >
      {children}
    </button>
  );
}

// ── ParamSection ──
export function ParamSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] text-text-muted uppercase tracking-wider mb-2 block font-medium">{label}</label>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

// ── ParameterPanel ──
export function ParameterPanel({
  model, setModel, duration, setDuration, aspectRatio, setAspectRatio, visible,
}: {
  model: string;
  setModel: (m: string) => void;
  duration: number;
  setDuration: (d: number) => void;
  aspectRatio: string;
  setAspectRatio: (r: string) => void;
  visible: boolean;
}) {
  if (!visible) return null;

  return (
    <div className="px-6 py-3 border-t border-border-subtle bg-surface flex-shrink-0">
      <div className="grid grid-cols-3 gap-4">
        <ParamSection label="模型">
          {MODEL_OPTIONS.map((m) => (
            <ParamChip key={m.key} active={model === m.key} onClick={() => setModel(m.key)}>
              {m.label}
            </ParamChip>
          ))}
        </ParamSection>
        <ParamSection label="时长">
          {DURATION_OPTIONS.map((d) => (
            <ParamChip key={d} active={duration === d} onClick={() => setDuration(d)}>
              {d}s
            </ParamChip>
          ))}
        </ParamSection>
        <ParamSection label="比例">
          {RATIO_OPTIONS.map((r) => (
            <ParamChip key={r} active={aspectRatio === r} onClick={() => setAspectRatio(r)}>
              {r}
            </ParamChip>
          ))}
        </ParamSection>
      </div>
    </div>
  );
}
