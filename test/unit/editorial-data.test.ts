import assert from 'node:assert/strict';
import test from 'node:test';
import { isolateEditorialData } from '../../src/firebase/editorial-data.js';
import { likesSeed } from '../fixtures/photo-likes.js';

test('isolates editorial state without changing likes, snapshots, identifiers or unrelated root data', () => {
  const legacy = {
    ...likesSeed(),
    photoLikes: { p: { count: 1, voters: { visitor: { albumId: 'viaje' } } } },
    other: { keep: true },
  };
  const before = structuredClone(legacy);
  const migrated = isolateEditorialData(legacy);
  assert.equal(migrated.private, undefined);
  assert.equal(migrated.public, undefined);
  assert.deepEqual(migrated.editorial, {
    layoutVersion: 1,
    private: legacy.private,
    public: legacy.public,
  });
  assert.deepEqual(migrated.photoLikes, legacy.photoLikes);
  assert.deepEqual(migrated.other, legacy.other);
  assert.deepEqual(isolateEditorialData(migrated), migrated);
  assert.deepEqual(legacy, before);
});

test('rejects ambiguous or incompatible exports instead of choosing a source', () => {
  const migrated = isolateEditorialData(likesSeed());
  assert.throws(
    () => isolateEditorialData({ ...migrated, private: {} }),
    /mezcla/,
  );
  assert.throws(
    () => isolateEditorialData({ editorial: { layoutVersion: 9 } }),
    /desconocida/,
  );
  assert.throws(() => isolateEditorialData({}), /exportación/);
  assert.throws(
    () =>
      isolateEditorialData({
        private: { albums: { a: likesSeed().public!.albums!.viaje! } },
      }),
    /primero/,
  );
});
