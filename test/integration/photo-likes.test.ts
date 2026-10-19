import assert from 'node:assert/strict';
import { after, beforeEach, test } from 'node:test';
import { deleteApp, initializeApp } from 'firebase/app';
import {
  connectAuthEmulator,
  getAuth,
  signInAnonymously,
  signInWithCustomToken,
  signOut,
} from 'firebase/auth';
import {
  connectDatabaseEmulator,
  get,
  getDatabase,
  increment,
  ref,
  set,
  update,
} from 'firebase/database';
import { getStorage } from 'firebase/storage';
import { likesSeed } from '../fixtures/photo-likes.js';
import type { PhotoLikeState } from '../../src/firebase/photo-likes-service.js';

const databaseAddress = process.env.FIREBASE_DATABASE_EMULATOR_HOST;
const authAddress = process.env.FIREBASE_AUTH_EMULATOR_HOST;
for (const address of [databaseAddress, authAddress]) {
  if (!address || !['localhost', '127.0.0.1'].includes(address.split(':')[0]!))
    throw new Error(
      'Estas pruebas requieren emuladores locales de Auth y Database; nunca usan Firebase real.',
    );
}
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
const { PhotoLikesService } =
  await import('../../src/firebase/photo-likes-service.js');
const { GalleryRepository } =
  await import('../../src/firebase/gallery-repository.js');
const [host, port] = databaseAddress!.split(':');
const adminUid = 'tt6Vtlpd7rfbX8F9ZSj2yqTyJTV2';
const apps = ['owner', 'first', 'second', 'admin-session'].map(name =>
  initializeApp(
    {
      projectId: 'demo-gallery-likes',
      apiKey: 'demo-gallery-likes-key',
      databaseURL: 'https://demo-gallery-likes-default-rtdb.firebaseio.com',
      storageBucket: 'demo-gallery-likes.appspot.com',
    },
    `likes-${name}`,
  ),
);
const services = apps.map((app, index) => {
  const auth = getAuth(app);
  connectAuthEmulator(auth, `http://${authAddress}`, { disableWarnings: true });
  const database = getDatabase(app);
  connectDatabaseEmulator(
    database,
    host!,
    Number(port),
    index === 0 ? { mockUserToken: { sub: adminUid } } : undefined,
  );
  return { app, auth, database, storage: getStorage(app) };
});
const owner = services[0]!;
const first = services[1]!;
const second = services[2]!;
const client = () => new PhotoLikesService(first);
const state = (
  service: InstanceType<typeof PhotoLikesService>,
  predicate: (s: PhotoLikeState) => boolean,
) =>
  new Promise<PhotoLikeState>((resolve, reject) => {
    let stop = () => undefined as void;
    const timer = setTimeout(() => {
      stop();
      reject(new Error('No llegó el estado esperado de likes.'));
    }, 8000);
    stop = service.observe('p', value => {
      if (!predicate(value)) return;
      clearTimeout(timer);
      queueMicrotask(() => stop());
      resolve(value);
    });
  });
const count = async () =>
  (await get(ref(owner.database, 'photoLikes/p/count'))).val();

beforeEach(async () => {
  await Promise.all(services.map(s => signOut(s.auth)));
  await set(ref(owner.database), likesSeed());
});
after(async () => {
  await Promise.all(apps.map(app => deleteApp(app)));
});

test('creates an identity only at the first like, shares state, and adds/removes idempotently', async () => {
  const service = client();
  await state(service, s => s.ready && s.count === 0);
  assert.equal(Boolean(first.auth.currentUser), false);
  const seen: PhotoLikeState[] = [];
  const stop = service.observe('p', s => seen.push(s));
  try {
    await service.setLiked('p', 'viaje', true);
    const uid = first.auth.currentUser?.uid;
    assert.ok(uid);
    await state(
      service,
      s => s.ready && s.liked && s.count === 1 && !s.pending,
    );
    assert.ok(seen.some(s => s.pending));
    await service.setLiked('p', 'favoritas', true);
    assert.equal(await count(), 1);
    assert.deepEqual(
      (await get(ref(owner.database, `photoLikes/p/voters/${uid}`))).val(),
      { albumId: 'viaje' },
    );
    await service.setLiked('p', 'favoritas', false);
    await state(service, s => s.ready && !s.liked && s.count === 0);
    await service.setLiked('p', 'viaje', false);
    assert.equal(await count(), 0);
    assert.equal(first.auth.currentUser?.uid, uid);
  } finally {
    stop();
  }
});

test('counts concurrent independent identities and recovers duplicate requests from the same identity', async () => {
  const a = client();
  const b = new PhotoLikesService(second);
  await Promise.all([
    a.setLiked('p', 'viaje', true),
    b.setLiked('p', 'favoritas', true),
  ]);
  assert.notEqual(first.auth.currentUser?.uid, second.auth.currentUser?.uid);
  assert.equal(await count(), 2);
  await Promise.all([
    a.setLiked('p', 'viaje', false),
    b.setLiked('p', 'favoritas', false),
  ]);
  assert.equal(await count(), 0);
  await Promise.all([
    a.setLiked('p', 'viaje', true),
    new PhotoLikesService(first).setLiked('p', 'viaje', true),
  ]);
  assert.equal(await count(), 1);
});

