import { describe, it, expect } from 'vitest';
import {
  extractVisualMetrics,
  orderPhotosBySongFlow,
  shufflePhotos,
  sortPhotosByName,
} from '../core/utils/photoAnalyzer';
import type { PhotoItem, SongData } from '../types/project';

describe('photoAnalyzer & smart photo ordering', () => {
  const createMockPhoto = (
    id: string,
    name: string,
    brightness: number,
    saturation: number
  ): PhotoItem => {
    return {
      id,
      file: new File([], name),
      name,
      originalWidth: 1920,
      originalHeight: 1080,
      previewUrl: 'blob:test',
      bitmap: {} as ImageBitmap,
      visualMetrics: {
        brightness,
        saturation,
        warmth: 0.5,
        contrast: 0.5,
        energyScore: saturation * 0.5 + brightness * 0.5,
      },
    };
  };

  const mockSong: SongData = {
    file: new File([], 'song.mp3'),
    name: 'song.mp3',
    duration: 30,
    audioBuffer: {} as AudioBuffer,
    bpm: 120,
    firstBeatOffset: 0.5,
    beats: [0.5, 1.0, 1.5, 2.0],
    rms: 0.6,
    energyCurve: [
      { time: 0, energy: 0.2 },
      { time: 10, energy: 0.4 },
      { time: 15, energy: 0.95 }, // Climax
      { time: 20, energy: 0.8 },
      { time: 30, energy: 0.1 },
    ],
    trimStart: 0,
    trimEnd: 30,
    detectedPreset: 'standard',
  };

  it('safely extracts fallback metrics when canvas context is unavailable', () => {
    const metrics = extractVisualMetrics({} as ImageBitmap);
    expect(metrics.brightness).toBe(0.5);
    expect(metrics.energyScore).toBe(0.5);
  });

  it('shuffles photos randomly', () => {
    const photos = [
      createMockPhoto('1', 'photo1.jpg', 0.2, 0.1),
      createMockPhoto('2', 'photo2.jpg', 0.5, 0.5),
      createMockPhoto('3', 'photo3.jpg', 0.9, 0.9),
      createMockPhoto('4', 'photo4.jpg', 0.7, 0.3),
      createMockPhoto('5', 'photo5.jpg', 0.4, 0.8),
    ];

    const shuffled = shufflePhotos(photos);
    expect(shuffled.length).toBe(photos.length);
    expect(shuffled.map((p) => p.id).sort()).toEqual(photos.map((p) => p.id).sort());
  });

  it('sorts photos naturally by filename', () => {
    const photos = [
      createMockPhoto('3', 'IMG_10.jpg', 0.5, 0.5),
      createMockPhoto('1', 'IMG_2.jpg', 0.5, 0.5),
      createMockPhoto('2', 'IMG_1.jpg', 0.5, 0.5),
    ];

    const sorted = sortPhotosByName(photos);
    expect(sorted.map((p) => p.name)).toEqual(['IMG_1.jpg', 'IMG_2.jpg', 'IMG_10.jpg']);
  });

  it('orders photos by song flow matching energy peaks to dramatic photos', () => {
    const photos = [
      createMockPhoto('calm1', 'calm1.jpg', 0.2, 0.1),
      createMockPhoto('calm2', 'calm2.jpg', 0.3, 0.2),
      createMockPhoto('peak', 'climax.jpg', 0.9, 0.9),
      createMockPhoto('mid', 'mid.jpg', 0.5, 0.5),
    ];

    const reordered = orderPhotosBySongFlow(photos, mockSong);
    expect(reordered.length).toBe(photos.length);

    // Peak photo should be placed around the middle (where song climax occurs)
    const peakIndex = reordered.findIndex((p) => p.id === 'peak');
    expect(peakIndex).toBeGreaterThanOrEqual(1);
    expect(peakIndex).toBeLessThanOrEqual(2);
  });
});
