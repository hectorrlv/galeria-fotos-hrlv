const ADMIN_UIDS: ReadonlySet<string> = new Set([
  'tt6Vtlpd7rfbX8F9ZSj2yqTyJTV2',
]);

export const isAdminUid = (uid: string | null | undefined): boolean =>
  typeof uid === 'string' && ADMIN_UIDS.has(uid);
