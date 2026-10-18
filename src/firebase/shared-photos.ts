import {
  albumCover,
  type Album,
  type GalleryPhoto,
  type PhotoEdit,
  type SharedPhoto,
  type StoredAlbum,
} from '../models/gallery.js';
import { albumValues } from './album-data.js';
import { publicAlbum } from './publication.js';

export interface GalleryDatabase {
  private?: {
    schemaVersion?: number;
    albums?: Record<string, StoredAlbum | Album>;
    photos?: Record<string, SharedPhoto>;
    photoDeletions?: Record<string, SharedPhoto>;
    [key: string]: unknown;
  };
  public?: {
    albums?: Record<string, Album>;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export const sharedPhoto = (photo: SharedPhoto): SharedPhoto => {
  // Explicit allowlist: album membership and private bookkeeping cannot leak.
  const result: SharedPhoto = {
    id: photo.id,
    fileName: photo.fileName,
    width: photo.width,
    height: photo.height,
    caption: photo.caption,
    location: photo.location,
    takenAt: photo.takenAt,
    altText: photo.altText,
    publicPaths: [...(photo.publicPaths ?? [])],
    urls: { ...photo.urls },
    credit: { ...photo.credit },
  };
  if (photo.originalPath) result.originalPath = photo.originalPath;
  return result;
};

const stableValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, stableValue(item)]),
    );
  return value;
};

export const samePhoto = (a: SharedPhoto, b: SharedPhoto): boolean =>
  JSON.stringify(stableValue(sharedPhoto(a))) ===
  JSON.stringify(stableValue(sharedPhoto(b)));

export const storedAlbum = (album: Album): StoredAlbum => {
  const { photos, ...fields } = album;
  return {
    ...fields,
    photoRefs: Object.fromEntries(
      Object.values(photos).map(photo => [
        photo.id,
        { visible: photo.visible },
      ]),
    ),
  };
};

export const privateAlbums = (data: GalleryDatabase['private']): Album[] =>
  albumValues(data?.albums, data?.photos);

export const photoAlbums = (
  photoId: string,
  albums: readonly Album[],
): Album[] => albums.filter(album => Boolean(album.photos[photoId]));

const writablePrivate = (data: GalleryDatabase) => {
  const state = (data.private ??= {});
  if (
    (state.schemaVersion !== 2 && Object.keys(state.albums ?? {}).length > 0) ||
    (state.schemaVersion !== undefined && state.schemaVersion > 2)
  ) {
    throw new Error(
      'La biblioteca necesita la migración de fotografías antes de guardar. Puedes consultar los álbumes actuales.',
    );
  }
  state.schemaVersion = 2;
  return Object.assign(state, {
    albums: state.albums ?? {},
    photos: state.photos ?? {},
  });
};

const applyPhotoEdits = (
  data: GalleryDatabase,
  edits: readonly PhotoEdit[],
  now: number,
) => {
  const state = writablePrivate(data);
  for (const { photo, previous } of edits) {
    if (state.photoDeletions?.[photo.id])
      throw new Error('La fotografía está pendiente de eliminación.');
    const current = state.photos[photo.id];
    if (
      (previous && (!current || !samePhoto(current, previous))) ||
      (!previous && current)
    ) {
      throw new Error(
        'La fotografía cambió en otra sesión. Vuelve a seleccionar el álbum antes de editarla.',
      );
    }
    state.photos[photo.id] = sharedPhoto(photo);
    // Patch only appearances already public, using their saved local visibility.
    // Never build other public albums from their private drafts.
    for (const album of Object.values(data.public?.albums ?? {})) {
      const appearance = album.photos?.[photo.id];
      if (!appearance) continue;
      const safe = { ...sharedPhoto(photo), albumId: album.id, visible: true };
      delete safe.originalPath;
      album.photos[photo.id] = safe;
      album.updatedAt = now;
    }
  }
};

/** Pure transaction reducer. Firebase retries it against the current server data. */
export const saveSharedAlbum = (
  source: GalleryDatabase,
  album: Album,
  edits: readonly PhotoEdit[],
  publish: boolean,
  now = Date.now(),
): GalleryDatabase => {
  const data = structuredClone(source);
  const state = writablePrivate(data);
  applyPhotoEdits(data, edits, now);
  for (const id of Object.keys(album.photos)) {
    if (!state.photos[id])
      throw new Error(
        'Una fotografía ya no está disponible. Vuelve a elegirla.',
      );
  }
  const resolved: Album = {
    ...album,
    photos: Object.fromEntries(
      Object.values(album.photos).map(photo => [
        photo.id,
        {
          ...state.photos[photo.id]!,
          albumId: album.id,
          visible: photo.visible,
        },
      ]),
    ),
    photoOrder: [...new Set(album.photoOrder)].filter(id => album.photos[id]),
    updatedAt: now,
    status: publish ? 'published' : album.status,
    publishedAt: publish ? (album.publishedAt ?? now) : album.publishedAt,
  };
  if (resolved.status === 'published' && !albumCover(resolved))
    throw new Error(
      'Retira el álbum de publicación antes de quitar u ocultar su última fotografía visible.',
    );
  if (!resolved.coverPhotoId || !resolved.photos[resolved.coverPhotoId])
    resolved.coverPhotoId = albumCover(resolved)?.id ?? null;
  state.albums[album.id] = storedAlbum(resolved);
  if (publish) {
    data.public ??= {};
    data.public.albums ??= {};
    data.public.albums[album.id] = publicAlbum(resolved);
  }
  if (publish && resolved.featured) {
    for (const other of Object.values(state.albums)) {
      if (other.id === album.id || !other.featured) continue;
      other.featured = false;
      const published = data.public?.albums?.[other.id];
      if (published) published.featured = false;
    }
  }
  return data;
};

