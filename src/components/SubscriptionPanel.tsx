import { Wallet, Zap, TrendingDown, TrendingUp, Gift, Package, ChevronRight, User, LogOut } from 'lucide-react';
import { useStore, type CreditTransaction } from '../store';

// ── Credit cost reference ─────────────────────────────────────────────────────
const PACKAGES = [
  { id: 'trial', name: '体验包', price: 19.9, credits: 300, tag: null, desc: '约 3 条 10s 视频' },
  { id: 'standard', name: '标准包', price: 49.9, credits: 1000, tag: '最受欢迎', desc: '约 10 条 10s 视频' },
  { id: 'pro', name: '专业包', price: 99.9, credits: 2500, tag: '高性价比', desc: '2.5× 积分，约 25 条 10s 视频' },
  { id: 'annual', name: '年度订阅', price: 399, credits: 6000, tag: '年付优惠', desc: '每月 500 积分，全年不断' },
] as const;

const CREDIT_COST = [
  { duration: '3s', credits: 30 },
  { duration: '5s', credits: 50 },
  { duration: '10s', credits: 100 },
  { duration: '15s', credits: 150 },
];

// ── Transaction row ───────────────────────────────────────────────────────────
function TxRow({ tx }: { tx: CreditTransaction }) {
  const isDeduct = tx.type === 'deduct';
  const Icon = tx.type === 'grant' ? Gift : isDeduct ? TrendingDown : TrendingUp;
  const color = tx.type === 'grant' ? 'text-brand' : isDeduct ? 'text-error' : 'text-success';

  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border-subtle last:border-0">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${
          tx.type === 'grant' ? 'bg-brand/10' : isDeduct ? 'bg-error/10' : 'bg-success/10'
        }`}>
          <Icon size={12} className={color} />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] text-text-secondary truncate">{tx.description}</p>
          <p className="text-[10px] text-text-disabled font-mono">
            {new Date(tx.createdAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      </div>
      <div className="text-right shrink-0 ml-3">
        <p className={`text-xs font-mono font-medium ${color}`}>
          {isDeduct ? '-' : '+'}{tx.amount.toLocaleString()}
        </p>
        <p className="text-[10px] text-text-disabled font-mono">{tx.balanceAfter.toLocaleString()}</p>
      </div>
    </div>
  );
}

// ── Package card ──────────────────────────────────────────────────────────────
function PackageCard({ pkg }: { pkg: typeof PACKAGES[number] }) {
  const isFeatured = pkg.id === 'standard';

  return (
    <div className={`relative rounded-xl border p-4 flex flex-col gap-3 transition-all ${
      isFeatured
        ? 'bg-brand/10 border-brand/40'
        : 'bg-surface-2 border-border-subtle hover:border-border'
    }`}>
      {pkg.tag && (
        <span className={`absolute -top-2.5 left-3 px-2 py-0.5 rounded-full text-[10px] font-medium ${
          isFeatured ? 'bg-brand text-white' : 'bg-surface-3 text-text-muted border border-border-subtle'
        }`}>
          {pkg.tag}
        </span>
      )}
      <div>
        <p className="text-sm font-semibold text-text-primary">{pkg.name}</p>
        <p className="text-[11px] text-text-muted mt-0.5">{pkg.desc}</p>
      </div>
      <div className="flex items-end justify-between">
        <div>
          <span className="text-xl font-bold text-text-primary">¥{pkg.price}</span>
          {pkg.id === 'annual' && <span className="text-[10px] text-text-muted ml-1">/年</span>}
        </div>
        <div className="flex items-center gap-1">
          <Zap size={11} className="text-brand" />
          <span className="text-xs font-medium text-brand">{pkg.credits.toLocaleString()} 积分</span>
        </div>
      </div>
      <button
        className="w-full py-2 rounded-lg text-xs font-medium transition-all bg-surface-3 text-text-muted hover:bg-surface-3 cursor-not-allowed"
        title="支付功能即将开放"
        onClick={() => {}}
      >
        即将开放
      </button>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export function SubscriptionPanel() {
  const { auth, credits, setAuth, setActivePanel } = useStore();

  const handleLogout = () => {
    if (confirm('确定要退出登录吗？')) {
      setAuth(null);
    }
  };

  const balance = credits.balance;
  const isLow = balance < 50;

  return (
    <div className="flex flex-col h-full bg-surface-0">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-border-subtle flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <Wallet size={16} className="text-brand" />
          <h1 className="text-sm font-semibold text-text-primary">我的积分</h1>
        </div>
        {auth && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-[11px] text-text-muted">
              <User size={11} />
              <span className="truncate max-w-[120px]">{auth.email}</span>
            </div>
            <button
              onClick={handleLogout}
              className="p-1 text-text-disabled hover:text-error transition-colors"
              title="退出登录"
            >
              <LogOut size={13} />
            </button>
          </div>
        )}
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
        {/* Balance card */}
        <div className={`rounded-2xl p-5 ${isLow ? 'bg-error/10 border border-error/20' : 'bg-brand/10 border border-brand/20'}`}>
          <p className={`text-[11px] font-medium mb-1 flex items-center gap-1.5 ${isLow ? 'text-error' : 'text-brand'}`}>
            <Zap size={11} />
            当前积分余额
          </p>
          <p className={`text-4xl font-bold font-mono tracking-tight ${isLow ? 'text-error' : 'text-brand'}`}>
            {balance.toLocaleString()}
          </p>
          {isLow && (
            <p className="text-[11px] text-error/80 mt-1.5">余额不足，无法使用可灵 O1 功能</p>
          )}
          {auth?.isInternal && (
            <p className="text-[11px] text-text-muted mt-1.5">内部员工账号 · 积分仅用于成本核算</p>
          )}
        </div>

        {/* Cost reference */}
        <div>
          <h3 className="text-[11px] font-medium text-text-muted mb-2 uppercase tracking-wider">积分消耗参考</h3>
          <div className="bg-surface-1 border border-border-subtle rounded-xl overflow-hidden">
            <div className="grid grid-cols-2 text-[10px] text-text-disabled px-3 py-2 border-b border-border-subtle">
              <span>可灵 O1 图生视频</span>
              <span className="text-right">积分/次</span>
            </div>
            {CREDIT_COST.map((item) => (
              <div key={item.duration} className="flex items-center justify-between px-3 py-2.5 border-b border-border-subtle last:border-0">
                <span className="text-xs text-text-secondary">{item.duration} 视频</span>
                <div className="flex items-center gap-1">
                  <Zap size={10} className="text-brand" />
                  <span className="text-xs font-mono font-medium text-brand">{item.credits}</span>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between px-3 py-2.5">
              <span className="text-xs text-text-secondary">即梦 CLI 任务</span>
              <div className="flex items-center gap-1">
                <Zap size={10} className="text-text-muted" />
                <span className="text-xs font-mono font-medium text-text-muted">1</span>
              </div>
            </div>
          </div>
        </div>

        {/* Packages */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[11px] font-medium text-text-muted uppercase tracking-wider flex items-center gap-1.5">
              <Package size={11} />
              购买积分包
            </h3>
            <span className="text-[10px] text-text-disabled">支付功能即将开放</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {PACKAGES.map((pkg) => (
              <PackageCard key={pkg.id} pkg={pkg} />
            ))}
          </div>
        </div>

        {/* Transaction history */}
        {credits.transactions.length > 0 && (
          <div>
            <h3 className="text-[11px] font-medium text-text-muted mb-2 uppercase tracking-wider">消费记录</h3>
            <div className="bg-surface-1 border border-border-subtle rounded-xl px-3">
              {credits.transactions.slice(0, 20).map((tx) => (
                <TxRow key={tx.id} tx={tx} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
