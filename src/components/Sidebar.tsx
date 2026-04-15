import { MessageSquare, Layers, Settings, Clock, PawPrint, Zap, Wallet } from 'lucide-react';
import { useStore } from '../store';

export function Sidebar() {
  const { activePanel, setActivePanel, tasks, isSubmitting, skills, auth, credits } = useStore();

  const activeTaskCount = tasks.filter(t =>
    ['generating', 'queued', 'pending', 'uploading'].includes(t.status)
  ).length;

  const navItems = [
    { id: 'chat' as const, icon: MessageSquare, label: '对话', badge: isSubmitting ? '...' : null },
    { id: 'queue' as const, icon: Layers, label: '队列', badge: activeTaskCount > 0 ? String(activeTaskCount) : null },
    { id: 'history' as const, icon: Clock, label: '作品', badge: null },
    { id: 'skills' as const, icon: Zap, label: '技能', badge: skills.length > 0 ? String(skills.length) : null },
    { id: 'settings' as const, icon: Settings, label: '设置', badge: null },
  ];

  return (
    <aside
      className="w-[56px] flex flex-col items-center py-3 flex-shrink-0"
      style={{
        background: 'var(--color-surface-1)',
        borderRight: '1px solid var(--color-border-subtle)'
      }}
    >
      {/* Logo */}
      <div 
        className="w-9 h-9 flex items-center justify-center mb-5"
        style={{
          background: 'var(--color-brand)',
          borderRadius: 'var(--radius-md)',
          color: 'white'
        }}
      >
        <PawPrint size={18} strokeWidth={2.2} />
      </div>

      {/* Navigation */}
      <nav className="flex flex-col items-center gap-0.5 w-full px-1.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activePanel === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActivePanel(item.id)}
              className={`relative w-full h-12 flex flex-col items-center justify-center gap-0.5 transition-all duration-150 group${isActive ? ' nav-active-indicator' : ''}`}
              style={{
                borderRadius: 'var(--radius-md)',
                color: isActive ? 'var(--color-brand)' : 'var(--color-text-muted)',
                background: isActive ? 'oklch(0.62 0.22 282 / 0.10)' : 'transparent',
              }}
            >
              <Icon size={16} strokeWidth={isActive ? 2.2 : 1.8} />
              <span style={{ fontSize: '10px', fontWeight: isActive ? 600 : 400, lineHeight: 1 }}>
                {item.label}
              </span>
              
              {/* Hover background */}
              {!isActive && (
                <span
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity -z-10"
                  style={{
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--color-surface-3)'
                  }}
                />
              )}

              {item.badge && (
                <span 
                  className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center"
                  style={{
                    borderRadius: 'var(--radius-lg)',
                    fontSize: '10px',
                    fontWeight: 500,
                    background: isActive ? 'var(--color-brand)' : 'var(--color-surface-3)',
                    color: isActive ? 'white' : 'var(--color-text-muted)'
                  }}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="mt-auto flex flex-col items-center gap-1 w-full px-1.5 pb-2">
        {/* Credits button (only when logged in) */}
        {auth && (
          <button
            onClick={() => setActivePanel('subscription')}
            className={`relative w-full h-10 flex flex-col items-center justify-center gap-0.5 transition-all duration-150 group ${
              activePanel === 'subscription' ? 'nav-active-indicator' : ''
            }`}
            style={{
              borderRadius: 'var(--radius-md)',
              color: activePanel === 'subscription'
                ? 'var(--color-brand)'
                : credits.balance < 50
                  ? 'var(--color-error, #ef4444)'
                  : 'var(--color-text-muted)',
              background: activePanel === 'subscription' ? 'oklch(0.62 0.22 282 / 0.10)' : 'transparent',
            }}
            title={`积分余额: ${credits.balance.toLocaleString()}`}
          >
            <Wallet size={14} strokeWidth={activePanel === 'subscription' ? 2.2 : 1.8} />
            <span style={{ fontSize: '9px', fontWeight: activePanel === 'subscription' ? 600 : 400, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
              {credits.balance >= 10000 ? '99k+' : credits.balance.toLocaleString()}
            </span>
            {/* Low balance dot */}
            {credits.balance < 50 && credits.balance >= 0 && (
              <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-error" />
            )}
            {/* Hover background */}
            {activePanel !== 'subscription' && (
              <span
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity -z-10"
                style={{ borderRadius: 'var(--radius-md)', background: 'var(--color-surface-3)' }}
              />
            )}
          </button>
        )}

        {/* Version indicator */}
        <span
          className="font-mono"
          style={{ fontSize: '9px', color: 'var(--color-text-secondary)' }}
        >
          v0.1
        </span>
      </div>
    </aside>
  );
}