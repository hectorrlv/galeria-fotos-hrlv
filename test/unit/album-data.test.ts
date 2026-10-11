import assert from 'node:assert/strict';
import test from 'node:test';
import {
  albumValues,
  emptyDraftDeletion,
} from '../../src/firebase/album-data.js';
import { createDraftAlbum, orderedPhotos } from '../../src/models/gallery.js';

test('restores empty collections and nullable fields omitted from saved drafts', () => {
  const stored: Record<string, unknown> = { ...createDraftAlbum(123) };
  delete stored.photos;
  delete stored.photoOrder;
  delete stored.coverPhotoId;
  delete stored.publishedAt;

  const [album] = albumValues({ album: stored });
  assert.ok(album);
  assert.deepEqual(album.photos, {});
  assert.deepEqual(album.photoOrder, []);
  assert.equal(album.coverPhotoId, null);
  assert.equal(album.publishedAt, null);
  assert.deepEqual(orderedPhotos(album), []);
  assert.deepEqual(albumValues(null), []);
});

test('normalizes null collections and preserves Firebase photo order and sorting', () => {
  const older = {
    ...createDraftAlbum(100),
    photos: null,
    photoOrder: null,
  };
  const newer = {
    ...createDraftAlbum(200),
    photoOrder: { 2: 'second', 0: 'first' },
  };
  const [first, second] = albumValues({ older, newer });
  assert.ok(first);
  assert.ok(second);
  assert.equal(first.id, newer.id);
  assert.deepEqual(first.photoOrder, ['first', 'second']);
  assert.deepEqual(second.photos, {});
  assert.deepEqual(second.photoOrder, []);
});

test('deletes only a currently empty draft, including missing collections', () => {
  assert.equal(emptyDraftDeletion({ status: 'draft' }), null);
  assert.equal(emptyDraftDeletion({ status: 'draft', photos: null }), null);
  assert.equal(emptyDraftDeletion(createDraftAlbum()), null);
  assert.equal(emptyDraftDeletion(null), null);
  assert.equal(emptyDraftDeletion({ status: 'published' }), undefined);
  assert.equal(emptyDraftDeletion({ status: 'archived' }), undefined);
  assert.equal(
    emptyDraftDeletion({
      status: 'draft',
      photoOrder: [],
      photos: { hidden: { visible: false } },
    }),
    undefined,
  );
  assert.equal(emptyDraftDeletion({}), undefined);
});
