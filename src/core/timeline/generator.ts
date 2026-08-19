import type {
  PhotoItem,
  PresetType,
  SongData,
  Timeline,
  TimelineMessage,
  TimelineSegment,
  TransitionStyle,
  TransitionType,
} from '../../types/project';
import { createPRNG, generatePhotoAnimations } from '../prng';

export const PRESET_CONFIGS: Record<PresetType, { crossfade: number; zoomStart: number; zoomEnd: number }> = {
  slow: {
    crossfade: 1.2,
    zoomStart: 1.0,
    zoomEnd: 1.06,
  },
  standard: {
    crossfade: 0.8,
    zoomStart: 1.0,
    zoomEnd: 1.08,
  },
  up: {
    crossfade: 0.4,
    zoomStart: 1.0,
    zoomEnd: 1.10,
  },
};

/**
 * Snaps a target time to the nearest beat within the allowed tolerance (+/- 0.5 beat).
 */
function snapToNearestBeat(
  targetTime: number,
  beats: number[],
  beatInterval: number
): number {
  if (!beats || beats.length === 0) return targetTime;

  let closestBeat = targetTime;
  let minDiff = Infinity;

  for (const beat of beats) {
    const diff = Math.abs(beat - targetTime);
    if (diff < minDiff) {
      minDiff = diff;
      closestBeat = beat;
    }
  }

  // Tolerance is +/- 0.5 beat interval
  const maxTolerance = beatInterval * 0.5;
  if (minDiff <= maxTolerance) {
    return closestBeat;
  }

  return targetTime;
}

/**
 * Determines transition type for a cut point based on style, preset, energy, and seeded PRNG.
 */
function selectTransitionType(
  cutTime: number,
  style: TransitionStyle,
  preset: PresetType,
  song: SongData,
  rng: () => number
): TransitionType {
  if (style === 'crossfade') return 'crossfade';
  if (style === 'flash') return 'flash';
  if (style === 'zoom') return 'zoom';
  if (style === 'cinematic') {
    return rng() > 0.4 ? 'light-leak' : 'dip-black';
  }

  // Find local energy near cut time (within +/- 0.5s window)
  let localEnergy = song.rms;
  if (song.energyCurve && song.energyCurve.length > 0) {
    const pt = song.energyCurve.find((p) => Math.abs(p.time - cutTime) < 0.6);
    if (pt) localEnergy = pt.energy;
  }

  const isHighEnergy = localEnergy >= 0.16 || preset === 'up';

  if (style === 'dynamic') {
    const roll = rng();
    if (isHighEnergy) {
      if (roll < 0.4) return 'flash';
      if (roll < 0.75) return 'zoom';
      return 'slide';
    } else {
      if (roll < 0.35) return 'zoom';
      if (roll < 0.65) return 'slide';
      if (roll < 0.85) return 'light-leak';
      return 'crossfade';
    }
  }

  if (preset === 'slow') {
    const roll = rng();
    if (roll < 0.6) return 'crossfade';
    if (roll < 0.85) return 'light-leak';
    return 'dip-black';
  }

  if (preset === 'up') {
    const roll = rng();
    if (roll < 0.45) return 'flash';
    if (roll < 0.75) return 'zoom';
    if (roll < 0.90) return 'slide';
    return 'crossfade';
  }

  // Standard preset
  const roll = rng();
  if (isHighEnergy) {
    if (roll < 0.35) return 'flash';
    if (roll < 0.65) return 'zoom';
    if (roll < 0.85) return 'slide';
    return 'crossfade';
  } else {
    if (roll < 0.4) return 'crossfade';
    if (roll < 0.65) return 'light-leak';
    if (roll < 0.85) return 'zoom';
    return 'slide';
  }
}

/**
 * Generates an automatic timeline synchronized with song duration, beats, vibe preset,
 * transition styles, and optional locked durations per photo.
 */
