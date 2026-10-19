import type { GalleryDatabase } from './shared-photos.js';

export const EDITORIAL_ROOT = 'editorial';
export const EDITORIAL_LAYOUT_VERSION = 1;

export interface GalleryDatabaseRoot {
  editorial?: GalleryDatabase & { layoutVersion: number };
  private?: GalleryDatabase['private'];
  public?: GalleryDatabase['public'];
  [key: string]: unknown;
}

/** Offline only: keep engagement and unrelated root data outside editorial CAS. */
export const isolateEditorialData = (
  source: GalleryDatabaseRoot,
): GalleryDatabaseRoot => {
  const data = structuredClone(source);
  for (const value of [data.private, data.public, data.editorial]) {
    if (value != null && (typeof value !== 'object' || Array.isArray(value)))
      throw new Error(
        'La exportación contiene datos editoriales incompatibles.',
      );
  }
  if (data.editorial) {
    if (data.private || data.public)
      throw new Error(
        'La exportación mezcla datos editoriales nuevos y anteriores.',
      );
    if (data.editorial.layoutVersion !== EDITORIAL_LAYOUT_VERSION)
      throw new Error('Versión editorial desconocida.');
    return data;
  }
  if (!data.private && !data.public)
    throw new Error(
      'Se necesita una exportación de la raíz de Realtime Database.',
    );
  if (
    Object.keys(data.private?.albums ?? {}).length &&
    data.private?.schemaVersion !== 2
  )
    throw new Error('Ejecuta primero la migración de fotografías compartidas.');
  const { private: privateData, public: publicData, ...rest } = data;
  return {
    ...rest,
    editorial: {
      layoutVersion: EDITORIAL_LAYOUT_VERSION,
      ...(privateData ? { private: privateData } : {}),
      ...(publicData ? { public: publicData } : {}),
    },
  };
};
