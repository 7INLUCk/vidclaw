import { X } from 'lucide-react';

interface VideoModalProps {
  url: string | null;
  onClose: () => void;
}

export function VideoModal({ url, onClose }: VideoModalProps) {
  if (!url) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-overlay-in"
      onClick={onClose}
    >
      <div
        className="relative w-[90vw] max-w-4xl animate-card-pop"
        onClick={e => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 p-2 text-white/60 hover:text-white transition-colors"
        >
          <X size={20} />
        </button>

        {/* Video player */}
        <video
          src={url}
          controls
          autoPlay
          className="w-full rounded-xl shadow-[var(--shadow-elevated)]"
          style={{ maxHeight: '80vh' }}
        >
          您的浏览器不支持视频播放
        </video>
      </div>
    </div>
  );
}
