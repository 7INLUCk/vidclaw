import { useState } from 'react';
import { PawPrint, Mail, Loader2, Zap } from 'lucide-react';
import { useStore } from '../store';

const INTERNAL_DOMAINS = ['miaoboai.com'];
const INTERNAL_CREDITS = 99999;

function getDomainHint(email: string): 'internal' | 'unknown' | null {
  const match = email.trim().toLowerCase().match(/@(.+)$/);
  if (!match) return null;
  return INTERNAL_DOMAINS.includes(match[1]) ? 'internal' : 'unknown';
}

export function AuthModal() {
  const { setAuth, addCredits, credits } = useStore();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const hint = getDomainHint(email);
  const canSubmit = hint === 'internal' && !loading;

  async function handleLogin() {
    if (!canSubmit) return;
    setLoading(true);
    setError('');
    try {
      const result = await window.api.emailLogin(email.trim().toLowerCase());
      if (!result.success) {
        setError(result.error || '登录失败');
        return;
      }
      const auth = { email: email.trim().toLowerCase(), isInternal: result.isInternal ?? false, loginAt: Date.now() };
      setAuth(auth);
      // Grant initial credits for internal users (only if balance is 0 — first login)
      if (result.isInternal && credits.balance === 0) {
        addCredits(INTERNAL_CREDITS, '内部员工首次登录赠送');
      }
    } catch (err: any) {
      setError(err?.message || '网络错误');
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleLogin();
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md">
      <div className="w-[360px] bg-surface-1 border border-border rounded-2xl overflow-hidden shadow-2xl">
        {/* Top accent */}
        <div className="h-px bg-gradient-to-r from-brand/0 via-brand to-brand/0" />

        {/* Header */}
        <div className="flex flex-col items-center pt-8 pb-6 px-8">
          <div className="w-14 h-14 rounded-2xl bg-brand flex items-center justify-center mb-4 shadow-[0_0_24px_oklch(0.62_0.22_282/0.4)]">
            <PawPrint size={26} strokeWidth={2.2} className="text-white" />
          </div>
          <h1 className="text-lg font-semibold text-text-primary mb-1">欢迎使用 VidClaw</h1>
          <p className="text-xs text-text-muted text-center">输入公司邮箱登录，即可开始创作</p>
        </div>

        {/* Form */}
        <div className="px-8 pb-8 space-y-3">
          <div className="relative">
            <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(''); }}
              onKeyDown={handleKeyDown}
              placeholder="your@miaoboai.com"
              autoFocus
              className="w-full bg-surface-2 border border-border-subtle rounded-xl pl-9 pr-4 py-2.5 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-brand transition-colors"
            />
          </div>

          {/* Hint */}
          {hint === 'internal' && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-brand/10 border border-brand/20">
              <Zap size={12} className="text-brand shrink-0" />
              <p className="text-[11px] text-brand leading-snug">
                内部员工账号 · 登录后赠送 {INTERNAL_CREDITS.toLocaleString()} 积分
              </p>
            </div>
          )}
          {hint === 'unknown' && (
            <div className="px-3 py-2 rounded-lg bg-surface-2 border border-border-subtle">
              <p className="text-[11px] text-text-muted leading-snug">
                此邮箱暂不在内测名单内，请联系管理员开通权限
              </p>
            </div>
          )}

          {error && (
            <p className="text-[11px] text-error px-1">{error}</p>
          )}

          <button
            onClick={handleLogin}
            disabled={!canSubmit}
            className="w-full h-10 bg-brand hover:bg-brand/90 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl transition-all flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : null}
            {loading ? '登录中...' : '登录'}
          </button>

          <p className="text-[10px] text-text-disabled text-center pt-1">
            目前仅限内测阶段，仅接受公司邮箱登录
          </p>
        </div>
      </div>
    </div>
  );
}
