import {
  get,
  onValue,
  ref as databaseRef,
  runTransaction,
  update,
  type Unsubscribe,
} from 'firebase/database';
import {
  deleteObject,
  getBlob,
  getDownloadURL,
  ref as storageRef,
  uploadBytesResumable,
} from 'firebase/storage';
import type { ProcessedImage } from '../image-processing/contracts.js';
import {
  DEFAULT_SITE_CONFIG,
  type Album,
  type GalleryPhoto,
  type PhotoEdit,
  type SharedPhoto,
  type PhotoVariantUrls,
  type SiteConfig,
} from '../models/gallery.js';
import { getFirebaseServices, type FirebaseServices } from './client.js';
import { albumValues, emptyDraftDeletion } from './album-data.js';
import {
  markPhotoForDeletion,
  privateAlbums,
  saveSharedAlbum,
  saveSharedPhoto,
  unreferencedPaths,
  type GalleryDatabase,
} from './shared-photos.js';
import { versionedOriginalPath } from './storage-paths.js';

type ErrorCallback = (error: Error) => void;

export class GalleryRepository {
  constructor(
    private readonly services: FirebaseServices | null = getFirebaseServices(),
  ) {}

  subscribePublicAlbums(
    callback: (albums: Album[]) => void,
    onError?: ErrorCallback,
  ): Unsubscribe {
    if (!this.services) {
      queueMicrotask(() => callback([]));
      return () => undefined;
    }
    return onValue(
      databaseRef(this.services.database, 'public/albums'),
      snapshot => callback(albumValues(snapshot.val())),
      error => onError?.(error),
    );
  }

  subscribePrivateAlbums(
    callback: (albums: Album[]) => void,
    onError?: ErrorCallback,
  ): Unsubscribe {
    if (!this.services) {
      queueMicrotask(() => callback([]));
      return () => undefined;
    }
    return onValue(
      databaseRef(this.services.database, 'private'),
      snapshot => callback(privateAlbums(snapshot.val())),
      error => onError?.(error),
    );
  }

  subscribeSiteConfig(
    isPrivate: boolean,
    callback: (config: SiteConfig) => void,
    onError?: ErrorCallback,
  ): Unsubscribe {
    if (!this.services) {
      queueMicrotask(() => callback({ ...DEFAULT_SITE_CONFIG }));
      return () => undefined;
    }
    return onValue(
      databaseRef(
        this.services.database,
        `${isPrivate ? 'private' : 'public'}/site`,
      ),
      snapshot =>
        callback({
          ...DEFAULT_SITE_CONFIG,
          ...(snapshot.val() as Partial<SiteConfig> | null),
        }),
      error => onError?.(error),
    );
  }

  subscribePrivatePhotos(
    callback: (
      photos: SharedPhoto[],
      deleting: string[],
      writable: boolean,
    ) => void,
    onError?: ErrorCallback,
  ): Unsubscribe {
    if (!this.services) {
      queueMicrotask(() => callback([], [], true));
      return () => undefined;
    }
    return onValue(
      databaseRef(this.services.database, 'private'),
      snapshot => {
        const data = snapshot.val() as GalleryDatabase['private'];
        callback(
          [
            ...Object.values(data?.photos ?? {}),
            ...Object.values(data?.photoDeletions ?? {}),
          ],
          Object.keys(data?.photoDeletions ?? {}),
          data?.schemaVersion === 2 ||
            Object.keys(data?.albums ?? {}).length === 0,
        );
      },
      error => onError?.(error),
    );
  }

  private async transact(
    reducer: (data: GalleryDatabase) => GalleryDatabase,
  ): Promise<GalleryDatabase> {
    if (!this.services) throw new Error('Firebase no está configurado.');
    const root = databaseRef(this.services.database);
    // Keep a complete listener alive while transacting. A one-shot get alone can
    // be evicted before runTransaction and make its first callback see null.
    let unsubscribe: Unsubscribe = () => undefined;
    try {
      await new Promise<void>((resolve, reject) => {
        unsubscribe = onValue(root, () => resolve(), reject);
      });
      const result = await runTransaction(root, value => reducer(value ?? {}), {
        applyLocally: false,
      });
      if (!result.committed)
        throw new Error('No fue posible guardar los cambios.');
      return result.snapshot.val() as GalleryDatabase;
    } finally {
      unsubscribe();
    }
  }

