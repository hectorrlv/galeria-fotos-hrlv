import assert from 'node:assert/strict';
import test from 'node:test';
import { sortAlbums } from '../../src/models/album-order.js';
import { createDraftAlbum, type Album } from '../../src/models/gallery.js';

const album = (id: string, startDate: string, updatedAt = 1): Album => ({
  ...createDraftAlbum(1),
  id,
  title: id,
  startDate,
  updatedAt,
});

test('orders by the trip date in both directions without changing the input', () => {
  const input = [
    album('old-uploaded-today', '2000-06-01', 999),
    album('recent', '2026-10-11', 1),
    album('middle', '2020-01-01', 100),
  ];
  assert.deepEqual(
    sortAlbums(input).map(item => item.id),
    ['recent', 'middle', 'old-uploaded-today'],
  );
  assert.deepEqual(
    sortAlbums(input, 'date-asc').map(item => item.id),
    ['old-uploaded-today', 'middle', 'recent'],
  );
  assert.equal(input[0]?.id, 'old-uploaded-today');
});

test('keeps missing and invalid dates last in both directions and breaks ties deterministically', () => {
  const input = [
    album('invalid', '2026-02-30'),
    album('missing', ''),
    { ...album('b', '2024-02-29'), title: 'Álbum' },
    { ...album('a', '2024-02-29'), title: 'Álbum' },
    { ...album('c', '2024-02-29'), title: 'Zoológico' },
    album('malformed', '2026-1-1'),
  ];
  for (const order of ['date-desc', 'date-asc'] as const) {
    assert.deepEqual(
      sortAlbums(input, order).map(item => item.id),
      ['a', 'b', 'c', 'invalid', 'malformed', 'missing'],
    );
  }
});
