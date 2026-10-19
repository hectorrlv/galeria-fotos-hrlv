import {
  createDraftAlbum,
  DEFAULT_CREDIT,
  type Album,
  type SharedPhoto,
} from '../../src/models/gallery.js';
import { publicAlbum } from '../../src/firebase/publication.js';
import {
  storedAlbum,
  type GalleryDatabase,
} from '../../src/firebase/shared-photos.js';

const photo = (id: string): SharedPhoto => {
  const image = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="480" height="320"><rect width="480" height="320" fill="#bacbd8"/><path d="M0 240 150 90 260 200 350 100 480 220V320H0Z" fill="#506e63"/></svg>')}`;
  return {
    id,
    fileName: `${id}.jpg`,
    width: 480,
    height: 320,
    caption: 'Junto al Sena',
    location: 'París',
    takenAt: '2026-10-01',
    altText: `Paisaje ${id}`,
    publicPaths: [`public/photos/${id}/grid.webp`],
    urls: { thumbnail: image, grid: image, viewer: image },
    credit: { ...DEFAULT_CREDIT },
  };
};

export const likesSeed = (): GalleryDatabase => {
  const photos = { p: photo('p'), q: photo('q') };
  const albums = ['viaje', 'favoritas'].map((id): Album => ({
    ...createDraftAlbum(1),
    id,
    slug: id,
    title: id === 'viaje' ? 'Viaje a Francia' : 'Mis favoritas',
    description: 'Relato de viaje',
    status: 'published',
    photoOrder: ['p', 'q'],
    coverPhotoId: 'p',
    photos: Object.fromEntries(
      Object.values(photos).map(p => [
        p.id,
        { ...p, albumId: id, visible: true },
      ]),
    ),
  }));
  return {
    private: {
      schemaVersion: 2,
      photos,
      albums: Object.fromEntries(albums.map(a => [a.id, storedAlbum(a)])),
    },
    public: {
      albums: Object.fromEntries(albums.map(a => [a.id, publicAlbum(a)])),
    },
  };
};
