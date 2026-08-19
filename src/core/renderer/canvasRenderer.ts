import type {
  PanDirection,
  PhotoAnimationConfig,
  PhotoItem,
  ProjectConfig,
  RenderDimensions,
  TransitionType,
} from '../../types/project';
import { getVideoFadeBlackAlpha, getVideoFadeInBlackAlpha } from '../audio/fade';
import { PRESET_CONFIGS } from '../timeline/generator';

export const RESOLUTIONS = {
  '16:9': { width: 1920, height: 1080 },
  '9:16': { width: 1080, height: 1920 },
} as const;

/**
 * Calculates pan translation delta (dx, dy) for Ken Burns effect.
 */
function calculatePanOffset(
  direction: PanDirection,
  progress: number,
  intensity: number,
  maxPanX: number,
  maxPanY: number
): { dx: number; dy: number } {
  const t = (progress - 0.5) * 2; // -1 to 1

  let nx = 0;
  let ny = 0;

  switch (direction) {
    case 'left':
      nx = -t;
      break;
    case 'right':
      nx = t;
      break;
    case 'up':
      ny = -t;
      break;
    case 'down':
      ny = t;
      break;
    case 'up-left':
      nx = -t * 0.707;
      ny = -t * 0.707;
      break;
    case 'up-right':
      nx = t * 0.707;
      ny = -t * 0.707;
      break;
    case 'down-left':
      nx = -t * 0.707;
      ny = t * 0.707;
      break;
    case 'down-right':
      nx = t * 0.707;
      ny = t * 0.707;
      break;
    case 'center':
    default:
      nx = 0;
      ny = 0;
      break;
  }

  return {
    dx: nx * maxPanX * intensity,
    dy: ny * maxPanY * intensity,
  };
}

interface PhotoLayerOptions {
  extraScale?: number;
  extraOffsetX?: number;
  extraOffsetY?: number;
  opacity?: number;
}

/**
 * Draws a single photo layer with Ken Burns transform and blurred background padding.
 */
function drawPhotoLayer(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  photo: PhotoItem,
  animation: PhotoAnimationConfig,
  progress: number, // 0.0 to 1.0 within segment
  dimensions: RenderDimensions,
  preset: ProjectConfig['preset'],
  options: PhotoLayerOptions = {}
) {
  const { width: targetWidth, height: targetHeight } = dimensions;
  const { extraScale = 1.0, extraOffsetX = 0, extraOffsetY = 0, opacity = 1.0 } = options;

  if (opacity <= 0.001) return;

  const img = photo.bitmap;
  const imgWidth = photo.originalWidth || img.width;
  const imgHeight = photo.originalHeight || img.height;

  const targetAspect = targetWidth / targetHeight;
  const imgAspect = imgWidth / imgHeight;

  const presetConfig = PRESET_CONFIGS[preset] || PRESET_CONFIGS.standard;
  const { zoomStart, zoomEnd } = presetConfig;

  // Compute base zoom scale
  let baseScale = 1.0;
  if (animation.zoomDirection === 'in') {
    baseScale = zoomStart + (zoomEnd - zoomStart) * progress;
  } else {
    baseScale = zoomEnd - (zoomEnd - zoomStart) * progress;
  }

  const finalScale = baseScale * extraScale;
  const isAspectMismatched = Math.abs(imgAspect - targetAspect) > 0.02;

  ctx.save();
  if (opacity < 1.0) {
    ctx.globalAlpha = ctx.globalAlpha * opacity;
  }

  // 1. Draw blurred cover background if aspect ratio is mismatched (prevent black bars)
  if (isAspectMismatched) {
    ctx.save();
    let bgScale = 1.0;
    if (imgAspect > targetAspect) {
      bgScale = targetHeight / imgHeight;
    } else {
      bgScale = targetWidth / imgWidth;
    }
    bgScale *= 1.15;

    const bgW = imgWidth * bgScale;
    const bgH = imgHeight * bgScale;
    const bgX = (targetWidth - bgW) / 2 + extraOffsetX;
    const bgY = (targetHeight - bgH) / 2 + extraOffsetY;

    ctx.filter = 'blur(28px) brightness(0.6)';
    ctx.drawImage(img, bgX, bgY, bgW, bgH);
    ctx.restore();
  }

  // 2. Draw foreground image with Ken Burns transform (contain fit + zoom + pan)
  ctx.save();

  let fitScale = 1.0;
  if (imgAspect > targetAspect) {
    fitScale = targetWidth / imgWidth;
  } else {
    fitScale = targetHeight / imgHeight;
  }

  const baseW = imgWidth * fitScale;
  const baseH = imgHeight * fitScale;

  const maxPanX = (baseW * (zoomEnd - 1.0)) * 0.5;
  const maxPanY = (baseH * (zoomEnd - 1.0)) * 0.5;

  const { dx, dy } = calculatePanOffset(
    animation.panDirection,
    progress,
    animation.panIntensity,
    maxPanX,
    maxPanY
  );

  const centerX = targetWidth / 2 + dx + extraOffsetX;
  const centerY = targetHeight / 2 + dy + extraOffsetY;

  ctx.translate(centerX, centerY);
  ctx.scale(finalScale, finalScale);

  if (isAspectMismatched) {
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 24;
  }

  ctx.drawImage(img, -baseW / 2, -baseH / 2, baseW, baseH);

  ctx.restore();
  ctx.restore();
}

