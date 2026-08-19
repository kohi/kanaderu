import { describe, it, expect } from 'vitest';
import {
  getAudioFadeGain,
  getVideoFadeBlackAlpha,
  getVideoFadeInBlackAlpha,
} from '../core/audio/fade';
import { determineVibePreset } from '../core/audio/analyzer';

describe('Audio & Video Fade Curves', () => {
  const duration = 20.0; // 20s track

  it('should apply head fade-in over 0.5s by default', () => {
    expect(getAudioFadeGain(0, duration)).toBe(0);
    expect(getAudioFadeGain(0.25, duration)).toBeCloseTo(0.5, 2);
    expect(getAudioFadeGain(0.5, duration)).toBe(1.0);
    expect(getAudioFadeGain(5.0, duration)).toBe(1.0);
  });

  it('should allow disabling head fade-in (headFade = 0)', () => {
    expect(getAudioFadeGain(0, duration, 0, 2.0)).toBe(1.0);
    expect(getVideoFadeInBlackAlpha(0, 0)).toBe(0);
  });

  it('should allow custom head fade-in duration (e.g. 1.5s)', () => {
    expect(getAudioFadeGain(0.75, duration, 1.5, 2.0)).toBeCloseTo(0.5, 2);
    expect(getVideoFadeInBlackAlpha(0, 1.5)).toBe(1.0);
    expect(getVideoFadeInBlackAlpha(1.5, 1.5)).toBe(0);
  });

  it('should apply tail fade-out over 2.0s by default', () => {
    expect(getAudioFadeGain(18.0, duration)).toBe(1.0); // 20 - 2.0 = 18.0s start
    expect(getAudioFadeGain(19.0, duration)).toBeCloseTo(0.5, 2);
    expect(getAudioFadeGain(20.0, duration)).toBe(0.0);
  });

  it('should allow disabling tail fade-out (tailFade = 0)', () => {
    expect(getAudioFadeGain(19.5, duration, 0.5, 0)).toBe(1.0);
    expect(getVideoFadeBlackAlpha(19.5, duration, 0)).toBe(0);
  });

  it('should allow custom tail fade-out duration (e.g. 4.0s)', () => {
    expect(getAudioFadeGain(16.0, duration, 0.5, 4.0)).toBe(1.0);
    expect(getAudioFadeGain(18.0, duration, 0.5, 4.0)).toBeCloseTo(0.5, 2);
    expect(getVideoFadeBlackAlpha(18.0, duration, 4.0)).toBeGreaterThan(0);
  });
});

describe('Vibe Preset Detection', () => {
  it('should detect slow vibe for low BPM or low RMS', () => {
    expect(determineVibePreset(80, 0.15)).toBe('slow');
    expect(determineVibePreset(110, 0.08)).toBe('slow');
  });

  it('should detect up vibe for high BPM and high RMS', () => {
    expect(determineVibePreset(140, 0.20)).toBe('up');
  });

  it('should detect standard vibe for medium values', () => {
    expect(determineVibePreset(115, 0.14)).toBe('standard');
  });
});
