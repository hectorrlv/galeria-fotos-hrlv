export type AlbumStatus = 'draft' | 'published' | 'archived';

export type CreditPosition =
  'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export type CreditColor = 'light' | 'dark';

export interface PhotoCredit {
  position: CreditPosition | 'auto';
  color: CreditColor | 'auto';
  opacity: number;
  scale: number;
  margin: number;
  resolvedPosition?: CreditPosition;
  resolvedColor?: CreditColor;
  requiresReview?: boolean;
}

export interface PhotoVariantUrls {
  thumbnail: string;
  grid: string;
  viewer: string;
}

export interface GalleryPhoto {
  id: string;
  albumId: string;
  fileName: string;
  width: number;
  height: number;
  caption: string;
  location: string;
  takenAt: string;
  altText: string;
  visible: boolean;
  originalPath?: string;
  publicPaths: string[];
  urls: PhotoVariantUrls;
  credit: PhotoCredit;
}

export interface Album {
  id: string;
  slug: string;
  title: string;
  description: string;
  country: string;
  location: string;
  startDate: string;
  endDate: string;
  category: string;
  coverPhotoId: string | null;
  photoOrder: string[];
  photos: Record<string, GalleryPhoto>;
  status: AlbumStatus;
  featured: boolean;
  createdAt: number;
  updatedAt: number;
  publishedAt: number | null;
}

export interface SiteConfig {
  galleryName: string;
  introduction: string;
  creditText: string;
  about: string;
  instagramUrl: string;
  xUrl: string;
  defaultCredit: PhotoCredit;
}

export const DEFAULT_CREDIT: PhotoCredit = {
  position: 'auto',
  color: 'auto',
  opacity: 0.82,
  scale: 1,
  margin: 0.025,
};

export const DEFAULT_SITE_CONFIG: SiteConfig = {
  galleryName: 'Galería HRLV',
  introduction: 'Viajes, paseos y momentos reunidos en álbumes.',
  creditText: '@usuario',
  about:
    'Una colección personal de fotografías tomadas durante viajes y paseos.',
  instagramUrl: '',
  xUrl: '',
  defaultCredit: { ...DEFAULT_CREDIT },
};

export const createDraftAlbum = (now = Date.now()): Album => ({
  id: crypto.randomUUID(),
  slug: '',
  title: '',
  description: '',
  country: '',
  location: '',
  startDate: '',
  endDate: '',
  category: '',
  coverPhotoId: null,
  photoOrder: [],
  photos: {},
  status: 'draft',
  featured: false,
  createdAt: now,
  updatedAt: now,
  publishedAt: null,
});

export const orderedPhotos = (album: Album): GalleryPhoto[] =>
  album.photoOrder
    .map(id => album.photos[id])
    .filter((photo): photo is GalleryPhoto => photo !== undefined);

export const albumCover = (album: Album): GalleryPhoto | undefined => {
  const selected = album.coverPhotoId
    ? album.photos[album.coverPhotoId]
    : undefined;
  if (selected?.visible) return selected;
  return orderedPhotos(album).find(photo => photo.visible);
};
