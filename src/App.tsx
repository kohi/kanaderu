import { useEffect, useState } from 'react';
import type {
  AspectRatio,
  CapabilityStatus,
  ExportProgress,
  PhotoItem,
  PresetType,
  ProjectConfig,
  SongData,
  TransitionStyle,
} from './types/project';
import { checkBrowserCapabilities } from './core/capability/checkBrowser';
import { generateTimeline } from './core/timeline/generator';
import { exportToMp4 } from './core/exporter/mp4Exporter';
import type { ExportController } from './core/exporter/mp4Exporter';
import { loadSettings, saveSettings } from './core/utils/storage';
import { Header } from './components/Header';
import { BrowserBanner } from './components/BrowserBanner';
import { Step1Music } from './components/Step1Music';
import { Step2Photos } from './components/Step2Photos';
import { Step3Preview } from './components/Step3Preview';
import { ExportModal } from './components/ExportModal';
import { ToastContainer } from './components/Toast';
import type { ToastMessage } from './components/Toast';

export function App() {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [capability, setCapability] = useState<CapabilityStatus | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Project state
  const [seed, setSeed] = useState<number>(() => Math.floor(Math.random() * 1_000_000));
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(() => loadSettings().aspect);
  const [preset, setPreset] = useState<PresetType>(() => loadSettings().lastPreset);
  const [transitionStyle, setTransitionStyle] = useState<TransitionStyle>(
    () => loadSettings().lastTransitionStyle || 'dynamic'
  );
  const [fadeIn, setFadeIn] = useState<boolean>(() => loadSettings().fadeIn ?? true);
  const [fadeInDuration, setFadeInDuration] = useState<number>(() => loadSettings().fadeInDuration ?? 0.5);
  const [fadeOut, setFadeOut] = useState<boolean>(() => loadSettings().fadeOut ?? true);
  const [fadeOutDuration, setFadeOutDuration] = useState<number>(() => loadSettings().fadeOutDuration ?? 2.0);

  const [song, setSong] = useState<SongData | null>(null);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);

  // Export State
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);
  const [exportController, setExportController] = useState<ExportController | null>(null);

  // 1. Check Browser Capabilities on Mount (F13)
  useEffect(() => {
    checkBrowserCapabilities().then((status) => {
      setCapability(status);
      if (!status.isSupported && status.errorMessage) {
        addToast('warning', 'ブラウザ機能の制限', status.errorMessage);
      }
    });
  }, []);

  // 2. BeforeUnload Leave Guard (F14)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const isExporting =
        exportProgress?.state === 'preparing' ||
        exportProgress?.state === 'encoding' ||
        exportProgress?.state === 'muxing';

      if (song || photos.length > 0 || isExporting) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [song, photos.length, exportProgress?.state]);

  // Compute Timeline automatically with selected transitionStyle and fade options
  const timeline = song
    ? generateTimeline(
        song,
        photos,
        preset,
        seed,
        transitionStyle,
        fadeIn,
        fadeInDuration,
        fadeOut,
        fadeOutDuration
      )
    : null;

  const project: ProjectConfig = {
    seed,
    aspectRatio,
    preset,
    transitionStyle,
    fadeIn,
    fadeInDuration,
    fadeOut,
    fadeOutDuration,
    song,
    photos,
    timeline,
  };

  const addToast = (
    type: ToastMessage['type'],
    title: string,
    message?: string,
    detail?: string
  ) => {
    const id = `toast_${Date.now()}_${Math.random()}`;
    setToasts((prev) => [...prev, { id, type, title, message, detail }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 6000);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const handleSongLoaded = (loadedSong: SongData) => {
    setSong(loadedSong);
    setPreset(loadedSong.detectedPreset);
    saveSettings({ lastPreset: loadedSong.detectedPreset });
  };

  const handlePresetChange = (newPreset: PresetType) => {
    setPreset(newPreset);
    saveSettings({ lastPreset: newPreset });
  };

  const handleTransitionStyleChange = (newStyle: TransitionStyle) => {
    setTransitionStyle(newStyle);
    saveSettings({ lastTransitionStyle: newStyle });
  };

  const handleFadeChange = (opts: {
    fadeIn?: boolean;
    fadeInDuration?: number;
    fadeOut?: boolean;
    fadeOutDuration?: number;
  }) => {
    if (opts.fadeIn !== undefined) setFadeIn(opts.fadeIn);
    if (opts.fadeInDuration !== undefined) setFadeInDuration(opts.fadeInDuration);
    if (opts.fadeOut !== undefined) setFadeOut(opts.fadeOut);
    if (opts.fadeOutDuration !== undefined) setFadeOutDuration(opts.fadeOutDuration);
    saveSettings(opts);
  };

  const handleAspectChange = (newAspect: AspectRatio) => {
    setAspectRatio(newAspect);
    saveSettings({ aspect: newAspect });
  };

  const handleReset = () => {
    if (confirm('現在のプロジェクトをリセットして最初からやり直しますか？')) {
      setSong(null);
      setPhotos([]);
      setSeed(Math.floor(Math.random() * 1_000_000));
      setCurrentStep(1);
    }
  };

  const handleStartExport = () => {
    if (!song || !photos.length || !timeline) return;

    if (timeline.isExceeded) {
      addToast(
        'error',
        '写真枚数超過',
        `写真が多すぎるため書き出せません（最大${timeline.maxPhotosAllowed}枚）。`
      );
      return;
    }

    const { promise, controller } = exportToMp4(project, (prog) => {
      setExportProgress(prog);
    });

    setExportController(controller);

    promise
      .then(({ filename }) => {
        addToast('success', '書き出し完了', `${filename} の作成が完了しました。`);
      })
      .catch((err) => {
        if (err.message !== 'エクスポートがキャンセルされました。') {
          console.error('Export failed:', err);
          addToast('error', 'エクスポートエラー', err.message);
          setExportProgress({
            state: 'error',
            encodedFrames: 0,
            totalFrames: 1,
            percent: 0,
            elapsedMs: 0,
            estimatedRemainingMs: 0,
            error: err.message,
          });
        }
      });
  };

  const handleCancelExport = () => {
    if (exportController) {
      exportController.cancel();
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-gray-900 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Capability Warning Banner */}
      <BrowserBanner status={capability} />

      {/* Top Header */}
      <Header
        currentStep={currentStep}
        onStepClick={(step) => setCurrentStep(step)}
        hasSong={!!song}
        hasPhotos={photos.length > 0}
        onReset={handleReset}
      />

      {/* Main Content Area */}
      <main className="flex-1 pb-16">
        {currentStep === 1 && (
          <Step1Music
            song={song}
            onSongLoaded={handleSongLoaded}
            onNext={() => setCurrentStep(2)}
            onError={(title, msg, detail) => addToast('error', title, msg, detail)}
          />
        )}

        {currentStep === 2 && song && (
          <Step2Photos
            song={song}
            photos={photos}
            timeline={timeline}
            onPhotosChange={setPhotos}
            onPrev={() => setCurrentStep(1)}
            onNext={() => setCurrentStep(3)}
            onError={(title, msg, detail) => addToast('error', title, msg, detail)}
          />
        )}

        {currentStep === 3 && song && (
          <Step3Preview
            project={project}
            onPresetChange={handlePresetChange}
            onTransitionStyleChange={handleTransitionStyleChange}
            onFadeChange={handleFadeChange}
            onAspectChange={handleAspectChange}
            onStartExport={handleStartExport}
            onPrev={() => setCurrentStep(2)}
            onError={(title, msg, detail) => addToast('error', title, msg, detail)}
          />
        )}
      </main>

      {/* Export Modal */}
      {exportProgress && (
        <ExportModal
          progress={exportProgress}
          onCancel={handleCancelExport}
          onClose={() => setExportProgress(null)}
        />
      )}

      {/* Toasts */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
export default App;
