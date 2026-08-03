import type { Album, GalleryPhoto } from '../models/gallery.js';

const publicPhoto = (photo: GalleryPhoto): GalleryPhoto => {
  const safePhoto = { ...photo, publicPaths: [...photo.publicPaths] };
  delete safePhoto.originalPath;
  return safePhoto;
};

export const publicAlbum = (album: Album): Album => ({
  ...album,
  status: 'published',
  photos: Object.fromEntries(
    Object.entries(album.photos)
      .filter(([, photo]) => photo.visible)
      .map(([id, photo]) => [id, publicPhoto(photo)]),
  ),
  photoOrder: album.photoOrder.filter(id => album.photos[id]?.visible),
});

export const publicationChanges = (
  album: Album,
  albums: readonly Album[],
  now = Date.now(),
): { published: Album; changes: Record<string, unknown> } => {
  const published: Album = {
    ...album,
    status: 'published',
    updatedAt: now,
    publishedAt: album.publishedAt ?? now,
  };
  const changes: Record<string, unknown> = {
    [`private/albums/${album.id}`]: published,
    [`public/albums/${album.id}`]: publicAlbum(published),
  };

  if (album.featured) {
    for (const otherAlbum of albums) {
      if (otherAlbum.id === album.id || !otherAlbum.featured) continue;
      changes[`private/albums/${otherAlbum.id}/featured`] = false;
      if (otherAlbum.status === 'published')
        changes[`public/albums/${otherAlbum.id}/featured`] = false;
    }
  }

  return { published, changes };
};
