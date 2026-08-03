export type AlbumStatus = 'draft' | 'published' | 'archived';

export interface Album {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly description: string;
  readonly country: string;
  readonly location: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly category: string;
  readonly coverPhotoId: string | null;
  readonly photoOrder: readonly string[];
  readonly status: AlbumStatus;
  readonly featured: boolean;
}

export type CreditPosition =
  'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export interface PhotoCredit {
  readonly position: CreditPosition | 'auto';
  readonly color: 'light' | 'dark' | 'auto';
  readonly opacity: number;
  readonly scale: number;
}

export interface GalleryPhoto {
  readonly id: string;
  readonly albumId: string;
  readonly width: number;
  readonly height: number;
  readonly caption: string;
  readonly location: string;
  readonly takenAt: string;
  readonly altText: string;
  readonly credit: PhotoCredit;
}
