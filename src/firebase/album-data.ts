import type {
  Album,
  AlbumPhotoReference,
  GalleryPhoto,
  SharedPhoto,
} from '../models/gallery.js';
import { sortAlbums } from '../models/album-order.js';

type StoredAlbum = Omit<
  Album,
  'photos' | 'photoOrder' | 'coverPhotoId' | 'publishedAt'
> & {
  photos?: Album['photos'] | null;
  photoOrder?: string[] | Record<string, string> | null;
  coverPhotoId?: string | null;
  publishedAt?: number | null;
  photoRefs?: Record<string, AlbumPhotoReference> | null;
};

// Realtime Database omits empty collections and null-valued fields.
export const albumValues = (
  value: unknown,
  photos: Record<string, SharedPhoto> = {},
): Album[] => {
  if (!value || typeof value !== 'object') return [];
  return sortAlbums(
    Object.values(value as Record<string, StoredAlbum>).map(
      ({ photoRefs, ...album }) => ({
        ...album,
        photos: photoRefs
          ? Object.fromEntries(
              Object.entries(photoRefs).flatMap(([id, membership]) => {
                const photo = photos[id];
                return photo
                  ? [
                      [
                        id,
                        {
                          ...photo,
                          albumId: album.id,
                          visible: membership.visible,
                        } satisfies GalleryPhoto,
                      ],
                    ]
                  : [];
              }),
            )
          : (album.photos ?? {}),
        photoOrder: Object.values(album.photoOrder ?? {}).filter(
          (id): id is string => typeof id === 'string',
        ),
        coverPhotoId: album.coverPhotoId ?? null,
        publishedAt: album.publishedAt ?? null,
      }),
    ),
  );
};

export const emptyDraftDeletion = (value: unknown): null | undefined => {
  if (value === null) return null;
  if (!value || typeof value !== 'object') return undefined;
  const album = value as Partial<StoredAlbum>;
  return album.status === 'draft' &&
    Object.keys(album.photos ?? album.photoRefs ?? {}).length === 0
    ? null
    : undefined;
};
