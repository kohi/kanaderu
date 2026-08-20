import type { PhotoItem, PhotoVisualMetrics, SongData } from '../../types/project';

/**
 * Computes visual properties (brightness, saturation, warmth, contrast, energy score)
 * by downsampling the image onto a lightweight 32x32 offscreen canvas.
 */
export function extractVisualMetrics(
  source: ImageBitmap | HTMLCanvasElement
): PhotoVisualMetrics {
  const defaultMetrics: PhotoVisualMetrics = {
    brightness: 0.5,
    saturation: 0.5,
    warmth: 0.5,
    contrast: 0.5,
    energyScore: 0.5,
  };

  const sampleSize = 32;
  let canvas: HTMLCanvasElement | OffscreenCanvas | null = null;

  if (typeof OffscreenCanvas !== 'undefined') {
    canvas = new OffscreenCanvas(sampleSize, sampleSize);
  } else if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
    canvas = document.createElement('canvas');
    canvas.width = sampleSize;
    canvas.height = sampleSize;
  }

  if (!canvas) {
    return defaultMetrics;
  }

  const ctx = canvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;

  if (!ctx || typeof ctx.drawImage !== 'function' || typeof ctx.getImageData !== 'function') {
    return defaultMetrics;
  }

  try {
    ctx.drawImage(source as CanvasImageSource, 0, 0, sampleSize, sampleSize);
    const imgData = ctx.getImageData(0, 0, sampleSize, sampleSize).data;
    const totalPixels = sampleSize * sampleSize;

    let totalLuminance = 0;
    let totalSaturation = 0;
    let totalWarmth = 0;
    const luminances: number[] = [];

    for (let i = 0; i < imgData.length; i += 4) {
      const r = imgData[i] / 255;
      const g = imgData[i + 1] / 255;
      const b = imgData[i + 2] / 255;

      // Standard Perceived Luminance
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      luminances.push(lum);
      totalLuminance += lum;

      // Saturation (max - min) / max
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const sat = max === 0 ? 0 : (max - min) / max;
      totalSaturation += sat;

      // Warmth: Red/Amber bias vs Blue bias
      const warm = Math.max(0, Math.min(1, (r - b + 1) / 2));
      totalWarmth += warm;
    }

    const avgBrightness = totalLuminance / totalPixels;
    const avgSaturation = totalSaturation / totalPixels;
    const avgWarmth = totalWarmth / totalPixels;

    // Standard deviation for contrast
    let variance = 0;
    for (let i = 0; i < totalPixels; i++) {
      const diff = luminances[i] - avgBrightness;
      variance += diff * diff;
    }
    const stdDev = Math.sqrt(variance / totalPixels);
    const contrast = Math.min(1, stdDev * 3);

    // Composite visual energy score (high saturation + contrast + clarity = high energy)
    const energyScore = Math.max(
      0,
      Math.min(1, avgSaturation * 0.45 + contrast * 0.35 + avgBrightness * 0.2)
    );

    return {
      brightness: avgBrightness,
      saturation: avgSaturation,
      warmth: avgWarmth,
      contrast,
      energyScore,
    };
  } catch (e) {
    return defaultMetrics;
  }
}

/**
 * Ensures visual metrics are calculated and cached on the photo items.
 */
export function ensurePhotoMetrics(photos: PhotoItem[]): PhotoItem[] {
  return photos.map((p) => {
    if (p.visualMetrics) return p;
    try {
      const metrics = extractVisualMetrics(p.bitmap as ImageBitmap | HTMLCanvasElement);
      return { ...p, visualMetrics: metrics };
    } catch (e) {
      return {
        ...p,
        visualMetrics: {
          brightness: 0.5,
          saturation: 0.5,
          warmth: 0.5,
          contrast: 0.5,
          energyScore: 0.5,
        },
      };
    }
  });
}

/**
 * Smartly arranges photo order to match the narrative arc & energy peaks of the song.
 * High-vibrancy & dramatic photos are placed at the song's musical peaks (chorus/climax),
 * while calmer/atmospheric photos set the tone for the intro and outro.
 */
export function orderPhotosBySongFlow(
  photos: PhotoItem[],
  song: SongData
): PhotoItem[] {
  if (photos.length <= 2) return [...photos];

  const enrichedPhotos = ensurePhotoMetrics(photos);
  const N = enrichedPhotos.length;
  const trimStart = song.trimStart || 0;
  const trimEnd = song.trimEnd || song.duration;
  const duration = Math.max(0.1, trimEnd - trimStart);
  const segDuration = duration / N;

  // 1. Calculate target energy profile across the song timeline
  const targetEnergies: { index: number; time: number; energy: number }[] = [];

  for (let i = 0; i < N; i++) {
    const time = trimStart + (i + 0.5) * segDuration;
    let energy = song.rms;

    if (song.energyCurve && song.energyCurve.length > 0) {
      const pt = song.energyCurve.find((p) => Math.abs(p.time - time) < segDuration);
      if (pt) energy = pt.energy;
    }

    // Add mild natural narrative arc weight: intro (mellow) -> build -> peak -> calm outro
    const progress = i / (N - 1);
    let narrativeArc = 1.0;
    if (progress < 0.15) {
      narrativeArc = 0.75; // Intro mood
    } else if (progress > 0.45 && progress < 0.75) {
      narrativeArc = 1.25; // Climax / Chorus
    } else if (progress > 0.90) {
      narrativeArc = 0.8; // Outro fade
    }

    targetEnergies.push({
      index: i,
      time,
      energy: energy * narrativeArc,
    });
  }

  // 2. Rank timeline slots by energy requirement (highest energy to lowest)
  const slotRankings = [...targetEnergies].sort((a, b) => b.energy - a.energy);

  // 3. Rank photos by visual energy score (highest to lowest)
  const photoRankings = [...enrichedPhotos].sort(
    (a, b) => (b.visualMetrics?.energyScore || 0) - (a.visualMetrics?.energyScore || 0)
  );

  // 4. Assign photos to slots
  const result: PhotoItem[] = new Array(N);

  for (let rank = 0; rank < N; rank++) {
    const slot = slotRankings[rank];
    const photo = photoRankings[rank];
    result[slot.index] = photo;
  }

  return result;
}

/**
 * Randomly shuffles the photos using Fisher-Yates algorithm.
 */
export function shufflePhotos(photos: PhotoItem[]): PhotoItem[] {
  const arr = [...photos];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Natural alphanumeric sort by photo filename for chronological/album sequencing.
 */
export function sortPhotosByName(photos: PhotoItem[]): PhotoItem[] {
  return [...photos].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
  );
}
