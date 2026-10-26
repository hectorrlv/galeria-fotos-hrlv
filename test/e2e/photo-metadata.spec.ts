import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import {
  createDraftAlbum,
  DEFAULT_CREDIT,
  DEFAULT_SITE_CONFIG,
  type Album,
  type GalleryPhoto,
  type PhotoEdit,
} from '../../src/models/gallery.js';
import { publicAlbum } from '../../src/firebase/publication.js';
import {
  saveSharedAlbum,
  sharedPhoto,
  storedAlbum,
  type GalleryDatabase,
} from '../../src/firebase/shared-photos.js';

const gpsPath = fileURLToPath(
  new URL('../fixtures/gps-madrid.jpg', import.meta.url),
);
const plainPath = fileURLToPath(
  new URL('../fixtures/no-gps.jpg', import.meta.url),
);
const madrid = { address: { city: 'Madrid', country: 'España' } };
const endpoint = 'https://nominatim.openstreetmap.org/reverse?*';
const corsHeaders = { 'access-control-allow-origin': '*' };
const thumbnail =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="#789"/></svg>',
  );
const makePhoto = (id: string, location = ''): GalleryPhoto => ({
  id,
  albumId: 'viaje',
  fileName: `${id}.jpg`,
  width: 16,
  height: 16,
  caption: 'Pie conservado',
  location,
  takenAt: '2020-02-03',
  altText: `Foto ${id}`,
  visible: id !== 'gps',
  originalPath: `originals/photos/${id}/original.jpg`,
  publicPaths: [`public/photos/${id}/grid.webp`],
  urls: { thumbnail, grid: thumbnail, viewer: thumbnail },
  credit: { ...DEFAULT_CREDIT },
});
const makeAlbum = (photos: GalleryPhoto[]): Album => ({
  ...createDraftAlbum(1),
  id: 'viaje',
  slug: 'viaje',
  title: 'Viaje de prueba',
  description: 'Relato conservado',
  country: 'España',
  location: 'Lugares del álbum',
  startDate: '2020-01-01',
  photoOrder: photos.map(photo => photo.id),
  coverPhotoId: photos.find(photo => photo.visible)?.id ?? null,
  photos: Object.fromEntries(photos.map(photo => [photo.id, photo])),
});

const mount = async (page: Page, album = makeAlbum([])) => {
  await page.goto('/admin');
  const admin = page.locator('admin-page');
  await admin.evaluate(
    async (element, fixture) => {
      const component = element as HTMLElement &
        Record<string, unknown> & { updateComplete: Promise<unknown> };
      await component.updateComplete;
      component['albums'] = [fixture.album];
      component['site'] = fixture.site;
      (component['selectAlbum'] as (value: Album) => void)(fixture.album);
      const calls: { album: Album; edits: PhotoEdit[]; published: boolean }[] =
        [];
      component['testSaves'] = calls;
      const downloads: string[] = [];
      component['testDownloads'] = downloads;
      const save = async (
        value: Album,
        edits: PhotoEdit[],
        published: boolean,
      ) => {
        calls.push(structuredClone({ album: value, edits, published }));
        return structuredClone(value);
      };
      component['repository'] = {
        getOriginalFile: async (photo: GalleryPhoto) => {
          downloads.push(photo.id);
          if (photo.id === 'missing') throw new Error('Original no encontrado');
          const bytes =
            photo.id === 'plain'
              ? fixture.plain
              : photo.id === 'broken'
                ? [0, 1, 2]
                : photo.id === 'retry'
                  ? fixture.nearby
                  : fixture.gps;
          return new File([new Uint8Array(bytes)], photo.fileName, {
            type: 'image/jpeg',
          });
        },
        saveAlbum: (value: Album, edits: PhotoEdit[]) =>
          save(value, edits, false),
        publishAlbum: (value: Album, _albums: Album[], edits: PhotoEdit[]) =>
          save(value, edits, true),
        uploadOriginal: async () => 'originals/photos/new/original.jpg',
        uploadVariants: async () => ({
          paths: [],
          urls: {
            thumbnail: fixture.thumbnail,
            grid: fixture.thumbnail,
            viewer: fixture.thumbnail,
          },
        }),
      };
      component['processor'] = {
        process: async () => ({
          originalWidth: 16,
          originalHeight: 16,
          variants: [],
          credit: fixture.site.defaultCredit,
        }),
      };
      component['render'] = () => [
        (component['renderMessages'] as () => unknown).call(component),
        (component['renderAlbumWorkspace'] as () => unknown).call(component),
      ];
      (component['requestUpdate'] as () => void).call(component);
      await component.updateComplete;
    },
    {
      album,
      site: { ...DEFAULT_SITE_CONFIG, creditText: '@HRLV' },
      gps: [...readFileSync(gpsPath)],
      nearby: [
        ...readFileSync(
          new URL('../fixtures/gps-madrid-nearby.jpg', import.meta.url),
        ),
      ],
      plain: [...readFileSync(plainPath)],
      thumbnail,
    },
  );
  return admin;
};