  async saveAlbum(
    album: Album,
    edits: readonly PhotoEdit[] = [],
  ): Promise<Album> {
    const saved = await this.transact(data =>
      saveSharedAlbum(data, album, edits, false),
    );
    return privateAlbums(saved.private).find(item => item.id === album.id)!;
  }

  async publishAlbum(
    album: Album,
    _albums: readonly Album[],
    edits: readonly PhotoEdit[] = [],
  ): Promise<Album> {
    const saved = await this.transact(data =>
      saveSharedAlbum(data, album, edits, true),
    );
    return privateAlbums(saved.private).find(item => item.id === album.id)!;
  }

  async savePhoto(photo: SharedPhoto, previous: SharedPhoto): Promise<void> {
    await this.transact(data => saveSharedPhoto(data, { photo, previous }));
  }

  async associatePhotos(
    album: Album,
    ids: readonly string[],
    edits: readonly PhotoEdit[] = [],
  ): Promise<Album> {
    const saved = await this.transact(data => {
      const next = structuredClone(album);
      for (const id of ids) {
        const photo = data.private?.photos?.[id];
        if (!photo)
          throw new Error(
            'Una fotografía ya no está disponible. Vuelve a elegirla.',
          );
        if (next.photos[id]) continue;
        next.photos[id] = { ...photo, albumId: album.id, visible: true };
        next.photoOrder.push(id);
        next.coverPhotoId ??= id;
      }
      return saveSharedAlbum(data, next, edits, next.status === 'published');
    });
    return privateAlbums(saved.private).find(item => item.id === album.id)!;
  }

  async removeAlbumPhotos(
    album: Album,
    ids: readonly string[],
    edits: readonly PhotoEdit[] = [],
  ): Promise<Album> {
    const next = structuredClone(album);
    for (const id of ids) delete next.photos[id];
    next.photoOrder = next.photoOrder.filter(id => !ids.includes(id));
    return this.transact(data =>
      saveSharedAlbum(
        data,
        next,
        edits.filter(edit => !ids.includes(edit.photo.id)),
        next.status === 'published',
      ),
    ).then(saved =>
      privateAlbums(saved.private).find(item => item.id === album.id)!,
    );
  }

  async deleteUnusedPhoto(photoId: string): Promise<void> {
    const saved = await this.transact(data =>
      markPhotoForDeletion(data, photoId),
    );
    const photo = saved.private?.photoDeletions?.[photoId];
    if (!photo) return;
    // A tombstone blocks reuse while Storage deletion is running, and allows retry.
    await this.deletePhotoFiles(photo);
    await this.transact(data => {
      const next = structuredClone(data);
      if (next.private?.photoDeletions)
        delete next.private.photoDeletions[photoId];
      return next;
    });
  }

  async deleteEmptyDraftAlbum(albumId: string): Promise<void> {
    await this.transact(data => {
      if (data.private?.schemaVersion !== 2)
        throw new Error(
          'La biblioteca necesita la migración de fotografías antes de guardar.',
        );
      const next = structuredClone(data);
      if (emptyDraftDeletion(next.private?.albums?.[albumId] ?? null) !== null)
        throw new Error(
          'El álbum ya no es un borrador vacío. Vuelve a seleccionarlo para revisar sus cambios.',
        );
      if (next.private?.albums) delete next.private.albums[albumId];
      return next;
    });
  }

  async unpublishAlbum(album: Album): Promise<void> {
    if (!this.services) throw new Error('Firebase no está configurado.');
    await this.transact(data => {
      const next = saveSharedAlbum(
        data,
        { ...album, status: 'draft' },
        [],
        false,
      );
      if (next.public?.albums) delete next.public.albums[album.id];
      return next;
    });
  }