export const saveSharedPhoto = (
  source: GalleryDatabase,
  edit: PhotoEdit,
  now = Date.now(),
): GalleryDatabase => {
  const data = structuredClone(source);
  applyPhotoEdits(data, [edit], now);
  return data;
};

export const markPhotoForDeletion = (
  source: GalleryDatabase,
  photoId: string,
): GalleryDatabase => {
  const data = structuredClone(source);
  const state = writablePrivate(data);
  if (
    photoAlbums(photoId, privateAlbums(state)).length ||
    Object.values(data.public?.albums ?? {}).some(
      album => album.photos?.[photoId],
    )
  )
    throw new Error(
      'Quita la fotografía de todos sus álbumes antes de eliminarla.',
    );
  const photo = state.photos[photoId];
  if (photo) {
    state.photoDeletions ??= {};
    state.photoDeletions[photoId] = photo;
    delete state.photos[photoId];
  }
  return data;
};

export const unreferencedPaths = (
  data: GalleryDatabase,
  paths: readonly string[],
): string[] => {
  const referenced = new Set<string>();
  const photos = [
    ...Object.values(data.private?.photos ?? {}),
    ...Object.values(data.public?.albums ?? {}).flatMap(album =>
      Object.values(album.photos ?? {}),
    ),
  ];
  for (const photo of photos) {
    if (photo.originalPath) referenced.add(photo.originalPath);
    for (const path of photo.publicPaths ?? []) referenced.add(path);
  }
  return [...new Set(paths)].filter(path => !referenced.has(path));
};

/** Offline migration: no files are moved and unrelated database data is retained. */
export const migrateSharedPhotos = (
  source: GalleryDatabase,
): GalleryDatabase => {
  const data = structuredClone(source);
  data.private ??= {};
  if (data.private.schemaVersion === 2) return data;
  if (data.private.schemaVersion && data.private.schemaVersion > 2)
    throw new Error('Versión de datos desconocida.');
  if (Object.keys(data.private.photos ?? {}).length)
    throw new Error(
      'La exportación contiene una conversión incompleta. Revisa el respaldo antes de migrar.',
    );
  for (const [albumId, raw] of Object.entries(data.private.albums ?? {})) {
    if (!raw || raw.id !== albumId || 'photoRefs' in raw)
      throw new Error(
        `El álbum ${albumId} tiene un formato incompatible con la migración.`,
      );
    for (const [photoId, photo] of Object.entries(
      (raw as Album).photos ?? {},
    )) {
      if (!photo || photo.id !== photoId)
        throw new Error(
          `La fotografía ${photoId} del álbum ${albumId} tiene un identificador incompatible.`,
        );
    }
  }
  const photos = (data.private.photos ??= {});
  for (const album of albumValues(data.private.albums)) {
    const remapped: Record<string, GalleryPhoto> = {};
    const ids = new Map<string, string>();
    for (const photo of Object.values(album.photos)) {
      let id = photo.id;
      // Legacy IDs identify records only within an album. Conflicts stay distinct.
      if (photos[id]) {
        let suffix = 0;
        do {
          id = `${album.id}__${photo.id}${suffix ? `__${suffix}` : ''}`;
          suffix += 1;
        } while (photos[id]);
      }
      ids.set(photo.id, id);
      photos[id] = sharedPhoto({ ...photo, id });
      remapped[id] = { ...photo, id, albumId: album.id };
    }
    const converted: Album = {
      ...album,
      photos: remapped,
      photoOrder: album.photoOrder.map(id => ids.get(id) ?? id),
      coverPhotoId: album.coverPhotoId
        ? (ids.get(album.coverPhotoId) ?? null)
        : null,
    };
    data.private.albums![album.id] = storedAlbum(converted);
    const published = data.public?.albums?.[album.id];
    if (published) {
      // Preserve the public snapshot, including unpublished differences.
      published.photos = Object.fromEntries(
        Object.entries(published.photos ?? {}).map(([id, photo]) => {
          const mapped = ids.get(id) ?? id;
          const safe = { ...photo, id: mapped };
          delete safe.originalPath;
          return [mapped, safe];
        }),
      );
      published.photoOrder = Object.values(published.photoOrder ?? {}).map(
        id => ids.get(id) ?? id,
      );
      published.coverPhotoId = published.coverPhotoId
        ? (ids.get(published.coverPhotoId) ?? published.coverPhotoId)
        : null;
    }
  }
  data.private.schemaVersion = 2;
  return data;
};
