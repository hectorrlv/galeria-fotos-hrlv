import {
  onValue,
  ref as databaseRef,
  set,
  update,
  type Unsubscribe,
} from 'firebase/database';
import {
  deleteObject,
  getDownloadURL,
  ref as storageRef,
  uploadBytesResumable,
} from 'firebase/storage';
import type { ProcessedImage } from '../image-processing/contracts.js';
import {
  DEFAULT_SITE_CONFIG,
  type Album,
  type GalleryPhoto,
  type PhotoVariantUrls,
  type SiteConfig,
} from '../models/gallery.js';
import { getFirebaseServices } from './client.js';
import { publicationChanges } from './publication.js';

type ErrorCallback = (error: Error) => void;

const albumValues = (value: unknown): Album[] => {
  if (!value || typeof value !== 'object') return [];
  return Object.values(value as Record<string, Album>).sort(
    (left, right) =>
      (right.publishedAt ?? right.updatedAt) -
      (left.publishedAt ?? left.updatedAt),
  );
};

export class GalleryRepository {
  private readonly services = getFirebaseServices();

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
      databaseRef(this.services.database, 'private/albums'),
      snapshot => callback(albumValues(snapshot.val())),
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

  async saveAlbum(album: Album): Promise<void> {
    if (!this.services) throw new Error('Firebase no está configurado.');
    await set(
      databaseRef(this.services.database, `private/albums/${album.id}`),
      { ...album, updatedAt: Date.now() },
    );
  }

  async publishAlbum(album: Album, albums: readonly Album[]): Promise<Album> {
    if (!this.services) throw new Error('Firebase no está configurado.');
    const { published, changes } = publicationChanges(album, albums);
    await update(databaseRef(this.services.database), changes);
    return published;
  }

  async unpublishAlbum(album: Album): Promise<void> {
    if (!this.services) throw new Error('Firebase no está configurado.');
    await update(databaseRef(this.services.database), {
      [`private/albums/${album.id}`]: {
        ...album,
        status: 'draft',
        updatedAt: Date.now(),
      },
      [`public/albums/${album.id}`]: null,
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
    const extension =
      file.name
        .split('.')
        .pop()
        ?.toLowerCase()
        .replace(/[^a-z0-9]/g, '') || 'image';
    const path = `originals/${albumId}/${photoId}/original.${extension}`;
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
    const version = Date.now();
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

  async deletePhotoFiles(photo: GalleryPhoto): Promise<void> {
    const paths = [photo.originalPath, ...photo.publicPaths].filter(
      (path): path is string => Boolean(path),
    );
    await this.deletePaths(paths);
  }

  async deletePaths(paths: readonly string[]): Promise<void> {
    const services = this.services;
    if (!services) throw new Error('Firebase no está configurado.');
    await Promise.all(
      paths.map(async path => {
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
    const url = await getDownloadURL(
      storageRef(this.services.storage, photo.originalPath),
    );
    const response = await fetch(url);
    if (!response.ok)
      throw new Error('No fue posible recuperar el original privado.');
    const blob = await response.blob();
    return new File([blob], photo.fileName, {
      type: blob.type || 'image/jpeg',
    });
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
