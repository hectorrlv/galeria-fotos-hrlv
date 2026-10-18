import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createDraftAlbum,
  DEFAULT_CREDIT,
  type Album,
  type SharedPhoto,
} from '../../src/models/gallery.js';
import {
  albumValues,
  emptyDraftDeletion,
} from '../../src/firebase/album-data.js';
import { publicAlbum } from '../../src/firebase/publication.js';
import {
  markPhotoForDeletion,
  migrateSharedPhotos,
  privateAlbums,
  samePhoto,
  saveSharedAlbum,
  saveSharedPhoto,
  sharedPhoto,
  storedAlbum,
  unreferencedPaths,
  type GalleryDatabase,
} from '../../src/firebase/shared-photos.js';

const photo = (id = 'p'): SharedPhoto => ({
  id,
  fileName: 'paris.jpg',
  width: 1200,
  height: 800,
  caption: 'París',
  location: 'Francia',
  takenAt: '2026-10-01',
  altText: 'El Sena',
  originalPath: `originals/photos/${id}/original.jpg`,
  publicPaths: [`public/photos/${id}/grid.webp`],
  urls: {
    thumbnail: '/thumb.webp',
    grid: '/grid.webp',
    viewer: '/viewer.webp',
  },
  credit: { ...DEFAULT_CREDIT },
});
const album = (id: string, p = photo(), visible = true): Album => ({
  ...createDraftAlbum(1),
  id,
  slug: id,
  title: id,
  description: 'Relato',
  photoOrder: [p.id],
  coverPhotoId: p.id,
  photos: { [p.id]: { ...p, albumId: id, visible } },
});
const fixture = (): GalleryDatabase => {
  const a = { ...album('viaje'), status: 'published' as const, publishedAt: 5 };
  const b = {
    ...album('favoritas'),
    status: 'published' as const,
    publishedAt: 6,
  };
  return {
    private: {
      schemaVersion: 2,
      photos: { p: photo() },
      albums: { viaje: storedAlbum(a), favoritas: storedAlbum(b) },
    },
    public: { albums: { viaje: publicAlbum(a), favoritas: publicAlbum(b) } },
  };
};

test('resolves one canonical photo in multiple albums with independent visibility and order', () => {
  const source = fixture();
  const local = album('borrador', photo(), false);
  const saved = saveSharedAlbum(source, local, [], false, 10);
  assert.equal(Object.keys(saved.private!.photos!).length, 1);
  const draft = privateAlbums(saved.private).find(
    item => item.id === 'borrador',
  )!;
  assert.equal(draft.photos.p?.visible, false);
  assert.equal(
    privateAlbums(saved.private).find(item => item.id === 'viaje')!.photos.p
      ?.visible,
    true,
  );
  assert.deepEqual(draft.photoOrder, ['p']);
  assert.equal('photos' in saved.private!.albums!.borrador!, false);
  assert.equal('albumId' in saved.private!.photos!.p!, false);
  assert.equal('photoRefs' in draft, false);
});

test('saving a shared edit from a draft patches all public appearances without publishing other pending fields', () => {
  const source = fixture();
  source.private!.albums!.viaje!.description = 'Relato privado pendiente';
  const hidden = album('oculto', photo(), false);
  source.private!.albums!.oculto = storedAlbum(hidden);
  const local = album('borrador');
  local.photos.p!.caption = 'Nuevo pie';
  const saved = saveSharedAlbum(
    source,
    local,
    [{ photo: sharedPhoto(local.photos.p!), previous: photo() }],
    false,
    10,
  );
  for (const value of Object.values(saved.public!.albums!)) {
    assert.equal(value.photos.p?.caption, 'Nuevo pie');
    assert.equal(value.photos.p?.originalPath, undefined);
    assert.equal(value.description, 'Relato');
  }
  assert.equal(saved.public!.albums!.borrador, undefined);
  assert.equal(saved.public!.albums!.oculto, undefined);
  assert.equal(
    saved.private!.albums!.viaje!.description,
    'Relato privado pendiente',
  );
  assert.equal(
    privateAlbums(saved.private).find(a => a.id === 'oculto')!.photos.p
      ?.caption,
    'Nuevo pie',
  );
  assert.equal(source.private!.photos!.p!.caption, 'París');
});

