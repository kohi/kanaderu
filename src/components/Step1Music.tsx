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
    slow: { title: 'ゆったり', badge: 'bg-[#F4F1EA] text-[#58534E] border-[#E5E1D6]' },
    standard: { title: 'スタンダード', badge: 'bg-[#F4F1EA] text-[#1C1917] border-[#E5E1D6]' },
    up: { title: 'アップテンポ', badge: 'bg-amber-50 text-amber-900 border-amber-200' },
  };

  return (
    <div className="max-w-4xl mx-auto py-10 px-4 sm:px-6">
      {/* Title */}
      <div className="mb-8">
        <h2 className="text-2xl sm:text-3xl font-bold text-[#1C1917] tracking-tight">
          ステップ 1：音楽の選択
        </h2>
        <p className="text-[#58534E] mt-1.5 text-sm">
          BGMとなる音楽ファイル（MP3 / M4A / WAV）を読み込みます。BPMとビート打点を自動解析します。
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
              ? 'border-amber-500 bg-amber-50/30'
              : 'border-[#CDC7B8] hover:border-[#1C1917] bg-[#FFFFFF] shadow-xs hover:shadow-sm'
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
            <div className="w-14 h-14 rounded-2xl bg-[#F4F1EA] text-[#1C1917] flex items-center justify-center border border-[#E5E1D6]">
              {isAnalyzing ? (
                <Disc className="w-6 h-6 animate-spin text-amber-600" />
              ) : (
                <Upload className="w-6 h-6" />
              )}
            </div>

            {isAnalyzing ? (
              <div>
                <p className="font-bold text-[#1C1917] text-base">楽曲を解析中...</p>
                <p className="text-xs text-amber-700 font-mono mt-1">{analyzeStep}</p>
                <p className="text-[11px] text-[#8E8880] mt-2">ブラウザ内で安全に解析しています（外部送信なし）</p>
              </div>
            ) : (
              <div>
                <p className="font-bold text-[#1C1917] text-base sm:text-lg">
                  音楽ファイルをここにドラッグ＆ドロップ
                </p>
                <p className="text-xs text-[#58534E] mt-1">または クリックしてファイルを選択</p>
                <div className="flex items-center justify-center gap-2 mt-4 text-xs text-[#8E8880]">
                  <span className="px-2.5 py-0.5 rounded-full bg-[#F4F1EA] font-mono border border-[#E5E1D6]">MP3</span>
                  <span className="px-2.5 py-0.5 rounded-full bg-[#F4F1EA] font-mono border border-[#E5E1D6]">M4A / AAC</span>
                  <span className="px-2.5 py-0.5 rounded-full bg-[#F4F1EA] font-mono border border-[#E5E1D6]">WAV</span>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Song Analysis Card & Trimming */
        <div className="bg-[#FFFFFF] rounded-3xl border border-[#E5E1D6] shadow-xs p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-[#E5E1D6]">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-[#1C1917] text-white flex items-center justify-center shrink-0">
                <Music className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-[#1C1917] text-base sm:text-lg truncate max-w-md">{song.name}</h3>
                  <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-medium border ${presetLabels[song.detectedPreset].badge}`}>
                    {presetLabels[song.detectedPreset].title}
                  </span>
                </div>
                <p className="text-xs font-mono text-[#8E8880] mt-0.5">
                  {(song.file.size / (1024 * 1024)).toFixed(1)} MB • {song.audioBuffer.numberOfChannels}ch • {song.audioBuffer.sampleRate}Hz
                </p>
              </div>
            </div>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-xs text-[#58534E] hover:text-[#1C1917] font-semibold px-3 py-1.5 rounded-xl border border-[#E5E1D6] hover:bg-[#F4F1EA] transition-colors"
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
            <div className="bg-[#FAF9F5] rounded-2xl p-4 border border-[#E5E1D6]">
              <div className="flex items-center gap-1.5 text-xs text-[#8E8880] font-medium">
                <Clock className="w-3.5 h-3.5" />
                <span>総時間</span>
              </div>
              <p className="text-lg font-bold text-[#1C1917] mt-1 font-mono">
                {formatSeconds(song.duration)}
              </p>
            </div>

            <div className="bg-[#FAF9F5] rounded-2xl p-4 border border-[#E5E1D6]">
              <div className="flex items-center gap-1.5 text-xs text-[#8E8880] font-medium">
                <Disc className="w-3.5 h-3.5" />
                <span>テンポ (BPM)</span>
              </div>
              <p className="text-lg font-bold text-[#1C1917] mt-1 font-mono">
                {song.bpm} <span className="text-xs font-normal text-[#8E8880]">BPM</span>
              </p>
            </div>

            <div className="bg-[#FAF9F5] rounded-2xl p-4 border border-[#E5E1D6]">
              <div className="flex items-center gap-1.5 text-xs text-[#8E8880] font-medium">
                <Zap className="w-3.5 h-3.5" />
                <span>エネルギー (RMS)</span>
              </div>
              <p className="text-lg font-bold text-[#1C1917] mt-1 font-mono">
                {(song.rms * 100).toFixed(0)}<span className="text-xs font-normal text-[#8E8880]">%</span>
              </p>
            </div>

            <div className="bg-[#FAF9F5] rounded-2xl p-4 border border-[#E5E1D6]">
              <div className="flex items-center gap-1.5 text-xs text-[#8E8880] font-medium">
                <Scissors className="w-3.5 h-3.5" />
                <span>使用区間</span>
              </div>
              <p className="text-lg font-bold text-amber-600 mt-1 font-mono">
                {formatSeconds(song.trimEnd - song.trimStart)}
              </p>
            </div>
          </div>

          {/* Song Trim (F16) */}
          <div className="bg-[#FAF9F5] rounded-2xl p-5 border border-[#E5E1D6] mb-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Scissors className="w-4 h-4 text-[#1C1917]" />
                <span className="font-bold text-xs text-[#1C1917]">曲のトリミング（サビ・使用区間）</span>
              </div>

              <button
                onClick={toggleAudition}
                className="flex items-center gap-1.5 text-xs font-semibold text-[#1C1917] bg-[#FFFFFF] shadow-xs border border-[#E5E1D6] px-3 py-1.5 rounded-xl hover:bg-[#F4F1EA] transition-colors"
              >
                {isPlayingAudition ? <Pause className="w-3.5 h-3.5 text-amber-600" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                <span>{isPlayingAudition ? '停止' : '区間を試聴'}</span>
              </button>
            </div>

            {/* Waveform / RMS Visual Bar */}
            <div className="h-12 bg-[#FFFFFF] rounded-xl border border-[#E5E1D6] overflow-hidden flex items-end px-2 py-1 gap-0.5 relative">
              {song.energyCurve.slice(0, 100).map((pt, idx) => {
                const isInsideTrim = pt.time >= song.trimStart && pt.time <= song.trimEnd;
                return (
                  <div
                    key={idx}
                    className={`flex-1 rounded-t-xs transition-colors ${
                      isInsideTrim ? 'bg-[#1C1917]' : 'bg-[#E5E1D6]'
                    }`}
                    style={{ height: `${Math.max(10, Math.min(100, pt.energy * 250))}%` }}
                  />
                );
              })}
            </div>

            {/* Trim Sliders & Inputs */}
            <div className="flex items-center gap-4 mt-3">
              <div className="flex-1 flex items-center gap-2">
                <span className="text-xs text-[#8E8880] font-mono">開始:</span>
                <input
                  type="range"
                  min={0}
                  max={song.duration - 1}
                  step={0.5}
                  value={song.trimStart}
                  onChange={(e) => handleTrimChange(parseFloat(e.target.value), song.trimEnd)}
                  className="w-full accent-[#1C1917] cursor-pointer"
                />
                <span className="text-xs font-mono font-semibold text-[#1C1917] w-10 text-right">
                  {formatSeconds(song.trimStart)}
                </span>
              </div>

              <div className="flex-1 flex items-center gap-2">
                <span className="text-xs text-[#8E8880] font-mono">終了:</span>
                <input
                  type="range"
                  min={song.trimStart + 1}
                  max={song.duration}
                  step={0.5}
                  value={song.trimEnd}
                  onChange={(e) => handleTrimChange(song.trimStart, parseFloat(e.target.value))}
                  className="w-full accent-[#1C1917] cursor-pointer"
                />
                <span className="text-xs font-mono font-semibold text-[#1C1917] w-10 text-right">
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
              className="flex items-center gap-2 px-6 py-3 bg-[#1C1917] hover:bg-[#292524] text-white font-semibold text-sm rounded-2xl shadow-xs transition-all"
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
