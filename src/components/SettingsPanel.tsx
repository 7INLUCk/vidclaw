import { useState } from 'react';
import { FolderOpen, Key, RefreshCw, Check, LogOut, ExternalLink, BarChart3, TrendingUp, CheckCircle, XCircle, Calendar } from 'lucide-react';
import { useStore } from '../store';

export function SettingsPanel() {
  const { settings, setSettings, addMessage, usage } = useStore();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const result = await window.api.saveSettings(settings);
      if (result.success) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleSelectDir() {
    const { dir } = await window.api.selectDownloadDir();
    if (dir) setSettings({ downloadDir: dir });
  }

  async function handleRelaunch() {
    addMessage({
      id: Date.now().toString(),
      role: 'system',
      content: '🔄 正在重启浏览器（用于重新登录即梦）...',
      timestamp: new Date(),
    });
    const result = await window.api.relaunchBrowser();
    if (result.success) {
      addMessage({
        id: (Date.now() + 1).toString(),
        role: 'system',
        content: '✅ 浏览器已重启，请在弹出窗口中扫码登录',
        timestamp: new Date(),
      });
    } else {
      addMessage({
        id: (Date.now() + 1).toString(),
        role: 'system',
        content: `❌ 重启失败: ${result.error}`,
        timestamp: new Date(),
        type: 'error',
      });
    }
  }

  return (
    <div className="flex flex-col h-full bg-surface-0">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-border-subtle flex-shrink-0">
        <div>
          <h1 className="text-sm font-semibold text-text-primary">设置</h1>
          <p className="text-xs text-text-muted">配置即梦助手</p>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-lg space-y-7">

          {/* API Key */}
          <section>
            <label className="flex items-center gap-2 text-sm font-medium text-text-primary mb-2.5">
              <Key size={14} className="text-brand" />
              OpenRouter API Key
            </label>
            <div className="flex gap-2">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={settings.apiKey}
                onChange={(e) => setSettings({ apiKey: e.target.value })}
                placeholder="sk-or-v1-..."
                className="flex-1 bg-surface-1 border border-border rounded-xl px-4 py-2.5 text-sm text-text-primary placeholder-text-muted focus-brand transition-all duration-200"
              />
              <button
                onClick={() => setShowApiKey(!showApiKey)}
                className="px-3 rounded-xl bg-surface-2 text-text-muted hover:text-text-primary text-xs transition-colors border border-border-subtle"
              >
                {showApiKey ? '隐藏' : '显示'}
              </button>
            </div>
            <p className="text-[10px] text-text-disabled mt-1.5">
              用于 AI 改写提示词。在{' '}
              <a href="https://openrouter.ai/keys" target="_blank" className="text-brand hover:text-brand-light transition-colors">
                openrouter.ai/keys
              </a>{' '}
              获取
            </p>
          </section>

          {/* Model */}
          <section>
            <label className="text-sm font-medium text-text-primary mb-2.5 block">AI 模型</label>
            <select
              value={settings.model}
              onChange={(e) => setSettings({ model: e.target.value })}
              className="w-full bg-surface-1 border border-border rounded-xl px-4 py-2.5 text-sm text-text-primary focus-brand transition-all duration-200 appearance-none cursor-pointer"
            >
              <option value="xiaomi/mimo-v2-pro">MiMo V2 Pro（推荐，性价比高）</option>
              <option value="anthropic/claude-sonnet-4">Claude Sonnet 4</option>
              <option value="openai/gpt-4o">GPT-4o</option>
              <option value="google/gemini-2.0-flash">Gemini 2.0 Flash</option>
            </select>
          </section>

          {/* Download Directory */}
          <section>
            <label className="flex items-center gap-2 text-sm font-medium text-text-primary mb-2.5">
              <FolderOpen size={14} className="text-brand" />
              下载目录
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={settings.downloadDir}
                onChange={(e) => setSettings({ downloadDir: e.target.value })}
                className="flex-1 bg-surface-1 border border-border rounded-xl px-4 py-2.5 text-sm text-text-primary placeholder-text-muted focus-brand transition-all duration-200"
              />
              <button
                onClick={handleSelectDir}
                className="px-3 rounded-xl bg-surface-2 text-text-muted hover:text-text-primary text-xs transition-colors border border-border-subtle"
              >
                选择
              </button>
            </div>
          </section>

          {/* Auto Download Toggle */}
          <section className="flex items-center justify-between py-1">
            <div>
              <label className="text-sm font-medium text-text-primary">完成后自动下载</label>
              <p className="text-[10px] text-text-disabled mt-0.5">作品生成后自动下载到本地</p>
            </div>
            <button
              onClick={() => setSettings({ autoDownload: !settings.autoDownload })}
              className={`
                w-11 h-6 rounded-full transition-all duration-200 relative
                ${settings.autoDownload ? 'bg-brand shadow-[var(--shadow-brand)]' : 'bg-surface-3'}
              `}
            >
              <span
                className={`
                  absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform duration-200 shadow-sm
                  ${settings.autoDownload ? 'translate-x-[22px]' : 'translate-x-0.5'}
                `}
              />
            </button>
          </section>

          <hr className="border-border-subtle" />

          {/* Re-login */}
          <section>
            <label className="text-sm font-medium text-text-primary mb-2.5 block">即梦账号</label>
            <button
              onClick={handleRelaunch}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface-2 hover:bg-surface-3 text-text-secondary text-sm transition-all duration-150 border border-border-subtle hover:border-border"
            >
              <LogOut size={15} />
              重新登录（重启浏览器）
            </button>
            <p className="text-[10px] text-text-disabled mt-1.5">
              如果登录态过期，点击此按钮重启浏览器并重新扫码
            </p>
          </section>

          <hr className="border-border-subtle" />

          {/* About */}
          <section>
            <h3 className="text-sm font-medium text-text-primary mb-2">关于</h3>
            <div className="text-xs text-text-muted space-y-1.5">
              <p className="font-mono">VidClaw <span className="text-text-disabled">v0.1.0</span></p>
              <p>技术栈：Electron + Playwright + OpenRouter</p>
              <p className="flex items-center gap-1">
                AI 模型：
                <a href="https://openrouter.ai/xiaomi/mimo-v2-pro" target="_blank" className="text-brand hover:text-brand-light transition-colors flex items-center gap-1">
                  MiMo V2 Pro <ExternalLink size={10} />
                </a>
              </p>
            </div>
          </section>

          <hr className="border-border-subtle" />

          {/* Usage Statistics */}
          <section>
            <label className="flex items-center gap-2 text-sm font-medium text-text-primary mb-3">
              <BarChart3 size={14} className="text-brand" />
              用量统计
            </label>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-surface-2 rounded-xl p-3 border border-border-subtle text-center">
                <p className="text-lg font-semibold text-text-primary font-mono">{usage.totalTasks}</p>
                <p className="text-[10px] text-text-muted mt-0.5">总任务</p>
              </div>
              <div className="bg-surface-2 rounded-xl p-3 border border-border-subtle text-center">
                <p className="text-lg font-semibold font-mono" style={{ color: 'oklch(0.7 0.15 145)' }}>{usage.completedTasks}</p>
                <p className="text-[10px] text-text-muted mt-0.5">已完成</p>
              </div>
              <div className="bg-surface-2 rounded-xl p-3 border border-border-subtle text-center">
                <p className="text-lg font-semibold font-mono" style={{ color: 'oklch(0.6 0.2 25)' }}>{usage.failedTasks}</p>
                <p className="text-[10px] text-text-muted mt-0.5">失败</p>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-2 text-[10px] text-text-disabled">
              <Calendar size={10} />
              <span>今日: {usage.todayTasks} 个任务</span>
              <span>·</span>
              <TrendingUp size={10} />
              <span>成功率: {usage.totalTasks > 0 ? Math.round((usage.completedTasks / usage.totalTasks) * 100) : 0}%</span>
            </div>
          </section>

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={saving}
            className={`
              w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-medium transition-all duration-200
              ${saved
                ? 'bg-success text-white'
                : 'bg-brand-gradient text-white hover:shadow-[var(--shadow-brand)] hover:-translate-y-0.5'
              }
              disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none
            `}
          >
            {saving ? (
              <><RefreshCw size={15} className="animate-spin" /> 保存中...</>
            ) : saved ? (
              <><Check size={15} /> 已保存</>
            ) : (
              '保存设置'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