test('removing a reference retains canonical files, other albums and reusable orphan photos', () => {
  const source = fixture();
  const a = {
    ...album('viaje'),
    status: 'draft' as const,
    photos: {},
    photoOrder: [],
    coverPhotoId: null,
  };
  const saved = saveSharedAlbum(source, a, [], false);
  assert.deepEqual(saved.private!.photos!.p, photo());
  assert.ok(saved.private!.albums!.favoritas);
  assert.deepEqual(
    privateAlbums(saved.private).find(item => item.id === 'viaje')!.photos,
    {},
  );
});

test('rejects permanent deletion while any private or public album uses the photo', () => {
  const source = fixture();
  assert.throws(() => markPhotoForDeletion(source, 'p'), /todos sus álbumes/);
  source.private!.albums = {};
  assert.throws(() => markPhotoForDeletion(source, 'p'), /todos sus álbumes/);
});

test('deletion tombstone blocks reuse and remains available to retry after Storage failure', () => {
  const source = fixture();
  source.private!.albums = {};
  source.public!.albums = {};
  const marked = markPhotoForDeletion(source, 'p');
  assert.equal(marked.private!.photos!.p, undefined);
  assert.deepEqual(marked.private!.photoDeletions!.p, photo());
  assert.deepEqual(markPhotoForDeletion(marked, 'p'), marked);
  assert.throws(
    () => saveSharedAlbum(marked, album('new'), [], false),
    /ya no está disponible/,
  );
  assert.throws(
    () => saveSharedPhoto(marked, { photo: photo(), previous: photo() }),
    /pendiente de eliminación/,
  );
});

test('rejects removal or hiding of the last visible published photo atomically', () => {
  const source = fixture();
  const hidden = {
    ...album('viaje', photo(), false),
    status: 'published' as const,
  };
  assert.throws(
    () => saveSharedAlbum(source, hidden, [], true),
    /última fotografía visible/,
  );
  assert.throws(
    () =>
      saveSharedAlbum(
        source,
        { ...hidden, photos: {}, photoOrder: [] },
        [],
        true,
      ),
    /última fotografía visible/,
  );
  assert.equal(source.public!.albums!.viaje!.photos.p?.visible, true);
});

test('publishing keeps independent cover and order and propagates only explicit photo edits', () => {
  const source = fixture();
  source.private!.photos!.q = photo('q');
  const local = album('viaje');
  local.photos.q = { ...photo('q'), albumId: 'viaje', visible: true };
  local.photoOrder = ['q', 'p'];
  local.coverPhotoId = 'q';
  local.photos.p!.caption = 'Stale editor value';
  const saved = saveSharedAlbum(source, local, [], true, 10);
  assert.deepEqual(saved.public!.albums!.viaje!.photoOrder, ['q', 'p']);
  assert.equal(saved.public!.albums!.viaje!.coverPhotoId, 'q');
  assert.equal('photoRefs' in saved.public!.albums!.viaje!, false);
  assert.equal(saved.public!.albums!.viaje!.photos.p!.caption, 'París');
  assert.deepEqual(saved.public!.albums!.favoritas!.photoOrder, ['p']);
});