test('public counts and private own votes do not disclose voters or editorial data', async () => {
  const service = client();
  await service.setLiked('p', 'viaje', true);
  const uid = first.auth.currentUser!.uid;
  assert.equal(
    (await get(ref(second.database, 'photoLikes/p/count'))).val(),
    1,
  );
  await assert.rejects(get(ref(second.database, 'photoLikes/p/voters')));
  await assert.rejects(get(ref(second.database, `photoLikes/p/voters/${uid}`)));
  await assert.rejects(get(ref(second.database, 'private/photos')));
  await assert.rejects(set(ref(second.database, 'photoLikes/p/count'), 2));
  await signInAnonymously(second.auth);
  await assert.rejects(get(ref(second.database, `photoLikes/p/voters/${uid}`)));
  assert.equal(
    (await get(ref(first.database, `photoLikes/p/voters/${uid}`))).exists(),
    true,
  );
  await assert.rejects(
    set(ref(second.database, `photoLikes/p/voters/${uid}`), {
      albumId: 'viaje',
    }),
  );
});

test('rules reject arbitrary, fractional, negative, unpaired, foreign and unpublished votes', async () => {
  await signInAnonymously(first.auth);
  const uid = first.auth.currentUser!.uid;
  const root = ref(first.database, 'photoLikes/p');
  for (const invalid of [0, 1, -1, 0.5])
    await assert.rejects(
      set(ref(first.database, 'photoLikes/p/count'), invalid),
    );
  await assert.rejects(
    set(ref(first.database, `photoLikes/p/voters/${uid}`), {
      albumId: 'viaje',
    }),
  );
  await assert.rejects(
    update(root, { count: 1, [`voters/${uid}`]: { albumId: 'absent' } }),
  );
  await assert.rejects(
    update(root, {
      count: 1,
      [`voters/${uid}`]: { albumId: 'viaje', extra: true },
    }),
  );
  await assert.rejects(
    update(root, { count: 1, [`voters/foreign`]: { albumId: 'viaje' } }),
  );
  await assert.rejects(
    update(ref(first.database, 'photoLikes/missing'), {
      count: 1,
      [`voters/${uid}`]: { albumId: 'viaje' },
    }),
  );
  await client().setLiked('p', 'viaje', true);
  await assert.rejects(set(ref(first.database, 'photoLikes/p/count'), null));
  await assert.rejects(
    update(root, {
      count: increment(1),
      [`voters/${uid}`]: { albumId: 'viaje' },
    }),
  );
  await assert.rejects(update(root, { count: -1, [`voters/${uid}`]: null }));
  await assert.rejects(update(root, { count: 1, other: 'injected' }));
  assert.equal(await count(), 1);
  await set(ref(owner.database, 'public/albums/viaje/photos/p'), null);
  await assert.rejects(
    update(root, {
      count: increment(1),
      [`voters/${uid}`]: { albumId: 'viaje' },
    }),
  );
  await assert.rejects(
    new PhotoLikesService(second).setLiked('p', 'viaje', true),
  );
  await set(ref(owner.database, 'public/albums/viaje/photos/q/visible'), false);
  await assert.rejects(client().setLiked('q', 'viaje', true));
  assert.equal(await count(), 1);
});

test('a concurrent editorial transaction preserves visitor likes', async () => {
  const repository = new GalleryRepository(owner);
  const before = likesSeed().private!.photos!.p!;
  const after = { ...before, caption: 'Edición concurrente' };
  await Promise.all([
    repository.savePhoto(after, before),
    client().setLiked('p', 'viaje', true),
  ]);
  assert.equal(await count(), 1);
  assert.equal(
    (
      await get(ref(owner.database, 'public/albums/viaje/photos/p/caption'))
    ).val(),
    'Edición concurrente',
  );
});

test('keeps likes through editorial changes and unpublication; removes them on permanent deletion', async () => {
  await client().setLiked('p', 'viaje', true);
  const repository = new GalleryRepository(owner);
  // This test exercises Database cleanup only; Storage is never contacted.
  repository.deletePhotoFiles = async () => undefined;
  const album = likesSeed().public!.albums!.viaje!;
  const edited = { ...album.photos.p!, caption: 'Nuevo pie de foto' };
  const { sharedPhoto, privateAlbums } =
    await import('../../src/firebase/shared-photos.js');
  await repository.savePhoto(sharedPhoto(edited), sharedPhoto(album.photos.p!));
  assert.equal(await count(), 1);
  for (const a of privateAlbums(
    (await get(ref(owner.database, 'private'))).val(),
  )) {
    const draft = await repository.unpublishAlbum(a, []);
    await repository.removeAlbumPhotos(draft, ['p']);
  }
  assert.equal(await count(), 1);
  await repository.deleteUnusedPhoto('p');
  assert.equal(
    (await get(ref(owner.database, 'photoLikes/p'))).exists(),
    false,
  );
});

test('reuses the existing administrator session rather than signing in anonymously', async () => {
  const session = services[3]!;
  const now = Math.floor(Date.now() / 1000);
  const encode = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString('base64url');
  const token = `${encode({ alg: 'none', typ: 'JWT' })}.${encode({ uid: adminUid, iss: 'emulator@example.test', sub: 'emulator@example.test', aud: 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit', iat: now, exp: now + 3600 })}.`;
  await signInWithCustomToken(session.auth, token);
  const previous = session.auth.currentUser;
  await new PhotoLikesService(session).setLiked('p', 'viaje', true);
  assert.equal(session.auth.currentUser, previous);
  assert.equal(session.auth.currentUser!.uid, adminUid);
  assert.equal(session.auth.currentUser!.isAnonymous, false);
  assert.equal(await count(), 1);
});

test('reports rejected writes while keeping the confirmed state', async () => {
  const service = client();
  const stop = service.observe('p', () => undefined);
  try {
    await state(service, s => s.ready);
    await assert.rejects(
      service.setLiked('p', 'absent', true),
      /No se pudo guardar/,
    );
    const confirmed = await state(service, s => !s.pending && Boolean(s.error));
    assert.equal(confirmed.count, 0);
    assert.equal(confirmed.liked, false);
  } finally {
    stop();
  }
});
