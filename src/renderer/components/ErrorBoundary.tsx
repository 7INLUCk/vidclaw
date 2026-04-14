import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] 捕获到错误:', error, errorInfo);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-screen bg-surface-0">
          <div className="text-center max-w-md mx-auto px-6">
            <div className="w-16 h-16 rounded-2xl bg-error/10 flex items-center justify-center mx-auto mb-5">
              <AlertTriangle size={28} className="text-error" />
            </div>
            <h2 className="text-lg font-semibold text-text-primary mb-2">出了点问题</h2>
            <p className="text-sm text-text-muted mb-2">
              应用遇到了一个意外错误
            </p>
            {this.state.error && (
              <p className="text-xs text-text-disabled mb-6 font-mono bg-surface-2 rounded-lg p-3 text-left overflow-auto max-h-24">
                {this.state.error.message}
              </p>
            )}
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={this.handleReset}
                className="px-4 py-2 bg-surface-2 hover:bg-surface-3 text-text-secondary text-sm rounded-xl transition-all border border-border-subtle"
              >
                尝试恢复
              </button>
              <button
                onClick={this.handleReload}
                className="flex items-center gap-2 px-4 py-2 bg-brand-gradient text-white text-sm rounded-xl hover:shadow-[var(--shadow-brand)] transition-all hover:-translate-y-0.5"
              >
                <RefreshCw size={14} />
                重新加载
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