export function generateTimeline(
  song: SongData,
  photos: PhotoItem[],
  preset: PresetType,
  seed: number,
  transitionStyle: TransitionStyle = 'dynamic',
  fadeIn: boolean = true,
  fadeInDuration: number = 0.5,
  fadeOut: boolean = true,
  fadeOutDuration: number = 2.0
): Timeline {
  const trimStart = song.trimStart || 0;
  const trimEnd = song.trimEnd || song.duration;
  const totalDuration = Math.max(0.1, trimEnd - trimStart);
  const N = photos.length;

  const minInterval = 1.5;
  const maxPhotosAllowed = Math.max(1, Math.floor(totalDuration / minInterval));

  const headFadeDuration = fadeIn ? Math.max(0, fadeInDuration) : 0;
  const tailFadeDuration = fadeOut ? Math.max(0, fadeOutDuration) : 0;

  const messages: TimelineMessage[] = [];

  if (N === 0) {
    return {
      totalDuration,
      segments: [],
      isExceeded: false,
      hasInsufficientTime: false,
      maxPhotosAllowed,
      averageInterval: 0,
      lockedCount: 0,
      lockedTotalTime: 0,
      unlockedCount: 0,
      unlockedAverageTime: 0,
      messages: [],
      headFadeDuration,
      tailFadeDuration,
    };
  }

  // 1. Calculate locked vs unlocked photos statistics
  let lockedCount = 0;
  let lockedTotalTime = 0;
  let unlockedCount = 0;

  photos.forEach((p) => {
    if (p.lockedDuration && p.lockedDuration > 0) {
      lockedCount++;
      lockedTotalTime += p.lockedDuration;
    } else {
      unlockedCount++;
    }
  });

  const remainingTimeForUnlocked = totalDuration - lockedTotalTime;
  let unlockedAverageTime = unlockedCount > 0 ? remainingTimeForUnlocked / unlockedCount : 0;

  let isExceeded = false;
  let hasInsufficientTime = false;

  // 2. Validate timing constraints and generate user-facing messages
  if (lockedCount > 0) {
    if (unlockedCount > 0) {
      if (remainingTimeForUnlocked <= 0) {
        hasInsufficientTime = true;
        isExceeded = true;
        messages.push({
          type: 'error',
          title: '秒数が不足しています（写真が収まりません）',
          text: `固定した写真（${lockedCount}枚 / 計${lockedTotalTime.toFixed(1)}秒）が曲の長さ（${totalDuration.toFixed(1)}秒）を超えているため、残り${unlockedCount}枚の写真を表示する時間がありません。固定秒数を減らしてください。`,
        });
      } else if (unlockedAverageTime < 1.0) {
        hasInsufficientTime = true;
        isExceeded = true;
        messages.push({
          type: 'error',
          title: '他の写真の秒数が極端に不足しています',
          text: `写真の秒数固定により、残りの${unlockedCount}枚の表示時間が1枚あたり約${unlockedAverageTime.toFixed(1)}秒（最短1.0秒未満）になり、極端に短くなります。固定秒数を短くするか、写真枚数を減らしてください。`,
        });
      } else if (unlockedAverageTime < 1.5) {
        isExceeded = true;
        messages.push({
          type: 'warning',
          title: '他の写真の表示秒数が短縮されています',
          text: `特定の写真を固定したため、残りの${unlockedCount}枚の表示時間が1枚あたり約${unlockedAverageTime.toFixed(1)}秒（推奨1.5秒未満）に短縮されました。`,
        });
      } else {
        messages.push({
          type: 'info',
          title: '秒数固定を適用中',
          text: `${lockedCount}枚の写真を秒数固定しました。残りの${unlockedCount}枚は1枚あたり約${unlockedAverageTime.toFixed(1)}秒に自動調整されています。`,
        });
      }
    } else {
      // All photos locked
      if (lockedTotalTime > totalDuration + 0.2) {
        hasInsufficientTime = true;
        isExceeded = true;
        messages.push({
          type: 'error',
          title: '固定秒数の合計が曲の長さを超過しています',
          text: `すべての写真の固定秒数合計（${lockedTotalTime.toFixed(1)}秒）が曲の長さ（${totalDuration.toFixed(1)}秒）を超えています。一部の固定秒数を短くしてください。`,
        });
      } else if (lockedTotalTime < totalDuration - 1.0) {
        messages.push({
          type: 'info',
          title: '全写真固定（末尾延長）',
          text: `固定秒数の合計（${lockedTotalTime.toFixed(1)}秒）が曲の長さ（${totalDuration.toFixed(1)}秒）より短いため、最後の写真が曲の終わりまで表示されます。`,
        });
      }
    }
  } else {
    // No locked photos: standard uniform division check
    const average = totalDuration / N;
    if (average < minInterval) {
      isExceeded = true;
      messages.push({
        type: 'warning',
        title: '写真の枚数が多すぎます',
        text: `この曲の長さ（${totalDuration.toFixed(1)}秒）の場合、1枚あたりの表示時間を1.5秒以上確保するため、写真は最大 ${maxPhotosAllowed} 枚 までです。`,
      });
    }
  }

  // Fallback safe unlocked interval if time is negative
  const safeUnlockedInterval = Math.max(0.5, unlockedAverageTime);

  const defaultCrossfade = PRESET_CONFIGS[preset].crossfade;
  const beatInterval = song.bpm > 0 ? 60 / song.bpm : 0.5;

  const relativeBeats = song.beats
    .filter((b) => b >= trimStart && b <= trimEnd)
    .map((b) => b - trimStart);

  // 3. Compute cut points
  const cutPoints: number[] = [0];
  let accumulatedTime = 0;

  for (let i = 0; i < N - 1; i++) {
    const photo = photos[i];
    const isLocked = photo.lockedDuration && photo.lockedDuration > 0;
    const dur = isLocked ? photo.lockedDuration! : safeUnlockedInterval;
    accumulatedTime += dur;

    // Only snap to nearest beat if current photo is NOT locked and next boundary is flexible
    let pointTime = accumulatedTime;
    if (!isLocked) {
      pointTime = snapToNearestBeat(accumulatedTime, relativeBeats, beatInterval);
    }

    cutPoints.push(Math.max(cutPoints[cutPoints.length - 1] + 0.3, pointTime));
  }
  cutPoints.push(totalDuration);

  // 4. Ensure monotonically increasing boundaries capped to totalDuration
  for (let i = 1; i < cutPoints.length; i++) {
    const prev = cutPoints[i - 1];
    if (cutPoints[i] <= prev + 0.3) {
      cutPoints[i] = prev + 0.3;
    }
  }

  cutPoints[cutPoints.length - 1] = totalDuration;

  for (let i = cutPoints.length - 2; i >= 1; i--) {
    if (cutPoints[i] >= cutPoints[i + 1] - 0.3) {
      cutPoints[i] = cutPoints[i + 1] - 0.3;
    }
  }

  // 5. Generate Ken Burns and Transitions
  const animations = generatePhotoAnimations(N, seed);
  const transitionRng = createPRNG(seed ^ 0x5bf03635);

  const segments: TimelineSegment[] = [];

  for (let i = 0; i < N; i++) {
    const startTime = Math.max(0, cutPoints[i]);
    const endTime = Math.min(totalDuration, cutPoints[i + 1]);
    const segDuration = Math.max(0.1, endTime - startTime);
    const isLocked = !!(photos[i].lockedDuration && photos[i].lockedDuration! > 0);

    const transType = selectTransitionType(
      endTime + trimStart,
      transitionStyle,
      preset,
      song,
      transitionRng
    );

    let crossfade = defaultCrossfade;
    if (transType === 'flash') {
      crossfade = Math.min(0.35, segDuration * 0.25);
    } else if (transType === 'zoom') {
      crossfade = Math.min(0.55, segDuration * 0.35);
    } else if (transType === 'slide') {
      crossfade = Math.min(0.5, segDuration * 0.3);
    } else if (segDuration < 2.0) {
      crossfade = Math.min(0.4, segDuration * 0.3);
    }

    segments.push({
      photoIndex: i,
      photoId: photos[i].id,
      startTime,
      endTime,
      duration: segDuration,
      crossfadeDuration: crossfade,
      transitionType: transType,
      animation: animations[i],
      isLocked,
    });
  }

  return {
    totalDuration,
    segments,
    isExceeded,
    hasInsufficientTime,
    maxPhotosAllowed,
    averageInterval: unlockedCount > 0 ? unlockedAverageTime : (totalDuration / N),
    lockedCount,
    lockedTotalTime,
    unlockedCount,
    unlockedAverageTime,
    messages,
    headFadeDuration,
    tailFadeDuration,
  };
}
