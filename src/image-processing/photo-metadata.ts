import exifr from 'exifr';

export interface PhotoMetadata {
  takenAt?: string;
  location?: string;
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
  new Promise(resolve => window.setTimeout(resolve, milliseconds));

const parseExif: ExifParser = file =>
  exifr.parse(file, {
    pick: [
      'DateTimeOriginal',
      'CreateDate',
      'ModifyDate',
      'latitude',
      'longitude',
    ],
    gps: true,
  }) as Promise<ExifTags | undefined>;

export const normalizeExifDate = (value: unknown): string | undefined => {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) {
    return value.toISOString().slice(0, 10);
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
  private lastGeocodeAt = 0;

  constructor(
    private readonly readExif: ExifParser = parseExif,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly now: () => number = Date.now,
    private readonly delay: Sleep = sleep,
  ) {}

  async read(file: File): Promise<PhotoMetadata> {
    try {
      const tags = await this.readExif(file);
      if (!tags) return {};
      const metadata: PhotoMetadata = {
        takenAt: normalizeExifDate(
          tags.DateTimeOriginal ?? tags.CreateDate ?? tags.ModifyDate,
        ),
      };
      const latitude = Number(tags.latitude);
      const longitude = Number(tags.longitude);
      if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
        metadata.location = await this.resolveLocation(latitude, longitude);
      }
      return metadata;
    } catch {
      return {};
    }
  }

  private async resolveLocation(
    latitude: number,
    longitude: number,
  ): Promise<string | undefined> {
    const key = `${latitude.toFixed(5)},${longitude.toFixed(5)}`;
    let result = this.locationCache.get(key);
    if (!result) {
      result = this.reverseGeocode(latitude, longitude);
      this.locationCache.set(key, result);
    }
    return result;
  }

  private async reverseGeocode(
    latitude: number,
    longitude: number,
  ): Promise<string | undefined> {
    const remaining = NOMINATIM_INTERVAL_MS - (this.now() - this.lastGeocodeAt);
    if (remaining > 0) await this.delay(remaining);
    this.lastGeocodeAt = this.now();
    try {
      const params = new URLSearchParams({
        format: 'jsonv2',
        lat: String(latitude),
        lon: String(longitude),
        zoom: '10',
        addressdetails: '1',
      });
      const response = await this.fetchImpl(`${NOMINATIM_URL}?${params}`);
      if (!response.ok) return undefined;
      return formatNominatimLocation(
        (await response.json()) as NominatimResponse,
      );
    } catch {
      return undefined;
    }
  }
}
