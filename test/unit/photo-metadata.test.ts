import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatNominatimLocation,
  normalizeExifDate,
  PhotoMetadataReader,
} from '../../src/image-processing/photo-metadata.js';

test('normalizes EXIF dates without carrying a time zone into the saved date', () => {
  assert.equal(normalizeExifDate('2026:08:09 14:32:01'), '2026-08-09');
  assert.equal(normalizeExifDate('invalid'), undefined);
  assert.equal(normalizeExifDate('2026:02:31 14:32:01'), undefined);
});

test('prefers a concise locality and country from Nominatim', () => {
  assert.equal(
    formatNominatimLocation({
      address: { municipality: 'Valle de Bravo', country: 'México' },
      display_name: 'Valle de Bravo, Estado de México, México',
    }),
    'Valle de Bravo, México',
  );
});

test('reads date and location and caches equal coordinate lookups', async () => {
  let fetches = 0;
  const reader = new PhotoMetadataReader(
    async () => ({
      DateTimeOriginal: '2026:08:09 14:32:01',
      latitude: 19.4326,
      longitude: -99.1332,
    }),
    async () => {
      fetches += 1;
      return new Response(
        JSON.stringify({
          address: { city: 'Ciudad de México', country: 'México' },
        }),
        { status: 200 },
      );
    },
  );

  const first = await reader.read({} as File);
  const second = await reader.read({} as File);

  assert.deepEqual(first, {
    takenAt: '2026-08-09',
    location: 'Ciudad de México, México',
  });
  assert.deepEqual(second, first);
  assert.equal(fetches, 1);
});

test('keeps metadata empty when EXIF or reverse geocoding is unavailable', async () => {
  const reader = new PhotoMetadataReader(async () => {
    throw new Error('No EXIF');
  });
  assert.deepEqual(await reader.read({} as File), {});
});