const readDraft = (admin: ReturnType<Page['locator']>) =>
  admin.evaluate(
    element =>
      (element as HTMLElement & Record<string, unknown>)['draft'] as Album,
  );
const readSaves = (admin: ReturnType<Page['locator']>) =>
  admin.evaluate(
    element =>
      (element as HTMLElement & Record<string, unknown>)['testSaves'] as {
        album: Album;
        edits: PhotoEdit[];
        published: boolean;
      }[],
  );

test('new uploads use real EXIF and persist date and location without storing diagnostics', async ({
  page,
}) => {
  const requests: URL[] = [];
  await page.route(endpoint, async route => {
    requests.push(new URL(route.request().url()));
    await route.fulfill({ json: madrid, headers: corsHeaders });
  });
  const admin = await mount(page);
  await admin
    .getByText('Agregar fotografías', { exact: true })
    .locator('input')
    .setInputFiles([gpsPath, plainPath]);
  await expect(
    admin.getByText('2 fotografías agregadas.', { exact: true }),
  ).toBeVisible();
  const photos = Object.values((await readDraft(admin)).photos);
  expect(photos.map(photo => [photo.location, photo.takenAt])).toEqual([
    ['Madrid, España', '2025-10-09'],
    ['', '2020-01-01'],
  ]);
  expect(requests).toHaveLength(1);
  expect(Number(requests[0]!.searchParams.get('lon'))).toBeLessThan(0);
  const saved = (await readSaves(admin))[0]!;
  expect(saved.edits).toHaveLength(2);
  expect(saved.edits.every(edit => !('locationStatus' in edit.photo))).toBe(
    true,
  );
});

test('a failed lookup still uploads and names the photo in a warning', async ({
  page,
}) => {
  await page.route(endpoint, route =>
    route.fulfill({ status: 503, body: '', headers: corsHeaders }),
  );
  const admin = await mount(page);
  await admin
    .getByText('Agregar fotografías', { exact: true })
    .locator('input')
    .setInputFiles(gpsPath);
  await expect(
    admin.getByText('1 fotografía agregada.', { exact: true }),
  ).toBeVisible();
  await expect(
    admin.getByText(
      'No se pudo resolver la ubicación de: gps-madrid.jpg. Puedes recuperarla desde el original.',
      { exact: true },
    ),
  ).toBeVisible();
  const [photo] = Object.values((await readDraft(admin)).photos);
  expect(photo!.location).toBe('');
  expect(photo!.takenAt).toBe('2025-10-09');
  expect(await readSaves(admin)).toHaveLength(1);
});

