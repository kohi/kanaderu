import { Muxer, ArrayBufferTarget } from 'mp4-muxer';
import type { ExportProgress, ProjectConfig } from '../../types/project';
import { getAudioFadeGain } from '../audio/fade';
import { RESOLUTIONS, render } from '../renderer/canvasRenderer';
import { findSupportedAACCodec, findSupportedH264Codec } from '../capability/checkBrowser';

export interface ExportController {
  cancel: () => void;
}

/**
 * Resamples an AudioBuffer segment to 48kHz stereo using OfflineAudioContext.
 */
async function resampleAudioBuffer(
  sourceBuffer: AudioBuffer,
  trimStart: number,
  trimEnd: number,
  targetSampleRate: number = 48000
): Promise<AudioBuffer> {
  const duration = Math.max(0.1, trimEnd - trimStart);
  const targetLength = Math.ceil(duration * targetSampleRate);
  const offlineCtx = new OfflineAudioContext(2, targetLength, targetSampleRate);

  const sourceNode = offlineCtx.createBufferSource();
  sourceNode.buffer = sourceBuffer;
  sourceNode.start(0, trimStart, duration);
  sourceNode.connect(offlineCtx.destination);

  return await offlineCtx.startRendering();
}

/**
 * Formats date as YYYYMMDD for output filename.
 */
