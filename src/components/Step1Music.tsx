import React, { useRef, useState } from 'react';
import { Upload, Music, Disc, Zap, Clock, ArrowRight, Play, Pause, Scissors } from 'lucide-react';
import type { SongData } from '../types/project';
import { analyzeAudioFile } from '../core/audio/analyzer';

interface Step1MusicProps {
  song: SongData | null;
  onSongLoaded: (song: SongData) => void;
  onNext: () => void;
  onError: (title: string, message: string, detail?: string) => void;
}

export const Step1Music: React.FC<Step1MusicProps> = ({
  song,
  onSongLoaded,
  onNext,
  onError,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeStep, setAnalyzeStep] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Audition playback for trimmed segment
  const [isPlayingAudition, setIsPlayingAudition] = useState(false);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || !files.length) return;
    const file = files[0];

    const validExtensions = /\.(mp3|m4a|wav|aac|ogg)$/i;
    if (!validExtensions.test(file.name) && !file.type.startsWith('audio/')) {
      onError('非対応ファイル形式', 'mp3, m4a, wav 等の音声ファイルを選択してください。');
      return;
    }

    setIsAnalyzing(true);
    try {
      const analyzedSong = await analyzeAudioFile(file, (step) => {
        setAnalyzeStep(step);
      });
      onSongLoaded(analyzedSong);
    } catch (err: unknown) {
      console.error('Audio analysis failed:', err);
      const errorMsg = err instanceof Error ? err.message : String(err);
      onError('音楽の読み込み・解析に失敗しました', errorMsg);
    } finally {
      setIsAnalyzing(false);
      setAnalyzeStep('');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const stopAudition = () => {
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop();
        sourceNodeRef.current.disconnect();
      } catch (e) {
        // ignore
      }
      sourceNodeRef.current = null;
    }
    setIsPlayingAudition(false);
  };

  const toggleAudition = () => {
    if (!song) return;

    if (isPlayingAudition) {
      stopAudition();
      return;
    }

    try {
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();

      const source = ctx.createBufferSource();
      source.buffer = song.audioBuffer;
      source.connect(ctx.destination);

      const trimStart = song.trimStart || 0;
      const trimEnd = song.trimEnd || song.duration;
      const playDuration = Math.max(0, trimEnd - trimStart);

      source.start(0, trimStart, playDuration);
      sourceNodeRef.current = source;
      setIsPlayingAudition(true);

      source.onended = () => {
        setIsPlayingAudition(false);
      };
    } catch (e) {
      console.error('Audition failed:', e);
      setIsPlayingAudition(false);
    }
  };

  const handleTrimChange = (start: number, end: number) => {
    if (!song) return;
    stopAudition();
    const clampedStart = Math.max(0, Math.min(start, song.duration - 1));
    const clampedEnd = Math.max(clampedStart + 1, Math.min(end, song.duration));

    onSongLoaded({
      ...song,
      trimStart: clampedStart,
      trimEnd: clampedEnd,
    });
  };

  const presetLabels = {
    slow: { title: 'ゆったり', color: 'bg-teal-50 text-teal-700 border-teal-200' },
    standard: { title: 'スタンダード', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
    up: { title: 'アップテンポ', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      {/* Introduction */}
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl tracking-tight">
          ステップ 1：音楽を選んでください
        </h2>
        <p className="text-gray-500 mt-2 text-sm max-w-lg mx-auto">
          お気に入りの1曲（mp3 / m4a / wav）をドロップするだけで、BPMとリズムを自動解析します。
        </p>
      </div>

      {/* Upload Drop Zone */}
      {!song ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => !isAnalyzing && fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-3xl p-12 text-center transition-all cursor-pointer ${
            isDragging
              ? 'border-indigo-500 bg-indigo-50/50 scale-[1.01]'
              : 'border-gray-300 hover:border-indigo-400 bg-white shadow-xs hover:shadow-md'
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => handleFiles(e.target.files)}
            accept="audio/mp3,audio/wav,audio/m4a,audio/aac,audio/*,.mp3,.m4a,.wav"
            className="hidden"
          />

          <div className="flex flex-col items-center justify-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-inner">
              {isAnalyzing ? (
                <Disc className="w-8 h-8 animate-spin" />
              ) : (
                <Upload className="w-8 h-8" />
              )}
            </div>

            {isAnalyzing ? (
              <div>
                <p className="font-semibold text-gray-800 text-lg">音楽を解析中...</p>
                <p className="text-sm text-indigo-600 mt-1 font-medium">{analyzeStep}</p>
                <p className="text-xs text-gray-400 mt-2">ブラウザ内で安全に解析しています</p>
              </div>
            ) : (
              <div>
                <p className="font-semibold text-gray-800 text-lg">
                  音楽ファイルをここにドラッグ＆ドロップ
                </p>
                <p className="text-sm text-gray-500 mt-1">または クリックしてファイルを選択</p>
                <div className="flex items-center justify-center gap-2 mt-4 text-xs text-gray-400">
                  <span className="px-2 py-0.5 rounded bg-gray-100 font-mono">MP3</span>
                  <span className="px-2 py-0.5 rounded bg-gray-100 font-mono">M4A (AAC)</span>
                  <span className="px-2 py-0.5 rounded bg-gray-100 font-mono">WAV</span>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Song Analysis Card & Trimming */
        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-gray-100">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-500 to-violet-600 text-white flex items-center justify-center shadow-md">
                <Music className="w-7 h-7" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-gray-900 text-lg truncate max-w-md">{song.name}</h3>
                  <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium border ${presetLabels[song.detectedPreset].color}`}>
                    {presetLabels[song.detectedPreset].title}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  {(song.file.size / (1024 * 1024)).toFixed(1)} MB • {song.audioBuffer.numberOfChannels}ch • {song.audioBuffer.sampleRate}Hz
                </p>
              </div>
            </div>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium px-3 py-1.5 rounded-lg border border-indigo-100 hover:bg-indigo-50 transition-colors"
            >
              曲を変更
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => handleFiles(e.target.files)}
              accept="audio/*,.mp3,.m4a,.wav"
              className="hidden"
            />
          </div>

          {/* Analysis Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-6">
            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
              <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
                <Clock className="w-3.5 h-3.5 text-indigo-500" />
                <span>曲の長さ</span>
              </div>
              <p className="text-lg font-bold text-gray-900 mt-1 font-mono">
                {formatSeconds(song.duration)}
              </p>
            </div>

            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
              <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
                <Disc className="w-3.5 h-3.5 text-violet-500" />
                <span>テンポ (BPM)</span>
              </div>
              <p className="text-lg font-bold text-gray-900 mt-1 font-mono">
                {song.bpm} <span className="text-xs font-normal text-gray-400">BPM</span>
              </p>
            </div>

            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
              <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                <span>エネルギー (RMS)</span>
              </div>
              <p className="text-lg font-bold text-gray-900 mt-1 font-mono">
                {(song.rms * 100).toFixed(0)} <span className="text-xs font-normal text-gray-400">%</span>
              </p>
            </div>

            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
              <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
                <Scissors className="w-3.5 h-3.5 text-emerald-500" />
                <span>ムービー尺 (トリム)</span>
              </div>
              <p className="text-lg font-bold text-indigo-600 mt-1 font-mono">
                {formatSeconds(song.trimEnd - song.trimStart)}
              </p>
            </div>
          </div>

          {/* Song Trim (F16) */}
          <div className="bg-indigo-50/40 rounded-2xl p-5 border border-indigo-100/60 mb-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Scissors className="w-4 h-4 text-indigo-600" />
                <span className="font-semibold text-sm text-gray-900">曲のトリミング（使用区間）</span>
              </div>

              <button
                onClick={toggleAudition}
                className="flex items-center gap-1.5 text-xs font-medium text-indigo-700 bg-white shadow-xs border border-indigo-200 px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors"
              >
                {isPlayingAudition ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                <span>{isPlayingAudition ? '停止' : '区間を試聴'}</span>
              </button>
            </div>

            {/* Waveform / RMS Visual Bar */}
            <div className="h-12 bg-white rounded-xl border border-gray-200 overflow-hidden flex items-end px-2 py-1 gap-0.5 relative">
              {song.energyCurve.slice(0, 100).map((pt, idx) => {
                const isInsideTrim = pt.time >= song.trimStart && pt.time <= song.trimEnd;
                return (
                  <div
                    key={idx}
                    className={`flex-1 rounded-t-xs transition-colors ${
                      isInsideTrim ? 'bg-indigo-500' : 'bg-gray-200'
                    }`}
                    style={{ height: `${Math.max(10, Math.min(100, pt.energy * 250))}%` }}
                  />
                );
              })}
            </div>

            {/* Trim Sliders & Inputs */}
            <div className="flex items-center gap-4 mt-3">
              <div className="flex-1 flex items-center gap-2">
                <span className="text-xs text-gray-500 font-mono">開始:</span>
                <input
                  type="range"
                  min={0}
                  max={song.duration - 1}
                  step={0.5}
                  value={song.trimStart}
                  onChange={(e) => handleTrimChange(parseFloat(e.target.value), song.trimEnd)}
                  className="w-full accent-indigo-600"
                />
                <span className="text-xs font-mono text-gray-700 w-10 text-right">
                  {formatSeconds(song.trimStart)}
                </span>
              </div>

              <div className="flex-1 flex items-center gap-2">
                <span className="text-xs text-gray-500 font-mono">終了:</span>
                <input
                  type="range"
                  min={song.trimStart + 1}
                  max={song.duration}
                  step={0.5}
                  value={song.trimEnd}
                  onChange={(e) => handleTrimChange(song.trimStart, parseFloat(e.target.value))}
                  className="w-full accent-indigo-600"
                />
                <span className="text-xs font-mono text-gray-700 w-10 text-right">
                  {formatSeconds(song.trimEnd)}
                </span>
              </div>
            </div>
          </div>

          {/* Action Button */}
          <div className="flex justify-end pt-2">
            <button
              onClick={() => {
                stopAudition();
                onNext();
              }}
              className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl shadow-md shadow-indigo-600/20 transition-all hover:scale-[1.01]"
            >
              <span>写真を選ぶ（ステップ2へ）</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