  async saveSiteConfig(config: SiteConfig): Promise<void> {
    if (!this.services) throw new Error('Firebase no está configurado.');
    await update(databaseRef(this.services.database), {
      'private/site': config,
      'public/site': config,
    });
  }

  async uploadOriginal(
    albumId: string,
    photoId: string,
    file: File,
    onProgress: (progress: number) => void,
  ): Promise<string> {
    const path = versionedOriginalPath(albumId, photoId, file.name);
    await this.upload(path, file, file.type, onProgress);
    return path;
  }

  async uploadVariants(
    albumId: string,
    photoId: string,
    variants: readonly ProcessedImage[],
    onProgress: (progress: number) => void,
  ): Promise<{ paths: string[]; urls: PhotoVariantUrls }> {
    const urls = {} as PhotoVariantUrls;
    const paths: string[] = [];
    const version = `${Date.now()}-${crypto.randomUUID()}`;
    let completed = 0;
    for (const variant of variants) {
      const path = `public/${albumId}/${photoId}/${variant.variant}-${version}.webp`;
      const url = await this.upload(
        path,
        variant.blob,
        'image/webp',
        progress => onProgress((completed + progress) / variants.length),
      );
      paths.push(path);
      urls[variant.variant] = url;
      completed += 1;
    }
    return { paths, urls };
  }

  async deletePhotoFiles(photo: SharedPhoto): Promise<void> {
    const paths = [photo.originalPath, ...photo.publicPaths].filter(
      (path): path is string => Boolean(path),
    );
    await this.deletePaths(paths);
  }

  async deletePaths(paths: readonly string[]): Promise<void> {
    const services = this.services;
    if (!services) throw new Error('Firebase no está configurado.');
    const current = await get(databaseRef(services.database));
    const unused = unreferencedPaths(current.val() ?? {}, paths);
    await Promise.all(
      unused.map(async path => {
        try {
          await deleteObject(storageRef(services.storage, path));
        } catch (error) {
          if (
            typeof error !== 'object' ||
            error === null ||
            !('code' in error) ||
            error.code !== 'storage/object-not-found'
          ) {
            throw error;
          }
        }
      }),
    );
  }

  async getOriginalFile(photo: GalleryPhoto): Promise<File> {
    if (!this.services || !photo.originalPath)
      throw new Error('La fotografía no tiene un original privado disponible.');
    try {
      const blob = await getBlob(
        storageRef(this.services.storage, photo.originalPath),
      );
      return new File([blob], photo.fileName, {
        type: blob.type || 'image/jpeg',
      });
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'storage/object-not-found'
      ) {
        throw new Error(
          'No se encontró el archivo original privado de esta fotografía.',
          { cause: error },
        );
      }
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error.code === 'storage/unauthorized' ||
          error.code === 'storage/unauthenticated')
      ) {
        throw new Error(
          'La sesión no tiene permiso para descargar el original privado.',
          { cause: error },
        );
      }
      throw new Error(
        'No fue posible descargar el original privado. Revisa tu conexión e inténtalo de nuevo.',
        { cause: error },
      );
    }
  }

  private upload(
    path: string,
    data: Blob,
    contentType: string,
    onProgress: (progress: number) => void,
  ): Promise<string> {
    if (!this.services)
      return Promise.reject(new Error('Firebase no está configurado.'));
    const fileRef = storageRef(this.services.storage, path);
    const task = uploadBytesResumable(fileRef, data, {
      contentType,
      cacheControl: path.startsWith('public/')
        ? 'public,max-age=31536000,immutable'
        : 'private,max-age=0,no-store',
    });
    return new Promise((resolve, reject) => {
      task.on(
        'state_changed',
        snapshot =>
          onProgress(
            snapshot.totalBytes > 0
              ? snapshot.bytesTransferred / snapshot.totalBytes
              : 0,
          ),
        reject,
        () => void getDownloadURL(task.snapshot.ref).then(resolve, reject),
      );
    });
  }
}