function getFormattedDate(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

/**
 * Exports the project into an MP4 video file using WebCodecs (H.264 + AAC) and mp4-muxer.
 */
export function exportToMp4(
  project: ProjectConfig,
  onProgress: (progress: ExportProgress) => void
): { promise: Promise<{ blob: Blob; filename: string }>; controller: ExportController } {
  let isCancelled = false;
  let videoEncoder: VideoEncoder | null = null;
  let audioEncoder: AudioEncoder | null = null;

  const controller: ExportController = {
    cancel: () => {
      isCancelled = true;
    },
  };

  const promise = (async () => {
    const song = project.song;
    const timeline = project.timeline;

    if (!song || !timeline || !project.photos.length) {
      throw new Error('プロジェクトの素材が不足しています。');
    }

    const fps = 30;
    const totalDuration = timeline.totalDuration;
    const totalFrames = Math.max(1, Math.ceil(totalDuration * fps));
    const targetDimensions = RESOLUTIONS[project.aspectRatio] || RESOLUTIONS['16:9'];
    const { width, height } = targetDimensions;

    const startTimeMs = performance.now();

    onProgress({
      state: 'preparing',
      encodedFrames: 0,
      totalFrames,
      percent: 0,
      elapsedMs: 0,
      estimatedRemainingMs: 0,
    });

    // Determine supported codecs dynamically for the given resolution
    const videoCodec = (await findSupportedH264Codec(width, height)) || 'avc1.420028';
    const audioCodec = (await findSupportedAACCodec()) || 'mp4a.40.2';

    // 1. Setup MP4 Muxer with ArrayBufferTarget
    const target = new ArrayBufferTarget();
    const muxer = new Muxer({
      target,
      video: {
        codec: 'avc',
        width,
        height,
      },
      audio: {
        codec: 'aac',
        numberOfChannels: 2,
        sampleRate: 48000,
      },
      fastStart: 'in-memory',
      firstTimestampBehavior: 'offset',
    });

    // 2. Initialize VideoEncoder (H.264)
    videoEncoder = new VideoEncoder({
      output: (chunk, meta) => {
        muxer.addVideoChunk(chunk, meta);
      },
      error: (e) => {
        console.error('VideoEncoder error:', e);
      },
    });

    videoEncoder.configure({
      codec: videoCodec,
      width,
      height,
      bitrate: 8_000_000,
      framerate: fps,
    });

    // 3. Initialize AudioEncoder (AAC)
    audioEncoder = new AudioEncoder({
      output: (chunk, meta) => {
        muxer.addAudioChunk(chunk, meta);
      },
      error: (e) => {
        console.error('AudioEncoder error:', e);
      },
    });

    audioEncoder.configure({
      codec: audioCodec,
      sampleRate: 48000,
      numberOfChannels: 2,
      bitrate: 192000,
    });

    // 4. Resample audio to 48kHz stereo
    const resampledAudio = await resampleAudioBuffer(
      song.audioBuffer,
      song.trimStart || 0,
      song.trimEnd || song.duration,
      48000
    );

    if (isCancelled) {
      videoEncoder.close();
      audioEncoder.close();
      onProgress({
        state: 'cancelled',
        encodedFrames: 0,
        totalFrames,
        percent: 0,
        elapsedMs: 0,
        estimatedRemainingMs: 0,
      });
      throw new Error('エクスポートがキャンセルされました。');
    }

    // 5. Encode Audio in chunks of 1024 frames (f32-planar)
    const audioChannel0 = resampledAudio.getChannelData(0);
    const audioChannel1 = resampledAudio.numberOfChannels > 1 ? resampledAudio.getChannelData(1) : audioChannel0;
    const totalAudioSamples = audioChannel0.length;
    const samplesPerChunk = 1024;
    const sampleRate = 48000;

    for (let offset = 0; offset < totalAudioSamples; offset += samplesPerChunk) {
      if (isCancelled) break;

      const frameCount = Math.min(samplesPerChunk, totalAudioSamples - offset);
      // Planar layout: Channel 0 data followed by Channel 1 data
      const planarData = new Float32Array(frameCount * 2);

      for (let i = 0; i < frameCount; i++) {
        const sampleIdx = offset + i;
        const sampleTime = sampleIdx / sampleRate;
        const fadeGain = getAudioFadeGain(sampleTime, totalDuration, timeline.headFadeDuration, timeline.tailFadeDuration);

        planarData[i] = (audioChannel0[sampleIdx] || 0) * fadeGain;
        planarData[frameCount + i] = (audioChannel1[sampleIdx] || 0) * fadeGain;
      }

      const audioTimestampMicros = Math.round((offset / sampleRate) * 1_000_000);

      const audioData = new AudioData({
        format: 'f32-planar',
        sampleRate,
        numberOfFrames: frameCount,
        numberOfChannels: 2,
        timestamp: audioTimestampMicros,
        data: planarData,
      });

      audioEncoder.encode(audioData);
      audioData.close();

      // Audio encoder backpressure
      if (audioEncoder.encodeQueueSize > 10) {
        await new Promise((r) => setTimeout(r, 10));
      }
    }

    // 6. Setup offline canvas for rendering video frames
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
    if (!ctx) {
      throw new Error('Canvas 2D contextの初期化に失敗しました。');
    }

    // 7. Video Frame-by-Frame Rendering Loop (non-rAF)
    onProgress({
      state: 'encoding',
      encodedFrames: 0,
      totalFrames,
      percent: 0,
      elapsedMs: 0,
      estimatedRemainingMs: 0,
    });

    const frameDurationMicros = Math.round(1_000_000 / fps);

    for (let frameIdx = 0; frameIdx < totalFrames; frameIdx++) {
      if (isCancelled) {
        break;
      }

      const t = frameIdx / fps;
      const timestampMicros = frameIdx * frameDurationMicros;

      // Render frame deterministically
      render(ctx, t, project, { width, height });

      const videoFrame = new VideoFrame(canvas, {
        timestamp: timestampMicros,
        duration: frameDurationMicros,
      });

      const isKeyFrame = frameIdx % 60 === 0;
      videoEncoder.encode(videoFrame, { keyFrame: isKeyFrame });
      videoFrame.close();

      // Report progress
      const now = performance.now();
      const elapsedMs = now - startTimeMs;
      const progressPercent = Math.round(((frameIdx + 1) / totalFrames) * 100);
      const framesPerMs = (frameIdx + 1) / (elapsedMs || 1);
      const remainingFrames = totalFrames - (frameIdx + 1);
      const estimatedRemainingMs = Math.round(remainingFrames / framesPerMs);

      onProgress({
        state: 'encoding',
        encodedFrames: frameIdx + 1,
        totalFrames,
        percent: progressPercent,
        elapsedMs,
        estimatedRemainingMs,
      });

      // Video encoder backpressure
      if (videoEncoder.encodeQueueSize > 5) {
        await new Promise((r) => setTimeout(r, 8));
      }
    }

    if (isCancelled) {
      videoEncoder?.close();
      audioEncoder?.close();
      onProgress({
        state: 'cancelled',
        encodedFrames: 0,
        totalFrames,
        percent: 0,
        elapsedMs: 0,
        estimatedRemainingMs: 0,
      });
      throw new Error('エクスポートがキャンセルされました。');
    }

    // 8. Flush Encoders
    onProgress({
      state: 'muxing',
      encodedFrames: totalFrames,
      totalFrames,
      percent: 99,
      elapsedMs: performance.now() - startTimeMs,
      estimatedRemainingMs: 0,
    });

    await videoEncoder.flush();
    await audioEncoder.flush();

    videoEncoder.close();
    audioEncoder.close();

    // 9. Finalize MP4 Muxer
    muxer.finalize();

    const mp4Buffer = target.buffer;
    const blob = new Blob([mp4Buffer], { type: 'video/mp4' });
    const safeSongName = song.name.replace(/[/\\?%*:|"<>]/g, '_').trim() || 'movie';
    const filename = `${safeSongName}_${getFormattedDate()}.mp4`;
    const downloadUrl = URL.createObjectURL(blob);

    onProgress({
      state: 'completed',
      encodedFrames: totalFrames,
      totalFrames,
      percent: 100,
      elapsedMs: performance.now() - startTimeMs,
      estimatedRemainingMs: 0,
      blob,
      downloadUrl,
      filename,
    });

    return { blob, filename };
  })();

  return { promise, controller };
}
