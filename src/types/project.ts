export type AspectRatio = '16:9' | '9:16';

export type PresetType = 'slow' | 'standard' | 'up';

export type TransitionType =
  | 'crossfade'
  | 'flash'
  | 'zoom'
  | 'slide'
  | 'dip-black'
  | 'light-leak';

export type TransitionStyle =
  | 'auto' // Preset & energy adaptive mix
  | 'dynamic' // Punchy mix (flash, zoom, slide)
  | 'flash' // Beat flashes
  | 'zoom' // Crash zooms
  | 'cinematic' // Light leak & dip to black
  | 'crossfade'; // Smooth crossfade only

export interface PresetConfig {
  id: PresetType;
  label: string;
  subLabel: string;
  zoomStart: number;
  zoomEnd: number;
  crossfadeDuration: number;
  description: string;
}

export interface SongData {
  file: File;
  name: string;
  duration: number; // in seconds
  audioBuffer: AudioBuffer;
  bpm: number;
  firstBeatOffset: number; // in seconds
  beats: number[]; // beat timestamps in seconds
  rms: number; // overall RMS energy (0.0 - 1.0)
  energyCurve: { time: number; energy: number }[];
  trimStart: number; // in seconds (F16)
  trimEnd: number; // in seconds (F16)
  detectedPreset: PresetType;
}

export interface PhotoVisualMetrics {
  brightness: number; // 0.0 - 1.0
  saturation: number; // 0.0 - 1.0
  warmth: number; // 0.0 - 1.0 (warm vs cool tones)
  contrast: number; // 0.0 - 1.0
  energyScore: number; // 0.0 - 1.0 (composite vibrancy & contrast)
}

export interface PhotoItem {
  id: string;
  file: File;
  name: string;
  originalWidth: number;
  originalHeight: number;
  previewUrl: string;
  bitmap: ImageBitmap | HTMLCanvasElement;
  lockedDuration?: number; // Optional fixed display duration in seconds (undefined = auto)
  visualMetrics?: PhotoVisualMetrics;
}

export type PanDirection = 'left' | 'right' | 'up' | 'down' | 'up-left' | 'up-right' | 'down-left' | 'down-right' | 'center';
export type ZoomDirection = 'in' | 'out';

export interface PhotoAnimationConfig {
  zoomDirection: ZoomDirection;
  panDirection: PanDirection;
  panIntensity: number; // 0.0 - 1.0
}

export interface TimelineSegment {
  photoIndex: number;
  photoId: string;
  startTime: number; // in seconds (movie time axis)
  endTime: number; // in seconds
  duration: number; // in seconds
  crossfadeDuration: number; // in seconds
  transitionType: TransitionType;
  animation: PhotoAnimationConfig;
  isLocked?: boolean;
}

export interface TimelineMessage {
  type: 'info' | 'warning' | 'error';
  title: string;
  text: string;
}

export interface Timeline {
  totalDuration: number; // movie duration in seconds (T +/- 0.1s)
  segments: TimelineSegment[];
  isExceeded: boolean; // d < 1.5s or insufficient time warning
  hasInsufficientTime: boolean; // true if locked durations exceed total song time
  maxPhotosAllowed: number; // floor(T / 1.5)
  averageInterval: number; // average duration for unlocked photos
  lockedCount: number;
  lockedTotalTime: number;
  unlockedCount: number;
  unlockedAverageTime: number;
  messages: TimelineMessage[];
  headFadeDuration: number; // 0 if disabled, or e.g. 0.5s
  tailFadeDuration: number; // 0 if disabled, or e.g. 2.0s
}

export interface ProjectConfig {
  seed: number; // Seed for deterministic PRNG
  aspectRatio: AspectRatio;
  preset: PresetType;
  transitionStyle: TransitionStyle;
  fadeIn: boolean;
  fadeInDuration: number; // in seconds (e.g. 0.5s, 1.0s)
  fadeOut: boolean;
  fadeOutDuration: number; // in seconds (e.g. 2.0s, 3.0s)
  song: SongData | null;
  photos: PhotoItem[];
  timeline: Timeline | null;
}

export interface UserSettings {
  schemaVersion: number;
  aspect: AspectRatio;
  lastPreset: PresetType;
  lastTransitionStyle?: TransitionStyle;
  fadeIn?: boolean;
  fadeInDuration?: number;
  fadeOut?: boolean;
  fadeOutDuration?: number;
}

export interface RenderDimensions {
  width: number;
  height: number;
}

export interface CapabilityStatus {
  isSupported: boolean;
  videoEncoderSupported: boolean;
  audioEncoderSupported: boolean;
  isChromium: boolean;
  errorMessage?: string;
}

export interface ExportProgress {
  state: 'idle' | 'preparing' | 'encoding' | 'muxing' | 'completed' | 'cancelled' | 'error';
  encodedFrames: number;
  totalFrames: number;
  percent: number;
  elapsedMs: number;
  estimatedRemainingMs: number;
  error?: string;
  blob?: Blob;
  downloadUrl?: string;
  filename?: string;
}
