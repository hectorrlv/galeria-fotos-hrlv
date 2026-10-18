import assert from 'node:assert/strict';
import { after, beforeEach, test } from 'node:test';
import { deleteApp, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  connectDatabaseEmulator,
  get,
  getDatabase,
  ref,
  set,
} from 'firebase/database';
import { getStorage } from 'firebase/storage';
import {
  createDraftAlbum,
  DEFAULT_CREDIT,
  type Album,
  type GalleryPhoto,
  type PhotoEdit,
} from '../../src/models/gallery.js';
import {
  migrateSharedPhotos,
  privateAlbums,
  sharedPhoto,
} from '../../src/firebase/shared-photos.js';

const address = process.env.FIREBASE_DATABASE_EMULATOR_HOST;
if (!address || !['127.0.0.1', 'localhost'].includes(address.split(':')[0]!))
  throw new Error(
    'Estas pruebas requieren FIREBASE_DATABASE_EMULATOR_HOST local; nunca usan Firebase real.',
  );
const [host, port] = address.split(':');
// Build-time constants are intentionally empty for this Node-only integration test.
for (const name of [
  'API_KEY',
  'AUTH_DOMAIN',
  'DATABASE_URL',
  'PROJECT_ID',
  'STORAGE_BUCKET',
  'MESSAGING_SENDER_ID',
  'APP_ID',
  'MEASUREMENT_ID',
])
  Object.assign(globalThis, { [`__FIREBASE_${name}__`]: '' });
const { GalleryRepository } =
  await import('../../src/firebase/gallery-repository.js');
const adminUid = 'tt6Vtlpd7rfbX8F9ZSj2yqTyJTV2';
const apps = ['admin', 'visitor', 'stranger'].map(name =>
  initializeApp(
    {
      projectId: 'demo-gallery-shared',
      databaseURL: 'https://demo-gallery-shared-default-rtdb.firebaseio.com',
      apiKey: 'demo',
      storageBucket: 'demo-gallery-shared.appspot.com',
    },
    name,
  ),
);
const databases = apps.map((app, index) => {
  const db = getDatabase(app);
  connectDatabaseEmulator(
    db,
    host!,
    Number(port),
    index === 1
      ? undefined
      : { mockUserToken: { sub: index === 0 ? adminUid : 'other-user' } },
  );
  return db;
});
const database = databases[0]!;
const repo = new GalleryRepository({
  app: apps[0]!,
  auth: getAuth(apps[0]!),
  database,
  storage: getStorage(apps[0]!),
});
const p: GalleryPhoto = {
  id: 'p',
  albumId: 'a',
  fileName: 'paris.jpg',
  width: 100,
  height: 100,
  caption: 'Antes',
  location: '',
  takenAt: '',
  altText: 'París',
  visible: true,
  originalPath: 'originals/p.jpg',
  publicPaths: ['public/p.webp'],
  urls: { thumbnail: 'thumb', grid: 'grid', viewer: 'viewer' },
  credit: DEFAULT_CREDIT,
};
const album = (id: string): Album => ({
  ...createDraftAlbum(1),
  id,
  slug: id,
  title: id,
  description: 'Relato',
  status: 'published',
  photoOrder: ['p'],
  coverPhotoId: 'p',
  photos: { p: { ...p, albumId: id } },
});
const seed = migrateSharedPhotos({
  private: { albums: { a: album('a') } },
  public: {
    albums: {
      a: { ...album('a'), photos: { p: { ...p, originalPath: undefined } } },
    },
  },
});

beforeEach(async () => {
  await set(ref(database), JSON.parse(JSON.stringify(seed)));
});
after(async () => {
  await Promise.all(apps.map(app => deleteApp(app)));
});

test('transactions associate, update all public appearances and remove references under actual rules', async () => {
  const draft = {
    ...createDraftAlbum(2),
    id: 'b',
    slug: 'b',
    title: 'b',
    description: 'Borrador',
  };
  const associated = await repo.associatePhotos(draft, ['p', 'p']);
  assert.deepEqual(associated.photoOrder, ['p']);
  await repo.publishAlbum(associated, []);
  const edited = structuredClone(associated);
  edited.photos.p!.caption = 'Después';
  await repo.saveAlbum(edited, [
    { photo: sharedPhoto(edited.photos.p!), previous: sharedPhoto(p) },
  ]);
  const saved = (await get(ref(database))).val();
  assert.equal(saved.public.albums.a.photos.p.caption, 'Después');
  assert.equal(saved.public.albums.b.photos.p.caption, 'Después');
  assert.equal(saved.public.albums.b.description, 'Borrador');
  assert.equal(saved.public.albums.a.photos.p.originalPath, undefined);
  assert.equal(saved.private.albums.b.photos, undefined);
  assert.equal(Object.keys(saved.private.photos).length, 1);
  await assert.rejects(repo.deleteUnusedPhoto('p'), /todos sus álbumes/);
  const current = privateAlbums(saved.private).find(a => a.id === 'b')!;
  await repo.unpublishAlbum(current);
  await repo.removeAlbumPhotos({ ...current, status: 'draft' }, ['p']);
  const final = (await get(ref(database))).val();
  assert.equal(final.private.photos.p.caption, 'Después');
  assert.equal(final.private.albums.b.photoRefs, undefined);
});

