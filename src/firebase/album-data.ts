import type { Album } from '../models/gallery.js';

type StoredAlbum = Omit<
  Album,
  'photos' | 'photoOrder' | 'coverPhotoId' | 'publishedAt'
> & {
  photos?: Album['photos'] | null;
  photoOrder?: string[] | Record<string, string> | null;
  coverPhotoId?: string | null;
  publishedAt?: number | null;
};

// Realtime Database omits empty collections and null-valued fields.
export const albumValues = (value: unknown): Album[] => {
  if (!value || typeof value !== 'object') return [];
  return Object.values(value as Record<string, StoredAlbum>)
    .map(album => ({
      ...album,
      photos: album.photos ?? {},
      photoOrder: Object.values(album.photoOrder ?? {}).filter(
        (id): id is string => typeof id === 'string',
      ),
      coverPhotoId: album.coverPhotoId ?? null,
      publishedAt: album.publishedAt ?? null,
    }))
    .sort(
      (left, right) =>
        (right.publishedAt ?? right.updatedAt) -
        (left.publishedAt ?? left.updatedAt),
    );
};

export const emptyDraftDeletion = (value: unknown): null | undefined => {
  if (value === null) return null;
  if (!value || typeof value !== 'object') return undefined;
  const album = value as Partial<StoredAlbum>;
  return album.status === 'draft' &&
    Object.keys(album.photos ?? {}).length === 0
    ? null
    : undefined;
};
