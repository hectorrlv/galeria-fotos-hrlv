import type {
  CreditColor,
  CreditPosition,
  PhotoCredit,
} from '../models/gallery.js';

export type ImageVariant = 'thumbnail' | 'grid' | 'viewer';

export interface ProcessedImage {
  variant: ImageVariant;
  blob: Blob;
  width: number;
  height: number;
}

export interface ResolvedPhotoCredit extends PhotoCredit {
  resolvedPosition: CreditPosition;
  resolvedColor: CreditColor;
  requiresReview: boolean;
}

export interface ImageProcessingResult {
  originalWidth: number;
  originalHeight: number;
  credit: ResolvedPhotoCredit;
  variants: ProcessedImage[];
}

export interface ImageProcessor {
  process(
    file: File,
    creditText: string,
    credit: PhotoCredit,
  ): Promise<ImageProcessingResult>;
}
