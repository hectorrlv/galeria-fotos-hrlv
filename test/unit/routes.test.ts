import assert from 'node:assert/strict';
import test from 'node:test';
import {
  albumPath,
  publicNavigation,
  routePaths,
} from '../../src/navigation/routes.js';

test('public navigation exposes the approved routes in order', () => {
  assert.deepEqual(
    publicNavigation.map(item => item.path),
    [routePaths.home, routePaths.albums, routePaths.about],
  );
});

test('albumPath safely encodes a slug', () => {
  assert.equal(albumPath('méxico 2026'), '/album/m%C3%A9xico%202026');
});
