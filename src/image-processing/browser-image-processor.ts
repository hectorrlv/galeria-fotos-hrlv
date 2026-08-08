import type { CreditPosition, PhotoCredit } from '../models/gallery.js';
import { resolveCredit, type RegionStats } from './credit.js';
import type {
  ImageProcessingResult,
  ImageProcessor,
  ImageVariant,
  ProcessedImage,
  ResolvedPhotoCredit,
} from './contracts.js';

const VARIANTS: ReadonlyArray<{
  variant: ImageVariant;
  maxSize: number;
  quality: number;
}> = [
  { variant: 'thumbnail', maxSize: 640, quality: 0.76 },
  { variant: 'grid', maxSize: 1600, quality: 0.82 },
  { variant: 'viewer', maxSize: 2560, quality: 0.88 },
];

const POSITIONS: readonly CreditPosition[] = [
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right',
];

const canvasBlob = (
  canvas: HTMLCanvasElement,
  quality: number,
): Promise<Blob> =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => {
        if (blob) resolve(blob);
        else reject(new Error('No fue posible generar la imagen WebP.'));
      },
      'image/webp',
      quality,
    );
  });

const variantSize = (
  width: number,
  height: number,
  maxSize: number,
): { width: number; height: number } => {
  const ratio = Math.min(1, maxSize / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
};

const regionCoordinates = (
  position: CreditPosition,
  width: number,
  height: number,
) => {
  const regionWidth = Math.max(1, Math.round(width * 0.28));
  const regionHeight = Math.max(1, Math.round(height * 0.18));
  return {
    x: position.endsWith('right') ? width - regionWidth : 0,
    y: position.startsWith('bottom') ? height - regionHeight : 0,
    width: regionWidth,
    height: regionHeight,
  };
};

const analyzeRegions = (
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
): RegionStats[] =>
  POSITIONS.map(position => {
    const area = regionCoordinates(position, width, height);
    const pixels = context.getImageData(
      area.x,
      area.y,
      area.width,
      area.height,
    ).data;
    let luminanceSum = 0;
    let luminanceSquareSum = 0;
    const count = pixels.length / 4;
    for (let index = 0; index < pixels.length; index += 4) {
      const luminance =
        ((pixels[index] ?? 0) * 0.2126 +
          (pixels[index + 1] ?? 0) * 0.7152 +
          (pixels[index + 2] ?? 0) * 0.0722) /
        255;
      luminanceSum += luminance;
      luminanceSquareSum += luminance * luminance;
    }
    const luminance = count > 0 ? luminanceSum / count : 0;
    const variance =
      count > 0
        ? Math.max(0, luminanceSquareSum / count - luminance * luminance)
        : 0;
    return {
      position,
      luminance,
      variation: Math.sqrt(variance),
    };
  });

const applyCredit = (
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  text: string,
  credit: ResolvedPhotoCredit,
) => {
  if (!text.trim()) return;
  const fontSize = Math.max(
    12,
    Math.min(52, Math.round(width * 0.022 * credit.scale)),
  );
  const margin = Math.max(10, Math.round(width * credit.margin));
  const isRight = credit.resolvedPosition.endsWith('right');
  const isBottom = credit.resolvedPosition.startsWith('bottom');
  context.save();
  context.globalAlpha = credit.opacity;
  context.font = `600 ${fontSize}px ui-sans-serif, system-ui, sans-serif`;
  context.textAlign = isRight ? 'right' : 'left';
  context.textBaseline = isBottom ? 'bottom' : 'top';
  context.fillStyle = credit.resolvedColor === 'light' ? '#ffffff' : '#11110f';
  context.shadowColor =
    credit.resolvedColor === 'light'
      ? 'rgba(0, 0, 0, 0.65)'
      : 'rgba(255, 255, 255, 0.45)';
  context.shadowBlur = Math.max(2, Math.round(fontSize * 0.16));
  context.fillText(
    text.trim(),
    isRight ? width - margin : margin,
    isBottom ? height - margin : margin,
  );
  context.restore();
};

export class BrowserImageProcessor implements ImageProcessor {
  async process(
    file: File,
    creditText: string,
    credit: PhotoCredit,
  ): Promise<ImageProcessingResult> {
    const bitmap = await createImageBitmap(file, {
      imageOrientation: 'from-image',
    });
    try {
      const analysisSize = variantSize(bitmap.width, bitmap.height, 480);
      const analysisCanvas = document.createElement('canvas');
      analysisCanvas.width = analysisSize.width;
      analysisCanvas.height = analysisSize.height;
      const analysisContext = analysisCanvas.getContext('2d', {
        willReadFrequently: true,
      });
      if (!analysisContext) throw new Error('Canvas no está disponible.');
      analysisContext.drawImage(
        bitmap,
        0,
        0,
        analysisSize.width,
        analysisSize.height,
      );
      const resolvedCredit = resolveCredit(
        credit,
        analyzeRegions(
          analysisContext,
          analysisSize.width,
          analysisSize.height,
        ),
      );
      const variants: ProcessedImage[] = [];
      for (const definition of VARIANTS) {
        const size = variantSize(
          bitmap.width,
          bitmap.height,
          definition.maxSize,
        );
        const canvas = document.createElement('canvas');
        canvas.width = size.width;
        canvas.height = size.height;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Canvas no está disponible.');
        context.drawImage(bitmap, 0, 0, size.width, size.height);
        applyCredit(
          context,
          size.width,
          size.height,
          creditText,
          resolvedCredit,
        );
        variants.push({
          variant: definition.variant,
          blob: await canvasBlob(canvas, definition.quality),
          width: size.width,
          height: size.height,
        });
      }
      return {
        originalWidth: bitmap.width,
        originalHeight: bitmap.height,
        credit: resolvedCredit,
        variants,
      };
    } finally {
      bitmap.close();
    }
  }
}
