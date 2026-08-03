import assert from 'node:assert/strict';
import test from 'node:test';
import {
  publicAlbum,
  publicationChanges,
} from '../../src/firebase/publication.js';
import {
  createDraftAlbum,
  type Album,
  type GalleryPhoto,
} from '../../src/models/gallery.js';

const photo = (id: string, visible = true): GalleryPhoto => ({
  id,
  albumId: 'current',
  fileName: `${id}.jpg`,
  width: 1200,
  height: 800,
  caption: `Caption ${id}`,
  location: 'Lugar',
  takenAt: '2026-08-03',
  altText: id,
  visible,
  originalPath: `originals/current/${id}/original.jpg`,
  publicPaths: [`public/current/${id}/viewer.webp`],
  urls: {
    thumbnail: `https://example.com/${id}-thumbnail.webp`,
    grid: `https://example.com/${id}-grid.webp`,
    viewer: `https://example.com/${id}-viewer.webp`,
  },
  credit: {
    position: 'auto',
    color: 'auto',
    opacity: 0.8,
    scale: 1,
    margin: 0.02,
  },
});

const album = (): Album => {
  const value = createDraftAlbum(100);
  value.id = 'current';
  value.title = 'Álbum publicado';
  value.slug = 'album-publicado';
  value.status = 'published';
  value.publishedAt = 200;
  value.photos = {
    removed: photo('removed', false),
    edited: photo('edited'),
    added: photo('added'),
  };
  value.photoOrder = ['added', 'removed', 'edited'];
  value.coverPhotoId = 'added';
  return value;
};

test('creates an ordered public snapshot without hidden or private photo data', () => {
  const snapshot = publicAlbum(album());

  assert.deepEqual(snapshot.photoOrder, ['added', 'edited']);
  assert.deepEqual(Object.keys(snapshot.photos).sort(), ['added', 'edited']);
  assert.equal(snapshot.photos.edited?.caption, 'Caption edited');
  assert.equal(snapshot.photos.edited?.originalPath, undefined);
  assert.deepEqual(snapshot.photos.edited?.publicPaths, [
    'public/current/edited/viewer.webp',
  ]);
});

test('updates private and public albums atomically while preserving publication date', () => {
  const current = album();
  current.featured = true;
  const otherPublished = {
    ...createDraftAlbum(10),
    id: 'other-published',
    status: 'published' as const,
    featured: true,
  };
  const otherDraft = {
    ...createDraftAlbum(20),
    id: 'other-draft',
    featured: true,
  };
  const { published, changes } = publicationChanges(
    current,
    [current, otherPublished, otherDraft],
    300,
  );

  assert.equal(published.publishedAt, 200);
  assert.equal(published.updatedAt, 300);
  assert.equal(changes['private/albums/current'], published);
  assert.deepEqual(changes['public/albums/current'], publicAlbum(published));
  assert.equal(changes['private/albums/other-published/featured'], false);
  assert.equal(changes['public/albums/other-published/featured'], false);
  assert.equal(changes['private/albums/other-draft/featured'], false);
  assert.equal(changes['public/albums/other-draft/featured'], undefined);
});
