import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import {
  formatNominatimLocation,
  normalizeExifDate,
  PhotoMetadataReader,
} from '../../src/image-processing/photo-metadata.js';

test('normalizes EXIF dates without carrying a time zone into the saved date', () => {
  assert.equal(normalizeExifDate('2026:08:09 14:32:01'), '2026-08-09');
  assert.equal(normalizeExifDate(new Date(2026, 7, 9, 23, 30)), '2026-08-09');
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
    locationStatus: 'resolved',
    takenAt: '2026-08-09',
    location: 'Ciudad de México, México',
  });
  assert.deepEqual(second, first);
  assert.equal(fetches, 1);
});

test('reports an EXIF read error', async () => {
  const reader = new PhotoMetadataReader(async () => {
    throw new Error('No EXIF');
  });
  assert.deepEqual(await reader.read({} as File), {
    locationStatus: 'read-error',
  });
});

test('retries a location after a failed reverse-geocoding request', async () => {
  let attempts = 0;
  const reader = new PhotoMetadataReader(
    async () => ({ latitude: 19.4326, longitude: -99.1332 }),
    async () => {
      attempts += 1;
      return attempts === 1
        ? new Response('', { status: 503 })
        : new Response(
            JSON.stringify({
              address: { city: 'Ciudad de México', country: 'México' },
            }),
            { status: 200 },
          );
    },
    () => 1_000,
    async () => undefined,
  );

  assert.deepEqual(await reader.read({} as File), {
    locationStatus: 'service-error',
  });
  assert.deepEqual(await reader.read({} as File), {
    locationStatus: 'resolved',
    location: 'Ciudad de México, México',
  });
  assert.equal(attempts, 2);
});

const madrid = () =>
  new Response(
    JSON.stringify({ address: { city: 'Madrid', country: 'España' } }),
  );
const fixture = (name: string) =>
  readFileSync(
    new URL(`../fixtures/${name}`, import.meta.url),
  ) as unknown as File;

test('reads western GPS and date with the real parser, not mocked coordinates', async () => {
  let requested: URL | undefined;
  const reader = new PhotoMetadataReader(undefined, async url => {
    requested = new URL(String(url));
    return madrid();
  });
  assert.deepEqual(await reader.read(fixture('gps-madrid.jpg')), {
    locationStatus: 'resolved',
    takenAt: '2025-10-09',
    location: 'Madrid, España',
  });
  assert.ok(
    Math.abs(Number(requested!.searchParams.get('lat')) - 40.4190194444444) <
      1e-10,
  );
  assert.ok(
    Math.abs(Number(requested!.searchParams.get('lon')) + 3.69385555555556) <
      1e-10,
  );
  assert.equal(requested!.searchParams.get('accept-language'), 'es');
});

test('does not geocode a real JPEG without GPS or absent EXIF output', async () => {
  const unexpectedFetch = async () => {
    assert.fail('No GPS must not call the service');
  };
  assert.deepEqual(
    await new PhotoMetadataReader(undefined, unexpectedFetch).read(
      fixture('no-gps.jpg'),
    ),
    { locationStatus: 'no-gps' },
  );
  assert.deepEqual(
    await new PhotoMetadataReader(async () => undefined, unexpectedFetch).read(
      {} as File,
    ),
    { locationStatus: 'no-gps' },
  );
});

test('rejects missing, coerced, nonfinite and out-of-range coordinates', async () => {
  for (const [latitude, longitude] of [
    [undefined, undefined],
    [null, null],
    ['', ''],
    ['40.4', '-3.6'],
    [false, true],
    [NaN, 0],
    [0, Infinity],
    [90.01, 0],
    [0, -180.01],
    [0, undefined],
    [undefined, 0],
  ]) {
    const reader = new PhotoMetadataReader(
      async () => ({
        DateTimeOriginal: '2025:10:09 13:30:54',
        latitude,
        longitude,
      }),
      async () => {
        assert.fail('Invalid GPS must not call the service');
      },
    );
    assert.deepEqual(await reader.read({} as File), {
      locationStatus: 'no-gps',
      takenAt: '2025-10-09',
    });
  }
});

test('accepts zero coordinates and range boundaries', async () => {
  for (const [latitude, longitude] of [
    [0, 0],
    [90, 180],
    [-90, -180],
  ]) {
    const reader = new PhotoMetadataReader(
      async () => ({ latitude, longitude }),
      async url => {
        const params = new URL(String(url)).searchParams;
        assert.equal(Number(params.get('lat')), latitude);
        assert.equal(Number(params.get('lon')), longitude);
        return madrid();
      },
    );
    assert.equal((await reader.read({} as File)).locationStatus, 'resolved');
  }
});

test('preserves the date through HTTP, network, JSON and empty-result failures', async () => {
  for (const fetchImpl of [
    async () => new Response('', { status: 429 }),
    async () => new Response('', { status: 503 }),
    async () => {
      throw new TypeError('offline');
    },
    async () => new Response('not json'),
    async () => new Response('{}'),
  ]) {
    const reader = new PhotoMetadataReader(undefined, fetchImpl);
    assert.deepEqual(await reader.read(fixture('gps-madrid.jpg')), {
      locationStatus: 'service-error',
      takenAt: '2025-10-09',
    });
  }
});

test('times out fetch or a stalled response body, aborts, and allows a retry', async () => {
  for (const stalledBody of [false, true]) {
    let signal: AbortSignal | null | undefined;
    let attempts = 0;
    const reader = new PhotoMetadataReader(
      undefined,
      async (_url, init) => {
        attempts += 1;
        signal = init?.signal;
        if (attempts > 1) return madrid();
        if (stalledBody) return new Response(new ReadableStream());
        return await new Promise<Response>(() => undefined);
      },
      () => 1_000,
      async () => undefined,
      10,
    );
    assert.deepEqual(await reader.read(fixture('gps-madrid.jpg')), {
      locationStatus: 'service-error',
      takenAt: '2025-10-09',
    });
    assert.equal(signal?.aborted, true);
    assert.equal(
      (await reader.read(fixture('gps-madrid.jpg'))).locationStatus,
      'resolved',
    );
    assert.equal(attempts, 2);
  }
});

test('serializes concurrent distinct coordinates and deduplicates in-flight lookups', async () => {
  let clock = 0;
  let active = 0;
  let maxActive = 0;
  const starts: number[] = [];
  const reader = new PhotoMetadataReader(
    async file => ({ latitude: file.name === 'same' ? 1 : 2, longitude: 0 }),
    async () => {
      starts.push(clock);
      active += 1;
      maxActive = Math.max(active, maxActive);
      await new Promise(resolve => setTimeout(resolve, 5));
      active -= 1;
      return madrid();
    },
    () => clock,
    async milliseconds => {
      clock += milliseconds;
    },
  );
  const results = await Promise.all(
    ['same', 'different', 'same'].map(name => reader.read({ name } as File)),
  );
  assert.deepEqual(starts, [0, 1_000]);
  assert.equal(maxActive, 1);
  assert.equal(
    results.every(result => result.locationStatus === 'resolved'),
    true,
  );
  await reader.read({ name: 'same' } as File);
  assert.equal(starts.length, 2);
});
