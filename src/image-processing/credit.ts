import type {
  CreditColor,
  CreditPosition,
  PhotoCredit,
} from '../models/gallery.js';
import type { ResolvedPhotoCredit } from './contracts.js';

export interface RegionStats {
  position: CreditPosition;
  luminance: number;
  variation: number;
}

export const creditContrastScore = (region: RegionStats): number =>
  Math.max(region.luminance, 1 - region.luminance) - region.variation * 0.75;

export const resolveCredit = (
  credit: PhotoCredit,
  regions: readonly RegionStats[],
): ResolvedPhotoCredit => {
  const fallback: RegionStats = {
    position: 'bottom-right',
    luminance: 0,
    variation: 0,
  };
  const selected =
    credit.position === 'auto'
      ? ([...regions].sort(
          (left, right) =>
            creditContrastScore(right) - creditContrastScore(left),
        )[0] ?? fallback)
      : (regions.find(region => region.position === credit.position) ??
        fallback);
  const resolvedColor: CreditColor =
    credit.color === 'auto'
      ? selected.luminance < 0.52
        ? 'light'
        : 'dark'
      : credit.color;

  return {
    ...credit,
    resolvedPosition: selected.position,
    resolvedColor,
    requiresReview: creditContrastScore(selected) < 0.34,
  };
};
