import assert from 'node:assert/strict';
import test from 'node:test';
import { versionedOriginalPath } from '../../src/firebase/storage-paths.js';

test('stores each uploaded original at a distinct versioned path', async () => {
  const first = versionedOriginalPath(
    'album',
    'photo',
    'atardecer.jpg',
    100,
    'a',
  );
  const second = versionedOriginalPath(
    'album',
    'photo',
    'atardecer.jpg',
    100,
    'b',
  );

  assert.notEqual(first, second);
  assert.match(first, /^originals\/album\/photo\/original-100-a\.jpg$/);
  assert.match(second, /^originals\/album\/photo\/original-100-b\.jpg$/);
});
