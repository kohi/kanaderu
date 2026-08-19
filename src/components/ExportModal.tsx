import React, { useEffect } from 'react';
import {
  Download,
  Share2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  Sparkles,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import type { ExportProgress } from '../types/project';

interface ExportModalProps {
  progress: ExportProgress;
  onCancel: () => void;
  onClose: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  progress,
  onCancel,
  onClose,
}) => {
  const isCompleted = progress.state === 'completed';
  const isError = progress.state === 'error';
  const isCancelled = progress.state === 'cancelled';
  const isRunning =
    progress.state === 'preparing' ||
    progress.state === 'encoding' ||
    progress.state === 'muxing';

  useEffect(() => {
    if (isCompleted) {
      // Trigger festive celebration
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
      });
    }
  }, [isCompleted]);

  const formatTime = (ms: number) => {
    const sec = Math.ceil(ms / 1000);
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleShare = async () => {
    if (!progress.blob || !navigator.share) return;
    try {
      const file = new File([progress.blob], progress.filename || 'movie.mp4', {
        type: 'video/mp4',
      });
      await navigator.share({
        title: progress.filename || 'Kanaderu Movie',
        files: [file],
      });
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        console.error('Web Share failed:', e);
      }
    }
  };

  const canShare =
    typeof navigator !== 'undefined' &&
    !!navigator.share &&
    !!progress.blob &&
    (typeof navigator.canShare === 'function'
      ? navigator.canShare({
          files: [new File([progress.blob], 'test.mp4', { type: 'video/mp4' })],
        })
      : true);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-gray-100 relative">
        {/* Close Button when done or error */}
        {(isCompleted || isError || isCancelled) && (
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* State 1: Running */}
        {isRunning && (
          <div className="text-center">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-5 shadow-inner">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>

            <h3 className="text-xl font-bold text-gray-900">
              {progress.state === 'preparing'
                ? 'ムービーの準備中...'
                : progress.state === 'muxing'
                ? 'MP4コンテナを出力中...'
                : 'MP4ムービーを書き出し中...'}
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              WebCodecs（H.264 + AAC）で高速エンコードしています
            </p>

            {/* Progress Bar */}
            <div className="mt-6 mb-2">
              <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden p-0.5 border border-gray-200/60">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-violet-600 rounded-full transition-all duration-150"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
              <div className="flex justify-between items-center text-xs text-gray-500 mt-2 font-mono">
                <span>
                  {progress.encodedFrames} / {progress.totalFrames} frames
                </span>
                <span className="font-bold text-indigo-600 text-sm">{progress.percent}%</span>
              </div>
            </div>

            {/* Timings */}
            <div className="grid grid-cols-2 gap-2 mt-4 p-3 bg-gray-50 rounded-xl text-xs text-gray-600">
              <div>
                <span className="text-gray-400 block">経過時間</span>
                <span className="font-mono font-medium">{formatTime(progress.elapsedMs)}</span>
              </div>
              <div>
                <span className="text-gray-400 block">残り予測</span>
                <span className="font-mono font-medium">
                  {progress.estimatedRemainingMs > 0
                    ? `約 ${formatTime(progress.estimatedRemainingMs)}`
                    : 'まもなく完了'}
                </span>
              </div>
            </div>

            {/* Cancel Button */}
            <button
              onClick={onCancel}
              className="mt-6 w-full py-2.5 px-4 rounded-xl border border-gray-300 text-gray-600 text-xs font-semibold hover:bg-gray-50 hover:text-rose-600 transition-colors"
            >
              書き出しをキャンセル
            </button>
          </div>
        )}

        {/* State 2: Completed */}
        {isCompleted && (
          <div className="text-center">
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4 shadow-inner">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              <span>書き出し完了！</span>
            </div>

            <h3 className="text-xl font-bold text-gray-900">ムービーが完成しました</h3>
            <p className="text-xs text-gray-500 mt-1 max-w-xs mx-auto">
              {progress.filename} ({progress.blob ? (progress.blob.size / (1024 * 1024)).toFixed(1) : '0'} MB)
            </p>

            <div className="flex flex-col gap-2.5 mt-6">
              {progress.downloadUrl && (
                <a
                  href={progress.downloadUrl}
                  download={progress.filename || 'movie.mp4'}
                  className="flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-md shadow-indigo-600/25 transition-all hover:scale-[1.01]"
                >
                  <Download className="w-4 h-4" />
                  <span>MP4をダウンロード</span>
                </a>
              )}

              {canShare && (
                <button
                  onClick={handleShare}
                  className="flex items-center justify-center gap-2 py-3 px-6 rounded-xl border border-indigo-200 bg-indigo-50/60 hover:bg-indigo-100 text-indigo-700 text-sm font-semibold transition-colors"
                >
                  <Share2 className="w-4 h-4" />
                  <span>LINE・SNS等で共有</span>
                </button>
              )}

              <button
                onClick={onClose}
                className="py-2.5 px-4 text-xs font-medium text-gray-500 hover:text-gray-800 transition-colors"
              >
                プレビュー画面に戻る
              </button>
            </div>
          </div>
        )}

        {/* State 3: Error / Cancelled */}
        {(isError || isCancelled) && (
          <div className="text-center">
            <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4 shadow-inner">
              <AlertCircle className="w-9 h-9" />
            </div>

            <h3 className="text-xl font-bold text-gray-900">
              {isCancelled ? '書き出しを中止しました' : '書き出しに失敗しました'}
            </h3>
            <p className="text-xs text-rose-600 mt-2 max-w-xs mx-auto">
              {progress.error || '処理中にエラーが発生しました。'}
            </p>

            <button
              onClick={onClose}
              className="mt-6 w-full py-3 px-6 rounded-xl bg-gray-900 hover:bg-black text-white text-sm font-semibold transition-colors"
            >
              閉じる
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
