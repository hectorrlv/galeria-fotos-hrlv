import exifr from 'exifr';

export interface PhotoMetadata {
  takenAt?: string;
  location?: string;
  locationStatus: 'resolved' | 'no-gps' | 'read-error' | 'service-error';
}

interface ExifTags {
  DateTimeOriginal?: unknown;
  CreateDate?: unknown;
  ModifyDate?: unknown;
  latitude?: unknown;
  longitude?: unknown;
}

type ExifParser = (file: File) => Promise<ExifTags | undefined>;
type Sleep = (milliseconds: number) => Promise<void>;

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/reverse';
const NOMINATIM_INTERVAL_MS = 1_000;

const sleep: Sleep = milliseconds =>
  new Promise(resolve => globalThis.setTimeout(resolve, milliseconds));

const parseExif: ExifParser = file =>
  exifr.parse(file, {
    pick: [
      'DateTimeOriginal',
      'CreateDate',
      'ModifyDate',
      'GPSLatitude',
      'GPSLatitudeRef',
      'GPSLongitude',
      'GPSLongitudeRef',
    ],
    gps: true,
  }) as Promise<ExifTags | undefined>;

export const normalizeExifDate = (value: unknown): string | undefined => {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  if (typeof value !== 'string') return undefined;
  const match = /^(\d{4})[:-](\d{2})[:-](\d{2})/.exec(value.trim());
  if (!match) return undefined;
  const [, year, month, day] = match;
  const normalized = `${year}-${month}-${day}`;
  const date = new Date(`${normalized}T00:00:00Z`);
  if (
    Number.isNaN(date.valueOf()) ||
    date.toISOString().slice(0, 10) !== normalized
  )
    return undefined;
  return normalized;
};

interface NominatimAddress {
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  county?: string;
  state_district?: string;
  country?: string;
}

interface NominatimResponse {
  address?: NominatimAddress;
  display_name?: string;
}

export const formatNominatimLocation = (
  result: NominatimResponse,
): string | undefined => {
  const address = result.address;
  if (!address) return result.display_name?.trim() || undefined;
  const place =
    address.city ??
    address.town ??
    address.village ??
    address.municipality ??
    address.county ??
    address.state_district;
  const values = [place, address.country]
    .map(value => value?.trim())
    .filter((value): value is string => Boolean(value));
  return (
    [...new Set(values)].join(', ') || result.display_name?.trim() || undefined
  );
};

export class PhotoMetadataReader {
  private readonly locationCache = new Map<
    string,
    Promise<string | undefined>
  >();
  private lastGeocodeAt?: number;
  private geocodeQueue: Promise<void> = Promise.resolve();

  constructor(
    private readonly readExif: ExifParser = parseExif,
    private readonly fetchImpl: typeof fetch = globalThis.fetch.bind(
      globalThis,
    ),
    private readonly now: () => number = Date.now,
    private readonly delay: Sleep = sleep,
    private readonly requestTimeoutMs = 10_000,
  ) {}

  async read(file: File): Promise<PhotoMetadata> {
    let tags: ExifTags | undefined;
    try {
      tags = await this.readExif(file);
    } catch {
      return { locationStatus: 'read-error' };
    }
    const metadata: PhotoMetadata = { locationStatus: 'no-gps' };
    if (!tags) return metadata;
    const takenAt = normalizeExifDate(
      tags.DateTimeOriginal ?? tags.CreateDate ?? tags.ModifyDate,
    );
    if (takenAt) metadata.takenAt = takenAt;
    const { latitude, longitude } = tags;
    if (
      typeof latitude !== 'number' ||
      typeof longitude !== 'number' ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      Math.abs(latitude) > 90 ||
      Math.abs(longitude) > 180
    )
      return metadata;
    const location = await this.resolveLocation(latitude, longitude);
    metadata.locationStatus = location ? 'resolved' : 'service-error';
    if (location) metadata.location = location;
    return metadata;
  }

  private async resolveLocation(
    latitude: number,
    longitude: number,
  ): Promise<string | undefined> {
    const key = `${latitude.toFixed(5)},${longitude.toFixed(5)}`;
    let result = this.locationCache.get(key);
    if (!result) {
      result = this.geocodeQueue.then(() =>
        this.reverseGeocode(latitude, longitude),
      );
      this.geocodeQueue = result.then(() => undefined);
      this.locationCache.set(key, result);
    }
    const location = await result;
    if (!location && this.locationCache.get(key) === result) {
      this.locationCache.delete(key);
    }
    return location;
  }

  private async reverseGeocode(
    latitude: number,
    longitude: number,
  ): Promise<string | undefined> {
    const remaining =
      this.lastGeocodeAt === undefined
        ? 0
        : NOMINATIM_INTERVAL_MS - (this.now() - this.lastGeocodeAt);
    if (remaining > 0) await this.delay(remaining);
    this.lastGeocodeAt = this.now();
    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const params = new URLSearchParams({
        format: 'jsonv2',
        lat: String(latitude),
        lon: String(longitude),
        zoom: '10',
        addressdetails: '1',
        'accept-language': 'es',
      });
      return await Promise.race([
        (async () => {
          const response = await this.fetchImpl(`${NOMINATIM_URL}?${params}`, {
            signal: controller.signal,
          });
          if (!response.ok) return undefined;
          return formatNominatimLocation(
            (await response.json()) as NominatimResponse,
          );
        })(),
        new Promise<undefined>(resolve => {
          timeout = globalThis.setTimeout(() => {
            controller.abort();
            resolve(undefined);
          }, this.requestTimeoutMs);
        }),
      ]);
    } catch {
      return undefined;
    } finally {
      globalThis.clearTimeout(timeout);
    }
  }
}
