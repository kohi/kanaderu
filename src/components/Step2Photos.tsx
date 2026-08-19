import React, { useRef, useState } from 'react';
import {
  Upload,
  Plus,
  Trash2,
  GripVertical,
  AlertTriangle,
  AlertOctagon,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Clock,
  Pin,
  X,
  Info,
  Check,
} from 'lucide-react';
import type { PhotoItem, SongData, Timeline } from '../types/project';
import { loadAndProcessImage } from '../core/utils/imageLoader';

interface Step2PhotosProps {
  song: SongData;
  photos: PhotoItem[];
  timeline: Timeline | null;
  onPhotosChange: (photos: PhotoItem[]) => void;
  onPrev: () => void;
  onNext: () => void;
  onError: (title: string, message: string, detail?: string) => void;
}

export const Step2Photos: React.FC<Step2PhotosProps> = ({
  song,
  photos,
  timeline,
  onPhotosChange,
  onPrev,
  onNext,
  onError,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('');
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Duration editor modal state
  const [editingPhotoIndex, setEditingPhotoIndex] = useState<number | null>(null);
  const [customDurationInput, setCustomDurationInput] = useState<string>('');

  const movieDuration = Math.max(0.1, (song.trimEnd || song.duration) - (song.trimStart || 0));
  const maxPhotosAllowed = timeline ? timeline.maxPhotosAllowed : Math.max(1, Math.floor(movieDuration / 1.5));
  const isBlocked = timeline ? (timeline.hasInsufficientTime || (timeline.isExceeded && timeline.segments.length === 0)) : false;

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || !fileList.length) return;

    setIsLoading(true);
    const newItems: PhotoItem[] = [];
    const files = Array.from(fileList);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setLoadingText(`写真処理中 (${i + 1}/${files.length}): ${file.name}`);

      try {
        const item = await loadAndProcessImage(file);
        newItems.push(item);
      } catch (err: unknown) {
        console.error('Image loading failed:', err);
        const msg = err instanceof Error ? err.message : String(err);
        onError('写真の読み込みに失敗しました', msg);
      }
    }

    setIsLoading(false);
    setLoadingText('');

    if (newItems.length > 0) {
      onPhotosChange([...photos, ...newItems]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleDeletePhoto = (index: number) => {
    const updated = photos.filter((_, idx) => idx !== index);
    onPhotosChange(updated);
    if (editingPhotoIndex === index) {
      setEditingPhotoIndex(null);
    }
  };

  const handleClearAll = () => {
    if (confirm('すべての写真を削除しますか？')) {
      onPhotosChange([]);
      setEditingPhotoIndex(null);
    }
  };

  // Drag and drop reordering handlers
  const handleItemDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleItemDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleItemDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const reordered = [...photos];
    const [movedItem] = reordered.splice(draggedIndex, 1);
    reordered.splice(index, 0, movedItem);

    onPhotosChange(reordered);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // Open Duration Editor for a photo
  const handleOpenDurationEditor = (index: number) => {
    const photo = photos[index];
    setEditingPhotoIndex(index);
    setCustomDurationInput(photo.lockedDuration ? String(photo.lockedDuration) : '');
  };

  // Apply Duration Lock to the active photo
  const handleSetDuration = (duration: number | undefined) => {
    if (editingPhotoIndex === null) return;
    const updated = [...photos];
    updated[editingPhotoIndex] = {
      ...updated[editingPhotoIndex],
      lockedDuration: duration && duration > 0 ? duration : undefined,
    };
    onPhotosChange(updated);
    setEditingPhotoIndex(null);
  };

  const handleCustomDurationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(customDurationInput);
    if (!isNaN(val) && val > 0) {
      handleSetDuration(Math.round(val * 10) / 10);
    } else {
      handleSetDuration(undefined);
    }
  };

  const activeEditingPhoto = editingPhotoIndex !== null ? photos[editingPhotoIndex] : null;

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      {/* Introduction & Metrics */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
            ステップ 2：写真を追加・並べ替え・秒数指定
          </h2>
          <p className="text-gray-500 text-sm mt-1">
            ドラッグ＆ドロップで並べ替えできます。特定の写真をクリックして表示秒数をピン留め（固定）することも可能です。
          </p>
        </div>

        {/* Counter Badge */}
        <div className="flex items-center gap-2">
          <div
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold border flex flex-col sm:flex-row items-start sm:items-center gap-1 sm:gap-2 ${
              timeline?.hasInsufficientTime
                ? 'bg-rose-50 border-rose-300 text-rose-800'
                : timeline?.isExceeded
                ? 'bg-amber-50 border-amber-300 text-amber-800'
                : 'bg-indigo-50 border-indigo-200 text-indigo-700'
            }`}
          >
            <span>
              {photos.length} 枚 / 推奨最大 {maxPhotosAllowed} 枚
            </span>
            {timeline && (
              <span className="text-[11px] opacity-80">
                {timeline.lockedCount > 0
                  ? `(📌固定:${timeline.lockedCount}枚 / ⏱️自動:${timeline.unlockedCount}枚 約${timeline.unlockedAverageTime.toFixed(1)}s)`
                  : `(1枚約 ${timeline.averageInterval.toFixed(1)} 秒)`}
              </span>
            )}
          </div>

          {photos.length > 0 && (
            <button
              onClick={handleClearAll}
              className="text-xs text-gray-400 hover:text-rose-600 px-2 py-1.5 rounded-lg hover:bg-rose-50 transition-colors"
            >
              すべて削除
            </button>
          )}
        </div>
      </div>

      {/* Dynamic Messages Banners (from timeline calculation) */}
      {timeline && timeline.messages.length > 0 && (
        <div className="flex flex-col gap-2.5 mb-6">
          {timeline.messages.map((msg, idx) => (
            <div
              key={idx}
              className={`p-4 rounded-2xl border flex items-start gap-3 text-sm animate-in fade-in slide-in-from-top-1 ${
                msg.type === 'error'
                  ? 'bg-rose-50 border-rose-200 text-rose-900'
                  : msg.type === 'warning'
                  ? 'bg-amber-50 border-amber-200 text-amber-900'
                  : 'bg-indigo-50/80 border-indigo-200 text-indigo-900'
              }`}
            >
              <div className="shrink-0 mt-0.5">
                {msg.type === 'error' && <AlertOctagon className="w-5 h-5 text-rose-600" />}
                {msg.type === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-600" />}
                {msg.type === 'info' && <Info className="w-5 h-5 text-indigo-600" />}
              </div>
              <div className="flex-1">
                <div className="font-semibold text-xs sm:text-sm">{msg.title}</div>
                <p className="mt-0.5 text-xs opacity-90 leading-relaxed">{msg.text}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Photo Grid & Upload Area */}
      {photos.length === 0 ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => !isLoading && fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-3xl p-12 text-center transition-all cursor-pointer ${
            isDragging
              ? 'border-indigo-500 bg-indigo-50/50 scale-[1.01]'
              : 'border-gray-300 hover:border-indigo-400 bg-white shadow-xs hover:shadow-md'
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => handleFiles(e.target.files)}
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic"
            multiple
            className="hidden"
          />

          <div className="flex flex-col items-center justify-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-inner">
              {isLoading ? (
                <Loader2 className="w-8 h-8 animate-spin" />
              ) : (
                <Upload className="w-8 h-8" />
              )}
            </div>

            {isLoading ? (
              <div>
                <p className="font-semibold text-gray-800 text-lg">写真を処理中...</p>
                <p className="text-sm text-indigo-600 mt-1">{loadingText}</p>
              </div>
            ) : (
              <div>
                <p className="font-semibold text-gray-800 text-lg">
                  写真ファイルをここに一括ドラッグ＆ドロップ
                </p>
                <p className="text-sm text-gray-500 mt-1">または クリックして複数ファイルを選択</p>
                <p className="text-xs text-gray-400 mt-3">
                  JPEG / PNG / WebP / iPhone写真 (HEIC) に対応（長辺2304pxへ自動最適化）
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div>
          {/* Thumbnails Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {photos.map((photo, idx) => {
              const isLocked = !!(photo.lockedDuration && photo.lockedDuration > 0);
              const segment = timeline?.segments.find((s) => s.photoIndex === idx);
              const actualDuration = segment ? segment.duration.toFixed(1) : (photo.lockedDuration || timeline?.unlockedAverageTime || 0).toFixed(1);

              return (
                <div
                  key={photo.id}
                  draggable
                  onDragStart={(e) => handleItemDragStart(e, idx)}
                  onDragOver={(e) => handleItemDragOver(e, idx)}
                  onDrop={(e) => handleItemDrop(e, idx)}
                  className={`group relative bg-white rounded-2xl border overflow-hidden shadow-xs hover:shadow-md transition-all select-none ${
                    dragOverIndex === idx
                      ? 'border-indigo-600 ring-2 ring-indigo-500/30 scale-105 z-10'
                      : isLocked
                      ? 'border-amber-400/80 ring-1 ring-amber-400/40 bg-amber-50/10'
                      : 'border-gray-200'
                  } ${draggedIndex === idx ? 'opacity-40' : 'opacity-100'}`}
                >
                  {/* Thumbnail Aspect Box */}
                  <div className="aspect-4/3 bg-gray-100 relative overflow-hidden">
                    <img
                      src={photo.previewUrl}
                      alt={photo.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />

                    {/* Index badge */}
                    <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-xs text-white text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-xs">
                      <GripVertical className="w-3 h-3 opacity-60" />
                      <span>#{idx + 1}</span>
                    </div>

                    {/* Delete button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeletePhoto(idx);
                      }}
                      title="この写真を削除"
                      className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 hover:bg-rose-600 text-white opacity-0 group-hover:opacity-100 transition-all shadow-xs"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>

                    {/* Duration Pin Button Overlay */}
                    <div className="absolute bottom-2 left-2 right-2 flex justify-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenDurationEditor(idx);
                        }}
                        title="表示秒数を固定・変更する"
                        className={`text-[11px] font-semibold px-2.5 py-1 rounded-full backdrop-blur-md flex items-center gap-1 shadow-xs transition-all ${
                          isLocked
                            ? 'bg-amber-500 text-white hover:bg-amber-600 ring-1 ring-white/50'
                            : 'bg-black/60 text-white/90 hover:bg-black/80 hover:text-white'
                        }`}
                      >
                        {isLocked ? (
                          <>
                            <Pin className="w-3 h-3 fill-current" />
                            <span>固定 {photo.lockedDuration}s</span>
                          </>
                        ) : (
                          <>
                            <Clock className="w-3 h-3" />
                            <span>自動 (~{actualDuration}s)</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Photo info footer */}
                  <div className="p-2.5 bg-white flex items-center justify-between">
                    <p className="text-xs text-gray-700 font-medium truncate flex-1" title={photo.name}>
                      {photo.name}
                    </p>
                    {isLocked && (
                      <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded ml-1 shrink-0">
                        固定
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Add More Photos Card */}
            <div
              onClick={() => !isLoading && fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`aspect-4/3 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all ${
                isDragging
                  ? 'border-indigo-500 bg-indigo-50'
                  : 'border-gray-200 hover:border-indigo-400 bg-gray-50/50 hover:bg-white'
              }`}
            >
              {isLoading ? (
                <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
              ) : (
                <>
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <Plus className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-semibold text-gray-600">写真を追加</span>
                </>
              )}
            </div>
          </div>

          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => handleFiles(e.target.files)}
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic"
            multiple
            className="hidden"
          />

          {isLoading && (
            <div className="mt-4 p-3 rounded-xl bg-indigo-50 text-indigo-800 text-xs flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{loadingText}</span>
            </div>
          )}

          {/* Navigation Bar */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-100">
            <button
              onClick={onPrev}
              className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 rounded-xl hover:bg-gray-100 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>音楽の変更</span>
            </button>

            <button
              onClick={onNext}
              disabled={photos.length === 0 || isBlocked || isLoading}
              className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-white font-medium rounded-xl shadow-md shadow-indigo-600/20 transition-all hover:scale-[1.01]"
            >
              <span>プレビューへ進む（ステップ3）</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Duration Pin Editor Modal */}
      {activeEditingPhoto && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-gray-100 relative">
            <button
              onClick={() => setEditingPhotoIndex(null)}
              className="absolute top-4 right-4 p-1.5 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl overflow-hidden bg-gray-100 border border-gray-200 shrink-0">
                <img
                  src={activeEditingPhoto.previewUrl}
                  alt={activeEditingPhoto.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <h3 className="font-bold text-sm text-gray-900">写真の表示秒数を設定</h3>
                <p className="text-xs text-gray-500 truncate max-w-[180px]">{activeEditingPhoto.name}</p>
              </div>
            </div>

            <p className="text-xs text-gray-600 mb-4 bg-gray-50 p-2.5 rounded-xl">
              この写真だけ決まった秒数で表示させたい場合は秒数を選択してください。他の写真は残りの時間で均等に割り振られます。
            </p>

            {/* Quick Presets */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              <button
                type="button"
                onClick={() => handleSetDuration(undefined)}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1 transition-all ${
                  !activeEditingPhoto.lockedDuration
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600'
                    : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {!activeEditingPhoto.lockedDuration && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                <span>自動（おまかせ）</span>
              </button>

              {[2.0, 3.0, 4.0, 5.0, 7.0].map((sec) => (
                <button
                  key={sec}
                  type="button"
                  onClick={() => handleSetDuration(sec)}
                  className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1 transition-all ${
                    activeEditingPhoto.lockedDuration === sec
                      ? 'border-amber-500 bg-amber-50 text-amber-800 ring-1 ring-amber-500'
                      : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {activeEditingPhoto.lockedDuration === sec && <Pin className="w-3 h-3 fill-amber-600 text-amber-600" />}
                  <span>{sec.toFixed(1)} 秒</span>
                </button>
              ))}
            </div>

            {/* Custom Input */}
            <form onSubmit={handleCustomDurationSubmit} className="pt-2 border-t border-gray-100 flex items-center gap-2">
              <div className="flex-1 flex items-center gap-1 border border-gray-300 rounded-xl px-3 py-2 text-xs focus-within:border-indigo-600 focus-within:ring-1 focus-within:ring-indigo-600">
                <span className="text-gray-400">カスタム:</span>
                <input
                  type="number"
                  min="0.5"
                  max={movieDuration}
                  step="0.5"
                  placeholder="例: 3.5"
                  value={customDurationInput}
                  onChange={(e) => setCustomDurationInput(e.target.value)}
                  className="w-full bg-transparent outline-none font-bold text-gray-800"
                />
                <span className="text-gray-400">秒</span>
              </div>

              <button
                type="submit"
                className="py-2 px-4 rounded-xl bg-gray-900 hover:bg-black text-white text-xs font-semibold transition-colors shrink-0"
              >
                適用
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
