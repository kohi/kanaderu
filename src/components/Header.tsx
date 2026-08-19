import React from 'react';
import { Music, Image as ImageIcon, Film, ShieldCheck, RotateCcw } from 'lucide-react';
import { KanaderuLogo } from './KanaderuLogo';

interface HeaderProps {
  currentStep: 1 | 2 | 3;
  onStepClick: (step: 1 | 2 | 3) => void;
  hasSong: boolean;
  hasPhotos: boolean;
  onReset: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentStep,
  onStepClick,
  hasSong,
  hasPhotos,
  onReset,
}) => {
  const steps = [
    { number: 1, label: '音楽選択', icon: Music, ready: true },
    { number: 2, label: '写真配置', icon: ImageIcon, ready: hasSong },
    { number: 3, label: 'プレビュー・出力', icon: Film, ready: hasSong && hasPhotos },
  ] as const;

  return (
    <header className="bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-30 shadow-xs">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <KanaderuLogo className="w-10 h-10 shrink-0 hover:scale-105 transition-transform" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-lg text-gray-900 tracking-tight bg-gradient-to-r from-indigo-700 via-purple-700 to-pink-600 bg-clip-text text-transparent">
                Kanaderu
              </h1>
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 border border-indigo-100">
                v1.0
              </span>
            </div>
            <p className="text-xs text-gray-500 hidden sm:block">音楽と写真から曲に合わせたムービーを自動生成</p>
          </div>
        </div>

        {/* Step Wizard Navigation */}
        <nav className="flex items-center gap-1 sm:gap-2">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            const isActive = currentStep === step.number;
            const isCompleted = currentStep > step.number;
            const isClickable = step.ready;

            return (
              <React.Fragment key={step.number}>
                {idx > 0 && (
                  <div
                    className={`w-4 sm:w-8 h-0.5 rounded-full transition-colors ${
                      isCompleted ? 'bg-indigo-600' : 'bg-gray-200'
                    }`}
                  />
                )}
                <button
                  onClick={() => isClickable && onStepClick(step.number)}
                  disabled={!isClickable}
                  className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/25'
                      : isCompleted
                      ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                      : 'text-gray-400 hover:text-gray-600 disabled:opacity-40 disabled:hover:text-gray-400'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="hidden md:inline">{step.label}</span>
                </button>
              </React.Fragment>
            );
          })}
        </nav>

        {/* Right Action & Privacy Note */}
        <div className="flex items-center gap-3">
          <div className="hidden lg:flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-full">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>完全端末内処理（非送信）</span>
          </div>

          {(hasSong || hasPhotos) && (
            <button
              onClick={onReset}
              title="最初からやり直す"
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-rose-600 hover:bg-rose-50 px-2 py-1 rounded-lg transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">リセット</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
