const fileExtension = (fileName: string) =>
  fileName
    .split('.')
    .pop()
    ?.toLowerCase()
    .replace(/[^a-z0-9]/g, '') || 'image';

export const versionedOriginalPath = (
  albumId: string,
  photoId: string,
  fileName: string,
  now = Date.now(),
  version: string = crypto.randomUUID(),
) =>
  `originals/${albumId}/${photoId}/original-${now}-${version}.${fileExtension(fileName)}`;
