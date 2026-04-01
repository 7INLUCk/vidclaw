import { useState } from 'react';
import { QrCode, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';

interface LoginGuideProps {
  onLoginSuccess: () => void;
}

export function LoginGuide({ onLoginSuccess }: LoginGuideProps) {
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');

  async function handleCheckLogin() {
    setChecking(true);
    setError('');
    try {
      const { loggedIn } = await window.api.checkLogin();
      if (loggedIn) {
        onLoginSuccess();
      } else {
        setError('未检测到登录状态，请确保已在弹出的浏览器窗口中扫码登录');
      }
    } catch (err) {
      setError(`检查失败: ${err}`);
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="flex items-center justify-center h-screen bg-gray-950 text-white">
      <div className="text-center max-w-md px-8">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 flex items-center justify-center mx-auto mb-6">
          <QrCode size={32} className="text-white" />
        </div>

        <h2 className="text-xl font-bold mb-2">请登录即梦</h2>
        <p className="text-gray-400 text-sm mb-6 leading-relaxed">
          已为你打开即梦页面，请在弹出的浏览器窗口中
          <strong className="text-gray-200">扫码登录</strong>。
          <br />
          登录成功后，点击下方按钮继续。
        </p>

        <div className="space-y-3">
          <button
            onClick={handleCheckLogin}
            disabled={checking}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 rounded-xl text-sm font-medium transition-colors"
          >
            {checking ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                检测中...
              </>
            ) : (
              <>
                <CheckCircle size={16} />
                已登录，继续
              </>
            )}
          </button>

          {error && (
            <div className="flex items-start gap-2 text-xs text-red-400 bg-red-900/20 rounded-lg px-3 py-2 text-left">
              <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <p className="text-xs text-gray-600">
            登录状态会自动保存，下次启动无需重复登录
          </p>
        </div>
      </div>
    </div>
  );
}
