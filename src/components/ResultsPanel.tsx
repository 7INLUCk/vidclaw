import { Download, Image, Film, RefreshCw, FolderOpen } from 'lucide-react';
import { useStore } from '../store';
import { useState } from 'react';

export function ResultsPanel() {
  const { results, setResults, addMessage } = useStore();
  const [downloading, setDownloading] = useState<string | null>(null);

  async function handleRefresh() {
    const { results: fresh } = await window.api.getResults();
    if (fresh?.length) setResults(fresh);
  }

  async function handleDownload(item: any) {
    setDownloading(item.id);
    try {
      const result = await window.api.downloadTask(item);
      if (result.success) {
        addMessage({
          id: Date.now().toString(),
          role: 'system',
          content: `✅ 已下载: ${result.filepath?.split('/').pop()}`,
          timestamp: new Date(),
          type: 'download',
        });
      } else {
        addMessage({
          id: Date.now().toString(),
          role: 'system',
          content: `❌ 下载失败: ${result.error}`,
          timestamp: new Date(),
          type: 'error',
        });
      }
    } finally {
      setDownloading(null);
    }
  }

  async function handleDownloadAll() {
    addMessage({
      id: Date.now().toString(),
      role: 'system',
      content: `⬇️ 开始下载全部 ${results.length} 个作品...`,
      timestamp: new Date(),
    });

    const { results: dlResults } = await window.api.downloadAll();
    const success = dlResults?.filter((r: any) => r.success).length || 0;
    const failed = dlResults?.filter((r: any) => !r.success).length || 0;

    addMessage({
      id: (Date.now() + 1).toString(),
      role: 'system',
      content: `📦 下载完成：成功 ${success} 个${failed > 0 ? `，失败 ${failed} 个` : ''}`,
      timestamp: new Date(),
    });
  }

  return (
    <div className="flex flex-col h-full bg-surface-0">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-border-subtle flex-shrink-0">
        <div>
          <h1 className="text-sm font-semibold text-text-primary">已生成作品</h1>
          <p className="text-xs text-text-muted">{results.length} 个作品</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleRefresh}
            className="p-2 rounded-lg hover:bg-surface-2 text-text-muted hover:text-text-primary transition-all duration-150"
            title="刷新"
          >
            <RefreshCw size={15} />
          </button>
          <button
            onClick={() => window.api.openDownloadDir()}
            className="p-2 rounded-lg hover:bg-surface-2 text-text-muted hover:text-text-primary transition-all duration-150"
            title="打开下载目录"
          >
            <FolderOpen size={15} />
          </button>
          {results.length > 1 && (
            <button
              onClick={handleDownloadAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-gradient text-white text-xs font-medium hover:shadow-[var(--shadow-brand)] transition-all duration-150 hover:-translate-y-0.5 ml-1"
            >
              <Download size={13} />
              全部下载
            </button>
          )}
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {results.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-text-muted">
            <div className="w-16 h-16 rounded-2xl bg-surface-2 flex items-center justify-center mb-4">
              <Image size={28} className="opacity-40" />
            </div>
            <p className="text-sm font-medium">暂无作品</p>
            <p className="text-xs mt-1 text-text-disabled">在对话中描述你想生成的内容</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
            {results.map((item) => (
              <ResultCard
                key={item.id}
                item={item}
                onDownload={() => handleDownload(item)}
                isDownloading={downloading === item.id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ResultCard({
  item,
  onDownload,
  isDownloading,
}: {
  item: any;
  onDownload: () => void;
  isDownloading: boolean;
}) {
  const isVideo = item.generateType === 'video';

  return (
    <div className="group bg-surface-1 rounded-xl overflow-hidden border border-border-subtle hover:border-border transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-card)]">
      {/* Thumbnail */}
      <div className="aspect-video bg-surface-2 relative overflow-hidden">
        {item.thumbUrl ? (
          <img
            src={item.thumbUrl}
            alt={item.prompt?.slice(0, 30)}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            {isVideo ? (
              <Film size={28} className="text-text-disabled" />
            ) : (
              <Image size={28} className="text-text-disabled" />
            )}
          </div>
        )}

        {/* Type badge */}
        <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-sm text-[10px] text-white/90 flex items-center gap-1 font-medium">
          {isVideo ? <Film size={10} /> : <Image size={10} />}
          {isVideo ? '视频' : '图片'}
        </div>

        {/* Download overlay */}
        <button
          onClick={onDownload}
          disabled={isDownloading}
          className="absolute bottom-2 right-2 p-2 rounded-lg bg-black/60 backdrop-blur-sm hover:bg-brand text-white opacity-0 group-hover:opacity-100 transition-all duration-200 disabled:opacity-50"
          title="下载"
        >
          {isDownloading ? (
            <RefreshCw size={15} className="animate-spin" />
          ) : (
            <Download size={15} />
          )}
        </button>
      </div>

      {/* Info */}
      <div className="p-3">
        <p className="text-xs text-text-primary line-clamp-2 leading-relaxed" title={item.prompt}>
          {item.prompt || '无提示词'}
        </p>
        <p className="text-[10px] text-text-disabled mt-1.5 font-mono">
          {new Date(item.timestamp).toLocaleString('zh-CN')}
        </p>
      </div>
    </div>
  );
}