/**
 * Draws cinematic light leak flare overlay.
 */
function drawLightLeakOverlay(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  progress: number, // 0 to 1
  dimensions: RenderDimensions
) {
  const { width, height } = dimensions;
  // Intensity peaks around middle
  const intensity = Math.sin(progress * Math.PI);
  if (intensity <= 0.01) return;

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = intensity * 0.85;

  const sweepX = width * (0.2 + progress * 0.6);
  const sweepY = height * 0.4;
  const radius = Math.max(width, height) * 0.7;

  const grad = ctx.createRadialGradient(sweepX, sweepY, 10, sweepX, sweepY, radius);
  grad.addColorStop(0, 'rgba(255, 220, 150, 0.9)');
  grad.addColorStop(0.35, 'rgba(255, 120, 50, 0.6)');
  grad.addColorStop(0.7, 'rgba(255, 70, 150, 0.3)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  ctx.restore();
}

/**
 * Pure deterministic rendering function for both real-time preview and offline video export.
 */
export function render(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  t: number,
  project: ProjectConfig,
  dimensions: RenderDimensions
): void {
  const { width, height } = dimensions;

  // Clear canvas to black
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, width, height);

  const timeline = project.timeline;
  const photos = project.photos;

  if (!timeline || !timeline.segments.length || !photos.length) {
    return;
  }

  const totalDuration = timeline.totalDuration;
  const clampedTime = Math.max(0, Math.min(t, totalDuration));

  // Find active segment
  let activeIndex = 0;
  for (let i = 0; i < timeline.segments.length; i++) {
    const seg = timeline.segments[i];
    if (clampedTime >= seg.startTime && clampedTime <= seg.endTime) {
      activeIndex = i;
      break;
    }
    if (clampedTime > seg.endTime && i === timeline.segments.length - 1) {
      activeIndex = i;
    }
  }

  const currentSegment = timeline.segments[activeIndex];
  const currentPhoto = photos[currentSegment.photoIndex];

  if (!currentPhoto) return;

  const currentProgress = Math.max(
    0,
    Math.min(1, (clampedTime - currentSegment.startTime) / currentSegment.duration)
  );

  const nextSegment = timeline.segments[activeIndex + 1];
  const nextPhoto = nextSegment ? photos[nextSegment.photoIndex] : null;

  const crossfadeStart = currentSegment.endTime - currentSegment.crossfadeDuration;
  const inTransition = nextSegment && nextPhoto && clampedTime >= crossfadeStart && clampedTime <= currentSegment.endTime;

  if (!inTransition) {
    // Normal single photo rendering
    drawPhotoLayer(
      ctx,
      currentPhoto,
      currentSegment.animation,
      currentProgress,
      dimensions,
      project.preset
    );
  } else {
    // Punchy Transition Rendering
    const transType: TransitionType = currentSegment.transitionType || 'crossfade';
    const transProgress = Math.max(
      0,
      Math.min(1, (clampedTime - crossfadeStart) / currentSegment.crossfadeDuration)
    );
    const nextProgress = Math.max(
      0,
      Math.min(1, (clampedTime - nextSegment.startTime) / nextSegment.duration)
    );

    switch (transType) {
      case 'flash': {
        // White beat flash transition
        // Before midpoint: show outgoing. At & after midpoint: show incoming with impact bounce
        const isPastMid = transProgress >= 0.5;
        const flashIntensity = 1.0 - Math.abs(transProgress - 0.5) * 2; // 0 -> 1 -> 0

        if (!isPastMid) {
          drawPhotoLayer(
            ctx,
            currentPhoto,
            currentSegment.animation,
            currentProgress,
            dimensions,
            project.preset
          );
        } else {
          // Impact scale: 1.05 down to 1.0
          const impactScale = 1.0 + (1.0 - (transProgress - 0.5) * 2) * 0.06;
          drawPhotoLayer(
            ctx,
            nextPhoto,
            nextSegment.animation,
            nextProgress,
            dimensions,
            project.preset,
            { extraScale: impactScale }
          );
        }

        // White flash burst overlay
        if (flashIntensity > 0.01) {
          ctx.save();
          ctx.fillStyle = `rgba(255, 255, 255, ${(flashIntensity * 0.95).toFixed(3)})`;
          ctx.fillRect(0, 0, width, height);
          ctx.restore();
        }
        break;
      }

      case 'zoom': {
        // Crash zoom / Zoom through transition
        // Outgoing zooms in rapidly (1.0 -> 1.45)
        const zoomOutScale = 1.0 + transProgress * 0.45;
        const outOpacity = Math.max(0, 1.0 - transProgress * 1.5);

        drawPhotoLayer(
          ctx,
          currentPhoto,
          currentSegment.animation,
          currentProgress,
          dimensions,
          project.preset,
          { extraScale: zoomOutScale, opacity: outOpacity }
        );

        // Incoming zooms in from 1.35 -> 1.0 with fade in
        const zoomInScale = 1.35 - transProgress * 0.35;
        const inOpacity = Math.max(0, Math.min(1, (transProgress - 0.25) / 0.75));

        drawPhotoLayer(
          ctx,
          nextPhoto,
          nextSegment.animation,
          nextProgress,
          dimensions,
          project.preset,
          { extraScale: zoomInScale, opacity: inOpacity }
        );
        break;
      }

      case 'slide': {
        // Dynamic push slide with seam shadow
        // Outgoing slides to the left
        const easeSlide = transProgress * transProgress * (3 - 2 * transProgress);
        const offsetXOut = -easeSlide * width;
        const offsetXIn = (1 - easeSlide) * width;

        drawPhotoLayer(
          ctx,
          currentPhoto,
          currentSegment.animation,
          currentProgress,
          dimensions,
          project.preset,
          { extraOffsetX: offsetXOut }
        );

        drawPhotoLayer(
          ctx,
          nextPhoto,
          nextSegment.animation,
          nextProgress,
          dimensions,
          project.preset,
          { extraOffsetX: offsetXIn }
        );

        // Seam shadow line
        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
        ctx.shadowBlur = 30;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.fillRect(offsetXIn - 4, 0, 8, height);
        ctx.restore();
        break;
      }

      case 'dip-black': {
        // Dramatic Dip to black
        if (transProgress < 0.5) {
          const fadeOutOpacity = 1.0 - transProgress * 2;
          drawPhotoLayer(
            ctx,
            currentPhoto,
            currentSegment.animation,
            currentProgress,
            dimensions,
            project.preset,
            { opacity: fadeOutOpacity }
          );
        } else {
          const fadeInOpacity = (transProgress - 0.5) * 2;
          drawPhotoLayer(
            ctx,
            nextPhoto,
            nextSegment.animation,
            nextProgress,
            dimensions,
            project.preset,
            { opacity: fadeInOpacity }
          );
        }
        break;
      }

      case 'light-leak': {
        // Cinematic warm flare crossfade
        drawPhotoLayer(
          ctx,
          currentPhoto,
          currentSegment.animation,
          currentProgress,
          dimensions,
          project.preset
        );

        drawPhotoLayer(
          ctx,
          nextPhoto,
          nextSegment.animation,
          nextProgress,
          dimensions,
          project.preset,
          { opacity: transProgress }
        );

        drawLightLeakOverlay(ctx, transProgress, dimensions);
        break;
      }

      case 'crossfade':
      default: {
        // Standard smooth dissolve
        drawPhotoLayer(
          ctx,
          currentPhoto,
          currentSegment.animation,
          currentProgress,
          dimensions,
          project.preset
        );

        drawPhotoLayer(
          ctx,
          nextPhoto,
          nextSegment.animation,
          nextProgress,
          dimensions,
          project.preset,
          { opacity: transProgress }
        );
        break;
      }
    }
  }

  // 3. Render black fade in / fade out overlays (head & tail fade)
  if (timeline.headFadeDuration > 0 && clampedTime < timeline.headFadeDuration) {
    const fadeInAlpha = getVideoFadeInBlackAlpha(clampedTime, timeline.headFadeDuration);
    if (fadeInAlpha > 0) {
      ctx.save();
      ctx.fillStyle = `rgba(0, 0, 0, ${fadeInAlpha.toFixed(3)})`;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }
  }

  if (timeline.tailFadeDuration > 0) {
    const tailAlpha = getVideoFadeBlackAlpha(clampedTime, totalDuration, timeline.tailFadeDuration);
    if (tailAlpha > 0) {
      ctx.save();
      ctx.fillStyle = `rgba(0, 0, 0, ${tailAlpha.toFixed(3)})`;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }
  }
}