test('album recovery includes hidden photos, preserves edits and continues after individual failures', async ({
  page,
}, testInfo) => {
  const album = makeAlbum([
    makePhoto('known', 'Lugar manual'),
    makePhoto('gps', '   '),
    makePhoto('plain'),
    makePhoto('missing'),
    makePhoto('broken'),
    makePhoto('retry'),
  ]);
  let release!: () => void;
  const gate = new Promise<void>(resolve => {
    release = resolve;
  });
  let lookups = 0;
  await page.route(endpoint, async route => {
    lookups += 1;
    await gate;
    await route.fulfill(
      lookups === 1
        ? { json: madrid, headers: corsHeaders }
        : { status: 503, body: '', headers: corsHeaders },
    );
  });
  const admin = await mount(page, album);
  const first = admin.locator('.photo-card').nth(0);
  await first
    .getByLabel('Pie de foto', { exact: true })
    .fill('Edición pendiente');
  await admin
    .getByRole('button', { name: 'Completar ubicaciones vacías', exact: true })
    .click();
  await expect(
    admin.getByText('Recuperando ubicación 1 de 5: gps.jpg', { exact: true }),
  ).toBeVisible();
  await expect(
    admin.getByRole('button', { name: 'Guardar borrador', exact: true }),
  ).toBeDisabled();
  await expect(
    admin.getByRole('button', {
      name: 'Completar ubicaciones vacías',
      exact: true,
    }),
  ).toBeDisabled();
  release();
  await expect(
    admin.getByText(
      'Ubicaciones recuperadas: 1. Sin GPS válido: 1. Errores de descarga: 1. Errores de lectura: 1. Errores del servicio: 1. Revisa los lugares y guarda el álbum para conservarlos.',
      { exact: true },
    ),
  ).toBeVisible();
  const draft = await readDraft(admin);
  expect(draft.photos.gps).toEqual({
    ...album.photos.gps,
    location: 'Madrid, España',
  });
  expect(draft.photos.known!.caption).toBe('Edición pendiente');
  expect(draft.photos.known!.location).toBe('Lugar manual');
  expect(draft.photoOrder).toEqual(album.photoOrder);
  expect(await readSaves(admin)).toEqual([]);
  expect(
    await admin.evaluate(
      element =>
        (element as HTMLElement & Record<string, unknown>)['testDownloads'],
    ),
  ).toEqual(['gps', 'plain', 'missing', 'broken', 'retry']);
  const baseline = await admin.evaluate(
    element =>
      (element as HTMLElement & Record<string, unknown>)[
        'photoBaseline'
      ] as Record<string, GalleryPhoto>,
  );
  expect(baseline.gps!.location).toBe('   ');
  await expect(
    admin.getByText(/No se pudo descargar el original: missing.jpg/),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await admin
    .locator('.photo-card')
    .nth(1)
    .screenshot({ path: testInfo.outputPath('location-recovered.png') });
  // The failed lookup must be retryable, not cached as a permanent failure.
  await page.unroute(endpoint);
  await page.route(endpoint, route =>
    route.fulfill({ json: madrid, headers: corsHeaders }),
  );
  const retryCard = admin.locator('.photo-card').nth(5);
  await retryCard
    .getByRole('button', { name: 'Recuperar ubicación', exact: true })
    .click();
  await expect(retryCard.getByLabel('Lugar', { exact: true })).toHaveValue(
    'Madrid, España',
  );
  await expect(
    admin.getByRole('button', { name: 'Guardar borrador', exact: true }),
  ).toBeEnabled();
  expect(await readSaves(admin)).toEqual([]);
  await admin
    .getByRole('button', { name: 'Guardar borrador', exact: true })
    .click();
  await expect(
    admin.getByText('Borrador guardado.', { exact: true }),
  ).toBeVisible();
  const [save] = await readSaves(admin);
  expect(save!.edits.map(edit => edit.photo.id)).toEqual([
    'known',
    'gps',
    'retry',
  ]);
  expect(
    save!.edits.find(edit => edit.photo.id === 'gps')!.previous!.location,
  ).toBe('   ');

  // Exercise the real persistence transform with the edits produced by the UI.
  const shared = makeAlbum([album.photos.gps!]);
  shared.id = 'favoritas';
  shared.slug = 'favoritas';
  shared.status = 'published';
  shared.photos.gps!.visible = true;
  shared.photos.gps!.albumId = shared.id;
  const source: GalleryDatabase = {
    private: {
      schemaVersion: 2,
      photos: Object.fromEntries(
        Object.values(album.photos).map(photo => [
          photo.id,
          sharedPhoto(photo),
        ]),
      ),
      albums: { favoritas: storedAlbum(shared) },
    },
    public: { albums: { favoritas: publicAlbum(shared) } },
  };
  const saved = saveSharedAlbum(source, save!.album, save!.edits, false, 10);
  expect(saved.private!.photos!.gps!.location).toBe('Madrid, España');
  expect(saved.public!.albums!.favoritas!.photos.gps!.location).toBe(
    'Madrid, España',
  );
  expect(saved.public!.albums!.viaje).toBeUndefined();
  expect(
    saved.public!.albums!.favoritas!.photos.gps!.originalPath,
  ).toBeUndefined();
});

test('single-photo recovery on a published album waits for Save changes and reacts to manual location edits', async ({
  page,
}) => {
  await page.route(endpoint, route =>
    route.fulfill({ json: madrid, headers: corsHeaders }),
  );
  const album = makeAlbum([makePhoto('single')]);
  album.status = 'published';
  const admin = await mount(page, album);
  const card = admin.locator('.photo-card');
  const location = card.getByLabel('Lugar', { exact: true });
  await location.fill('Manual');
  await expect(
    card.getByRole('button', { name: 'Recuperar ubicación', exact: true }),
  ).toHaveCount(0);
  await location.fill(' ');
  await card
    .getByRole('button', { name: 'Recuperar ubicación', exact: true })
    .click();
  await expect(location).toHaveValue('Madrid, España');
  expect((await readDraft(admin)).photos.single!.takenAt).toBe('2020-02-03');
  expect(await readSaves(admin)).toEqual([]);
  await admin
    .getByRole('button', { name: 'Guardar cambios', exact: true })
    .click();
  await expect(
    admin.getByText('Cambios publicados.', { exact: true }),
  ).toBeVisible();
  const [saved] = await readSaves(admin);
  expect(saved!.published).toBe(true);
  expect(saved!.edits).toHaveLength(1);
  expect(saved!.edits[0]!.previous!.location).toBe('');
  expect(saved!.edits[0]!.photo.location).toBe('Madrid, España');
});
