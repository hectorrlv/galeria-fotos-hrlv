import type { PhotoCredit } from '../models/gallery.js';

export type ImageVariant = 'thumbnail' | 'grid' | 'viewer';

export interface ProcessedImage {
  readonly variant: ImageVariant;
  readonly blob: Blob;
  readonly width: number;
  readonly height: number;
}

export interface ImageProcessor {
  process(file: File, credit: PhotoCredit): Promise<readonly ProcessedImage[]>;
}
