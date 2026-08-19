import { getAudioFadeGain } from './fade';

export interface PlayerState {
  isPlaying: boolean;
  currentTime: number; // Movie time (0 to totalDuration)
  duration: number;
}

export class AudioPreviewPlayer {
  private ctx: AudioContext | null = null;
  private sourceNode: AudioBufferSourceNode | null = null;
  private gainNode: GainNode | null = null;
  private buffer: AudioBuffer | null = null;
  private startTime: number = 0; // audioContext.currentTime when playback started
  private startOffset: number = 0; // offset in seconds within the movie time axis
  private trimStart: number = 0;
  private trimEnd: number = 0;
  private isPlaying: boolean = false;
  private headFade: number = 0.5;
  private tailFade: number = 2.0;
  private onTimeUpdateCallback?: (time: number) => void;
  private onEndedCallback?: () => void;
  private animationFrameId: number | null = null;

  constructor(onTimeUpdate?: (time: number) => void, onEnded?: () => void) {
    this.onTimeUpdateCallback = onTimeUpdate;
    this.onEndedCallback = onEnded;
  }

  public setAudioBuffer(
    buffer: AudioBuffer,
    trimStart: number = 0,
    trimEnd?: number,
    headFade: number = 0.5,
    tailFade: number = 2.0
  ) {
    this.stop();
    this.buffer = buffer;
    this.trimStart = trimStart;
    this.trimEnd = trimEnd !== undefined ? trimEnd : buffer.duration;
    this.headFade = headFade;
    this.tailFade = tailFade;
    this.startOffset = 0;
  }

  public setFadeOptions(headFade: number, tailFade: number) {
    this.headFade = headFade;
    this.tailFade = tailFade;
  }

  public get duration(): number {
    return Math.max(0, this.trimEnd - this.trimStart);
  }

  public get currentTime(): number {
    if (!this.isPlaying || !this.ctx) {
      return this.startOffset;
    }
    const elapsed = this.ctx.currentTime - this.startTime;
    const current = this.startOffset + elapsed;
    return Math.min(current, this.duration);
  }

  public async play(): Promise<void> {
    if (this.isPlaying || !this.buffer) return;

    if (!this.ctx || this.ctx.state === 'closed') {
      this.ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }

    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }

    if (this.startOffset >= this.duration) {
      this.startOffset = 0;
    }

    const source = this.ctx.createBufferSource();
    source.buffer = this.buffer;

    const gain = this.ctx.createGain();
    gain.gain.value = 1.0;

    source.connect(gain);
    gain.connect(this.ctx.destination);

    const actualBufferStart = this.trimStart + this.startOffset;
    const playDuration = Math.max(0, this.duration - this.startOffset);

    source.start(0, actualBufferStart, playDuration);

    this.sourceNode = source;
    this.gainNode = gain;
    this.startTime = this.ctx.currentTime;
    this.isPlaying = true;

    source.onended = () => {
      if (this.isPlaying && this.currentTime >= this.duration - 0.05) {
        this.stop();
        this.startOffset = 0;
        this.onEndedCallback?.();
      }
    };

    this.startTicker();
  }

  public pause(): void {
    if (!this.isPlaying) return;
    this.startOffset = this.currentTime;
    this.stopSource();
    this.isPlaying = false;
    this.stopTicker();
  }

  public stop(): void {
    this.stopSource();
    this.isPlaying = false;
    this.startOffset = 0;
    this.stopTicker();
  }

  public seek(targetMovieTime: number): void {
    const clamped = Math.max(0, Math.min(targetMovieTime, this.duration));
    const wasPlaying = this.isPlaying;

    if (wasPlaying) {
      this.stopSource();
    }

    this.startOffset = clamped;

    if (wasPlaying) {
      this.play();
    } else {
      this.onTimeUpdateCallback?.(clamped);
    }
  }

  private stopSource(): void {
    if (this.sourceNode) {
      try {
        this.sourceNode.onended = null;
        this.sourceNode.stop();
        this.sourceNode.disconnect();
      } catch (e) {
        // ignore already stopped error
      }
      this.sourceNode = null;
    }
  }

  private startTicker(): void {
    this.stopTicker();
    const tick = () => {
      if (this.isPlaying) {
        const time = this.currentTime;
        this.onTimeUpdateCallback?.(time);

        // Apply audio fade in real-time
        if (this.gainNode && this.ctx) {
          const gain = getAudioFadeGain(time, this.duration, this.headFade, this.tailFade);
          this.gainNode.gain.setValueAtTime(gain, this.ctx.currentTime);
        }

        this.animationFrameId = requestAnimationFrame(tick);
      }
    };
    this.animationFrameId = requestAnimationFrame(tick);
  }

  private stopTicker(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  public dispose(): void {
    this.stop();
    if (this.ctx && this.ctx.state !== 'closed') {
      this.ctx.close();
      this.ctx = null;
    }
  }
}
