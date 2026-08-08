import assert from 'node:assert/strict';
import test from 'node:test';
import {
  albumCover,
  createDraftAlbum,
  orderedPhotos,
  type GalleryPhoto,
} from '../../src/models/gallery.js';

const photo = (id: string, visible = true): GalleryPhoto => ({
  id,
  albumId: 'album',
  fileName: `${id}.jpg`,
  width: 100,
  height: 80,
  caption: '',
  location: '',
  takenAt: '',
  altText: id,
  visible,
  publicPaths: [],
  urls: { thumbnail: '', grid: '', viewer: '' },
  credit: {
    position: 'auto',
    color: 'auto',
    opacity: 0.8,
    scale: 1,
    margin: 0.02,
  },
});

test('creates a stable empty draft', () => {
  const album = createDraftAlbum(123);
  assert.equal(album.status, 'draft');
  assert.equal(album.createdAt, 123);
  assert.deepEqual(album.photoOrder, []);
});

test('orders photos explicitly and chooses the first visible cover', () => {
  const album = createDraftAlbum();
  album.photos = { hidden: photo('hidden', false), cover: photo('cover') };
  album.photoOrder = ['hidden', 'missing', 'cover'];
  assert.deepEqual(
    orderedPhotos(album).map(item => item.id),
    ['hidden', 'cover'],
  );
  assert.equal(albumCover(album)?.id, 'cover');
});

test('falls back to the first visible photo when the selected cover is hidden', () => {
  const album = createDraftAlbum();
  album.photos = {
    selected: photo('selected', false),
    visible: photo('visible'),
  };
  album.photoOrder = ['selected', 'visible'];
  album.coverPhotoId = 'selected';

  assert.equal(albumCover(album)?.id, 'visible');
});