test('regeneration and replacement update canonical and public variants together while retaining originals privately', () => {
  const source = fixture();
  const changed = {
    ...photo(),
    originalPath: 'originals/new.jpg',
    publicPaths: ['public/new.webp'],
    urls: { thumbnail: 'new', grid: 'new', viewer: 'new' },
  };
  const saved = saveSharedPhoto(source, { photo: changed, previous: photo() });
  assert.equal(saved.private!.photos!.p!.originalPath, 'originals/new.jpg');
  for (const value of Object.values(saved.public!.albums!)) {
    assert.equal(value.photos.p!.urls.viewer, 'new');
    assert.equal(value.photos.p!.originalPath, undefined);
  }
  assert.deepEqual(
    unreferencedPaths(saved, [
      ...photo().publicPaths,
      photo().originalPath!,
      ...changed.publicPaths,
    ]),
    [...photo().publicPaths, photo().originalPath],
  );
});

test('failed or stale updates leave every old snapshot and file reference intact', () => {
  const source = fixture();
  const original = structuredClone(source);
  assert.throws(
    () =>
      saveSharedPhoto(source, {
        photo: { ...photo(), publicPaths: ['public/new.webp'] },
        previous: { ...photo(), caption: 'Outdated' },
      }),
    /otra sesión/,
  );
  assert.deepEqual(source, original);
  assert.deepEqual(unreferencedPaths(source, photo().publicPaths), []);
});

test('compares nested fields independently of Firebase key serialization order', () => {
  const a = photo();
  const b = {
    ...a,
    urls: {
      viewer: a.urls.viewer,
      grid: a.urls.grid,
      thumbnail: a.urls.thumbnail,
    },
    credit: {
      margin: a.credit.margin,
      scale: a.credit.scale,
      opacity: a.credit.opacity,
      color: a.credit.color,
      position: a.credit.position,
    },
  };
  assert.ok(samePhoto(a, b));
});

test('legacy albums remain readable but writes require migration', () => {
  const a = album('legacy');
  const source = { private: { albums: { legacy: a } } };
  assert.equal(privateAlbums(source.private)[0]!.photos.p!.caption, 'París');
  assert.throws(() => saveSharedAlbum(source, a, [], false), /migración/);
  assert.equal(
    emptyDraftDeletion({ ...storedAlbum(a), status: 'draft' }),
    undefined,
  );
});

test('migration is idempotent, keeps distinct legacy records and preserves current public snapshots and paths', () => {
  const a = album('viaje');
  const b = album('favoritas');
  const visible = publicAlbum(a);
  visible.photos.p!.caption = 'Texto que ya era público';
  const source = {
    private: { albums: { viaje: a, favoritas: b }, site: { name: 'HRLV' } },
    public: { albums: { viaje: visible } },
  };
  const migrated = migrateSharedPhotos(source);
  assert.deepEqual(migrateSharedPhotos(migrated), migrated);
  assert.equal(Object.keys(migrated.private!.photos!).length, 2);
  assert.deepEqual(
    migrated.private!.photos!.p!.publicPaths,
    photo().publicPaths,
  );
  const viajePhotoId = privateAlbums(migrated.private).find(
    value => value.id === 'viaje',
  )!.photoOrder[0]!;
  assert.equal(
    migrated.public!.albums!.viaje!.photos[viajePhotoId]!.caption,
    'Texto que ya era público',
  );
  assert.deepEqual(migrated.private!.site, { name: 'HRLV' });
  assert.notEqual(
    privateAlbums(migrated.private).find(value => value.id === 'favoritas')!
      .photoOrder[0],
    viajePhotoId,
  );
  assert.equal(
    albumValues(migrated.public!.albums)[0]!.photos[viajePhotoId]!.originalPath,
    undefined,
  );
  assert.ok('photos' in source.private.albums.viaje);
});

test('migration refuses mixed or malformed exports instead of discarding photo references', () => {
  assert.throws(
    () =>
      migrateSharedPhotos({ private: { albums: { wrong: album('actual') } } }),
    /formato incompatible/,
  );
  assert.throws(
    () =>
      migrateSharedPhotos({
        private: { albums: { a: storedAlbum(album('a')) } },
      }),
    /formato incompatible/,
  );
  assert.throws(
    () => migrateSharedPhotos({ private: { photos: { p: photo() } } }),
    /conversión incompleta/,
  );
});
