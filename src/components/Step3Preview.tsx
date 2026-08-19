import React, { useEffect, useRef, useState } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Film,
  Sparkles,
  Smartphone,
  Monitor,
  ArrowLeft,
  Volume2,
  Zap,
  Flame,
  SunMedium,
  Layers,
  Wand2,
  Sliders,
} from 'lucide-react';
import type { AspectRatio, PresetType, ProjectConfig, TransitionStyle } from '../types/project';
import { AudioPreviewPlayer } from '../core/audio/player';
import { RESOLUTIONS, render } from '../core/renderer/canvasRenderer';
import { PRESET_CONFIGS } from '../core/timeline/generator';

interface Step3PreviewProps {
  project: ProjectConfig;
  onPresetChange: (preset: PresetType) => void;
  onTransitionStyleChange: (style: TransitionStyle) => void;
  onFadeChange: (opts: {
    fadeIn?: boolean;
    fadeInDuration?: number;
    fadeOut?: boolean;
    fadeOutDuration?: number;
  }) => void;
  onAspectChange: (aspect: AspectRatio) => void;
  onStartExport: () => void;
  onPrev: () => void;
  onError: (title: string, message: string, detail?: string) => void;
}

export const Step3Preview: React.FC<Step3PreviewProps> = ({
  project,
  onPresetChange,
  onTransitionStyleChange,
  onFadeChange,
  onAspectChange,
  onStartExport,
  onPrev,
  onError,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playerRef = useRef<AudioPreviewPlayer | null>(null);

  const song = project.song;
  const timeline = project.timeline;
  const totalDuration = timeline ? timeline.totalDuration : 0;

  const headFade = project.fadeIn ? project.fadeInDuration : 0;
  const tailFade = project.fadeOut ? project.fadeOutDuration : 0;

  // Initialize and update player when song or trim changes
  useEffect(() => {
    if (!song) return;

    const player = new AudioPreviewPlayer(
      (time) => {
        setCurrentTime(time);
      },
      () => {
        setIsPlaying(false);
        setCurrentTime(0);
      }
    );

    player.setAudioBuffer(song.audioBuffer, song.trimStart, song.trimEnd, headFade, tailFade);
    playerRef.current = player;

    return () => {
      player.dispose();
      playerRef.current = null;
    };
  }, [song]);

  // Update player fade options dynamically
  useEffect(() => {
    if (playerRef.current) {
      playerRef.current.setFadeOptions(headFade, tailFade);
    }
  }, [headFade, tailFade]);

  // Render canvas frame whenever currentTime or project settings change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !timeline) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dim = RESOLUTIONS[project.aspectRatio];
    if (canvas.width !== dim.width || canvas.height !== dim.height) {
      canvas.width = dim.width;
      canvas.height = dim.height;
    }

    render(ctx, currentTime, project, dim);
  }, [currentTime, project]);

  // Spacebar toggle playback shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        const activeTag = (document.activeElement?.tagName || '').toLowerCase();
        if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'button') {
          return;
        }
        e.preventDefault();
        togglePlay();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying]);

  const togglePlay = async () => {
    if (!playerRef.current) return;

    if (isPlaying) {
      playerRef.current.pause();
      setIsPlaying(false);
    } else {
      try {
        await playerRef.current.play();
        setIsPlaying(true);
      } catch (err) {
        console.error('Playback failed:', err);
        onError('再生に失敗しました', '音声出力の初期化がブロックされた可能性があります。');
      }
    }
  };

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (playerRef.current) {
      playerRef.current.seek(time);
    }
  };

  const handleRestart = () => {
    if (playerRef.current) {
      playerRef.current.seek(0);
      setCurrentTime(0);
      if (!isPlaying) {
        playerRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    const ms = Math.floor((sec % 1) * 10);
    return `${m}:${s.toString().padStart(2, '0')}.${ms}`;
  };

  const presetOptions: { id: PresetType; label: string; sub: string; desc: string }[] = [
    {
      id: 'slow',
      label: 'ゆったり',
      sub: '穏やかなズーム・長めのフェード',
      desc: 'バラードや風景写真に最適（フェード1.2秒）',
    },
    {
      id: 'standard',
      label: 'スタンダード',
      sub: '自然なリズム・標準フェード',
      desc: 'ポップスや日常スナップに最適（フェード0.8秒）',
    },
    {
      id: 'up',
      label: 'アップテンポ',
      sub: 'カット感強調・短めフェード',
      desc: 'ダンスやビートの効いた曲に最適（フェード0.4秒）',
    },
  ];

  const transitionStyleOptions: {
    id: TransitionStyle;
    label: string;
    badge: string;
    desc: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    {
      id: 'dynamic',
      label: 'メリハリ重視（おすすめ）',
      badge: '人気',
      desc: 'ビートフラッシュ・クラッシュズーム・スライドを曲の盛り上がりに合わせてミックス',
      icon: Zap,
    },
    {
      id: 'flash',
      label: 'ビートフラッシュ',
      badge: 'キレ',
      desc: 'ビートの切替点でインパクトのある白フラッシュ＋バウンス演出',
      icon: Flame,
    },
    {
      id: 'zoom',
      label: 'クラッシュズーム',
      badge: 'ダイナミック',
      desc: '写真が吸い込まれるような急加速ズームイン＆ズームアウト切替',
      icon: Sparkles,
    },
    {
      id: 'cinematic',
      label: 'シネマティック（光フレア＆暗転）',
      badge: '映画調',
      desc: '温かい光のフレア（ライトリーク）とドラマチックな暗転切替',
      icon: SunMedium,
    },
    {
      id: 'auto',
      label: '曲調おまかせ',
      badge: '自動',
      desc: '選択された雰囲気プリセットと楽曲エネルギーに応じた自動バランス',
      icon: Wand2,
    },
    {
      id: 'crossfade',
      label: 'クラシッククロスフェード',
      badge: 'シンプル',
      desc: '写真同士が滑らかに溶け合う王道のディゾルブ演出',
      icon: Layers,
    },
  ];

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
            ステップ 3：プレビューと書き出し
          </h2>
          <p className="text-gray-500 text-sm mt-1">
            曲のリズムに合わせてKen Burns演出とトランジション、音声フェードが適用されています。
          </p>
        </div>

        {/* Aspect Ratio Switch */}
        <div className="flex items-center bg-gray-100 p-1 rounded-2xl border border-gray-200 text-xs font-semibold">
          <button
            onClick={() => onAspectChange('16:9')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all ${
              project.aspectRatio === '16:9'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>16:9 横向き (YouTube等)</span>
          </button>
          <button
            onClick={() => onAspectChange('9:16')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all ${
              project.aspectRatio === '9:16'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>9:16 縦向き (LINE/Reels等)</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Video Preview Canvas Area */}
        <div className="lg:col-span-8 flex flex-col items-center">
          {/* Canvas Container */}
          <div
            className={`relative bg-black rounded-3xl overflow-hidden shadow-xl border border-gray-800 flex items-center justify-center ${
              project.aspectRatio === '16:9'
                ? 'w-full aspect-16/9'
                : 'w-[320px] sm:w-[360px] aspect-9/16 max-h-[560px]'
            }`}
          >
            <canvas
              ref={canvasRef}
              className="w-full h-full object-contain cursor-pointer"
              onClick={togglePlay}
            />

            {/* Big Play Overlay when paused */}
            {!isPlaying && (
              <div
                onClick={togglePlay}
                className="absolute inset-0 bg-black/30 flex items-center justify-center cursor-pointer transition-opacity"
              >
                <div className="w-16 h-16 rounded-full bg-white/90 backdrop-blur-md text-gray-900 flex items-center justify-center shadow-2xl pl-1 hover:scale-110 transition-transform">
                  <Play className="w-8 h-8 fill-current" />
                </div>
              </div>
            )}

            {/* Vibe overlay badge */}
            <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md text-white px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>{PRESET_CONFIGS[project.preset] ? presetOptions.find(p => p.id === project.preset)?.label : '演出'}</span>
              <span className="opacity-40">•</span>
              <span className="text-indigo-300">
                {transitionStyleOptions.find(t => t.id === project.transitionStyle)?.label || '演出'}
              </span>
            </div>
          </div>

          {/* Player Controller Bar */}
          <div className="w-full bg-white rounded-2xl border border-gray-200 p-4 shadow-sm mt-4">
            {/* Seekbar */}
            <div className="flex items-center gap-3 mb-3">
              <span className="text-xs font-mono text-gray-600 font-semibold w-14">
                {formatTime(currentTime)}
              </span>

              <input
                type="range"
                min={0}
                max={totalDuration}
                step={0.05}
                value={currentTime}
                onChange={handleSeekChange}
                className="w-full accent-indigo-600 cursor-pointer h-2 bg-gray-100 rounded-lg"
              />

              <span className="text-xs font-mono text-gray-400 w-14 text-right">
                {formatTime(totalDuration)}
              </span>
            </div>

            {/* Playback Controls */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={togglePlay}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors"
                >
                  {isPlaying ? (
                    <>
                      <Pause className="w-4 h-4" />
                      <span>一時停止 (Space)</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-current" />
                      <span>再生 (Space)</span>
                    </>
                  )}
                </button>

                <button
                  onClick={handleRestart}
                  title="最初から再生"
                  className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>

              <div className="text-xs text-gray-400 flex items-center gap-1.5">
                <Volume2 className="w-4 h-4 text-gray-500" />
                <span>BPM: {song?.bpm}</span>
                <span>• 写真 {project.photos.length} 枚</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Settings & Export CTA Panel */}
        <div className="lg:col-span-4 flex flex-col gap-5">
          {/* Fade Settings Card */}
          <div className="bg-white rounded-3xl border border-gray-200 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <Sliders className="w-4 h-4 text-indigo-600" />
              <h3 className="font-bold text-gray-900 text-sm">楽曲・映像のフェード設定</h3>
            </div>
            <p className="text-xs text-gray-500 mb-3.5">
              動画の最初と最後の自然なフェードイン・フェードアウトを設定できます。
            </p>

            <div className="flex flex-col gap-3.5">
              {/* Head Fade-in */}
              <div className="p-3 bg-gray-50/70 rounded-2xl border border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-gray-800">曲頭のフェードイン</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={project.fadeIn}
                      onChange={(e) => onFadeChange({ fadeIn: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-8 h-4.5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>

                {project.fadeIn && (
                  <div className="flex items-center gap-1.5 pt-1">
                    {[0.5, 1.0, 1.5, 2.0].map((sec) => (
                      <button
                        key={sec}
                        type="button"
                        onClick={() => onFadeChange({ fadeInDuration: sec })}
                        className={`flex-1 py-1 px-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                          project.fadeInDuration === sec
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                        }`}
                      >
                        {sec}秒
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Tail Fade-out */}
              <div className="p-3 bg-gray-50/70 rounded-2xl border border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="text-xs font-bold text-gray-800">曲末のフェードアウト</span>
                    <span className="text-[10px] text-gray-400 block">（音声＆映像を黒へフェード）</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={project.fadeOut}
                      onChange={(e) => onFadeChange({ fadeOut: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-8 h-4.5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>

                {project.fadeOut && (
                  <div className="flex items-center gap-1.5 pt-1">
                    {[1.0, 2.0, 3.0, 4.0].map((sec) => (
                      <button
                        key={sec}
                        type="button"
                        onClick={() => onFadeChange({ fadeOutDuration: sec })}
                        className={`flex-1 py-1 px-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                          project.fadeOutDuration === sec
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                        }`}
                      >
                        {sec}秒
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Transition Style Selector */}
          <div className="bg-white rounded-3xl border border-gray-200 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4 text-amber-500" />
              <h3 className="font-bold text-gray-900 text-sm">トランジション（切り替え効果）</h3>
            </div>
            <p className="text-xs text-gray-500 mb-3">
              写真の切り替え演出をワンクリックで変更できます。
            </p>

            <div className="flex flex-col gap-1.5">
              {transitionStyleOptions.map((opt) => {
                const isSelected = (project.transitionStyle || 'dynamic') === opt.id;
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.id}
                    onClick={() => onTransitionStyleChange(opt.id)}
                    className={`text-left p-2.5 rounded-2xl border transition-all ${
                      isSelected
                        ? 'border-amber-500 bg-amber-50/60 ring-1 ring-amber-500 shadow-xs'
                        : 'border-gray-200 hover:border-amber-300 hover:bg-gray-50/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-6 h-6 rounded-lg flex items-center justify-center ${
                            isSelected
                              ? 'bg-amber-500 text-white'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <span className="font-bold text-xs text-gray-900">{opt.label}</span>
                      </div>
                      <span
                        className={`text-[9px] font-semibold px-2 py-0.5 rounded-full ${
                          isSelected
                            ? 'bg-amber-600 text-white'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {opt.badge}
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-500 mt-1 pl-8 leading-tight">{opt.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Preset Selector */}
          <div className="bg-white rounded-3xl border border-gray-200 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <h3 className="font-bold text-gray-900 text-sm">雰囲気プリセット</h3>
            </div>

            <div className="flex flex-col gap-1.5">
              {presetOptions.map((opt) => {
                const isSelected = project.preset === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => onPresetChange(opt.id)}
                    className={`text-left p-2.5 rounded-2xl border transition-all ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/70 ring-1 ring-indigo-600'
                        : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-gray-900">{opt.label}</span>
                      {isSelected && (
                        <span className="text-[9px] uppercase font-bold bg-indigo-600 text-white px-2 py-0.5 rounded-full">
                          選択中
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-gray-500 mt-0.5">{opt.sub}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Export Primary Action Card */}
          <div className="bg-gradient-to-br from-indigo-900 to-violet-950 rounded-3xl p-6 text-white shadow-xl">
            <div className="flex items-center gap-2 mb-2">
              <Film className="w-5 h-5 text-indigo-300" />
              <h3 className="font-bold text-base">MP4ムービー書き出し</h3>
            </div>
            <p className="text-xs text-indigo-200 mb-5 leading-relaxed">
              H.264＋AAC形式で書き出し、LINEやiPhone等でそのまま再生・共有できる高画質動画を作成します。
            </p>

            <button
              onClick={() => {
                if (playerRef.current) playerRef.current.pause();
                setIsPlaying(false);
                onStartExport();
              }}
              disabled={!project.timeline || project.timeline.isExceeded}
              className="w-full py-4 px-6 rounded-2xl bg-white text-indigo-950 font-bold text-sm shadow-lg hover:bg-indigo-50 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Film className="w-4 h-4 text-indigo-600" />
              <span>MP4を書き出す</span>
            </button>

            <p className="text-[11px] text-indigo-300/80 text-center mt-3">
              完全クライアント内処理 • サーバー送信なし
            </p>
          </div>

          {/* Back Navigation */}
          <button
            onClick={() => {
              if (playerRef.current) playerRef.current.pause();
              setIsPlaying(false);
              onPrev();
            }}
            className="flex items-center justify-center gap-1.5 py-3 px-4 rounded-2xl border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>写真の変更（ステップ2へ戻る）</span>
          </button>
        </div>
      </div>
    </div>
  );
};