test('withdrawing an album saves pending shared edits and updates its other published appearances atomically', async () => {
  const draft = {
    ...createDraftAlbum(2),
    id: 'b',
    slug: 'b',
    title: 'b',
    description: 'Publicado',
  };
  const associated = await repo.associatePhotos(draft, ['p']);
  await repo.publishAlbum(associated, []);
  await set(
    ref(database, 'private/albums/b/description'),
    'Pendiente de publicar',
  );
  const edited = album('a');
  Object.assign(edited.photos.p!, {
    caption: 'Pie editado antes de retirar',
    location: 'Francia',
    altText: 'El Sena en París',
    credit: { ...DEFAULT_CREDIT, color: 'dark' },
  });
  edited.description = 'Relato editado antes de retirar';
  const withdrawn = await repo.unpublishAlbum(edited, [
    {
      photo: sharedPhoto(edited.photos.p!),
      previous: sharedPhoto(p),
    },
  ]);
  const saved = (await get(ref(database))).val();
  assert.equal(saved.public.albums.a, undefined);
  assert.equal(saved.private.albums.a.status, 'draft');
  assert.equal(saved.private.albums.a.description, edited.description);
  assert.deepEqual(saved.private.photos.p, sharedPhoto(edited.photos.p!));
  assert.equal(
    saved.public.albums.b.photos.p.caption,
    edited.photos.p!.caption,
  );
  assert.equal(
    saved.public.albums.b.photos.p.location,
    edited.photos.p!.location,
  );
  assert.equal(
    saved.public.albums.b.photos.p.altText,
    edited.photos.p!.altText,
  );
  assert.equal(saved.public.albums.b.photos.p.credit.color, 'dark');
  assert.equal(saved.public.albums.b.photos.p.originalPath, undefined);
  assert.equal(saved.public.albums.b.description, 'Publicado');
  assert.equal(withdrawn.status, 'draft');
  assert.deepEqual(
    sharedPhoto(withdrawn.photos.p!),
    sharedPhoto(edited.photos.p!),
  );
});

test('a stale shared-photo edit cannot partially withdraw the album', async () => {
  await repo.savePhoto(
    { ...sharedPhoto(p), caption: 'Editado en otra sesión' },
    sharedPhoto(p),
  );
  await assert.rejects(
    repo.unpublishAlbum(album('a'), [
      {
        photo: { ...sharedPhoto(p), caption: 'Edición desactualizada' },
        previous: sharedPhoto(p),
      },
    ]),
    /otra sesión/,
  );
  const saved = (await get(ref(database))).val();
  assert.equal(saved.private.albums.a.status, 'published');
  assert.equal(
    saved.public.albums.a.photos.p.caption,
    'Editado en otra sesión',
  );
});

test('root reads and writes are admin only, public remains readable and private paths cannot leak', async () => {
  for (const db of [databases[1]!, databases[2]!]) {
    await assert.rejects(get(ref(db)), /Permission denied/);
    await assert.rejects(
      set(ref(db, 'private/photos/p/caption'), 'No'),
      /PERMISSION_DENIED/,
    );
    assert.equal((await get(ref(db, 'public/albums/a'))).val().title, 'a');
  }
  await assert.rejects(
    set(
      ref(database, 'public/albums/a/photos/p/originalPath'),
      'originals/secret',
    ),
    /PERMISSION_DENIED/,
  );
  await assert.rejects(
    set(ref(database, 'private/albums/a'), album('a')),
    /PERMISSION_DENIED/,
  );
  await assert.rejects(
    set(ref(database, 'private/albums/a/photoRefs/missing'), { visible: true }),
    /PERMISSION_DENIED/,
  );
});

test('Storage failure keeps a deletion tombstone and retry completes safely', async () => {
  await repo.unpublishAlbum(album('a'));
  await repo.removeAlbumPhotos({ ...album('a'), status: 'draft' }, ['p']);
  const events: string[] = [];
  repo.deletePhotoFiles = async () => {
    events.push('storage');
    throw new Error('Storage sin conexión');
  };
  await assert.rejects(repo.deleteUnusedPhoto('p'), /sin conexión/);
  const marked = (await get(ref(database))).val();
  assert.equal(marked.private.photos, undefined);
  assert.ok(marked.private.photoDeletions.p);
  await assert.rejects(
    repo.associatePhotos({ ...createDraftAlbum(), id: 'c' }, ['p']),
    /no está disponible/,
  );
  repo.deletePhotoFiles = async () => {
    events.push('retry');
  };
  await repo.deleteUnusedPhoto('p');
  assert.equal(
    (await get(ref(database, 'private/photoDeletions'))).exists(),
    false,
  );
  assert.deepEqual(events, ['storage', 'retry']);
});

test('simultaneous edits cannot overwrite an already changed shared photo', async () => {
  const edits: PhotoEdit[] = ['Primera', 'Segunda'].map(caption => ({
    photo: { ...sharedPhoto(p), caption },
    previous: sharedPhoto(p),
  }));
  const results = await Promise.allSettled(
    edits.map(edit => repo.savePhoto(edit.photo, edit.previous!)),
  );
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(results.filter(r => r.status === 'rejected').length, 1);
  const value = (await get(ref(database))).val();
  assert.equal(
    value.private.photos.p.caption,
    value.public.albums.a.photos.p.caption,
  );
});

test('a concurrent association and permanent deletion cannot leave a dangling reference', async () => {
  await repo.unpublishAlbum(album('a'));
  await repo.removeAlbumPhotos({ ...album('a'), status: 'draft' }, ['p']);
  repo.deletePhotoFiles = async () => undefined;
  const draft = {
    ...createDraftAlbum(2),
    id: 'race',
    title: 'race',
    slug: 'race',
  };
  const outcomes = await Promise.allSettled([
    repo.associatePhotos(draft, ['p']),
    repo.deleteUnusedPhoto('p'),
  ]);
  assert.equal(
    outcomes.filter(result => result.status === 'fulfilled').length,
    1,
  );
  const saved = (await get(ref(database))).val();
  if (saved.private.albums?.race?.photoRefs?.p)
    assert.ok(saved.private.photos?.p);
  else assert.equal(saved.private.photos?.p, undefined);
});
