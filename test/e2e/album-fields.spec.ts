import { expect, test, type Page } from '@playwright/test';
import { albumValues } from '../../src/firebase/album-data.js';
import { createDraftAlbum, type Album } from '../../src/models/gallery.js';

const fixture = (id: string, title: string, startDate = ''): Album => ({
  ...createDraftAlbum(1),
  id,
  title,
  slug: id,
  startDate,
  country: 'Francia',
  category: 'Viaje',
});

const trips = [
  { ...fixture('old', 'Viaje antiguo', '2000-01-01'), updatedAt: 999 },
  fixture('recent', 'Viaje reciente', '2026-10-11'),
  fixture('missing', 'Sin fecha'),
  { ...fixture('middle', 'Viaje intermedio', '2020-01-01'), country: 'México' },
];

const screenshotStyle =
  'header { position: static !important; } .mode { visibility: hidden !important; }';

const showPublicAlbums = async (page: Page) => {
  const component = page.locator('albums-page');
  await component.evaluate((element, albums) => {
    const target = element as HTMLElement & Record<string, unknown>;
    target['albums'] = albums;
    target['loading'] = false;
    (target['requestUpdate'] as () => void).call(target);
  }, trips);
  return component;
};

const mountAdmin = async (page: Page, albums: Album[] = []) => {
  await page.goto('/admin');
  const component = page.locator('admin-page');
  await component.evaluate(async (element, values) => {
    const admin = element as HTMLElement &
      Record<string, unknown> & { updateComplete: Promise<unknown> };
    await admin.updateComplete;
    const calls: unknown[] = [];
    admin['testCalls'] = calls;
    admin['albums'] = values;
    admin['repository'] = {
      saveAlbum: async (album: unknown) => calls.push(structuredClone(album)),
    };
    admin['render'] = () => [
      (admin['renderMessages'] as () => unknown).call(admin),
      (admin['renderAlbumWorkspace'] as () => unknown).call(admin),
    ];
    (admin['requestUpdate'] as () => void).call(admin);
    await admin.updateComplete;
  }, albums);
  return component;
};

test('orders public albums by trip date and preserves filters and order in the URL', async ({
  page,
}, testInfo) => {
  await page.goto('/albumes');
  const albums = await showPublicAlbums(page);
  const titles = albums.locator('album-card h2');
  await expect(titles).toHaveText([
    'Viaje reciente',
    'Viaje intermedio',
    'Viaje antiguo',
    'Sin fecha',
  ]);
  await albums.getByLabel('Orden', { exact: true }).selectOption('date-asc');
  await expect(titles).toHaveText([
    'Viaje antiguo',
    'Viaje intermedio',
    'Viaje reciente',
    'Sin fecha',
  ]);
  await albums.getByLabel('País', { exact: true }).selectOption('Francia');
  await albums
    .getByLabel('Tipo de paseo', { exact: true })
    .selectOption('Viaje');
  await albums.getByLabel('Año', { exact: true }).selectOption('2026');
  await expect(titles).toHaveText(['Viaje reciente']);
  const params = new URL(page.url()).searchParams;
  expect(Object.fromEntries(params)).toEqual({
    year: '2026',
    country: 'Francia',
    category: 'Viaje',
    sort: 'date-asc',
  });
  await page.reload();
  await showPublicAlbums(page);
  await expect(albums.getByLabel('Orden', { exact: true })).toHaveValue(
    'date-asc',
  );
  await expect(albums.getByLabel('Año', { exact: true })).toHaveValue('2026');
  await expect(albums.getByLabel('País', { exact: true })).toHaveValue(
    'Francia',
  );
  await expect(albums.getByLabel('Tipo de paseo', { exact: true })).toHaveValue(
    'Viaje',
  );
  await expect(titles).toHaveText(['Viaje reciente']);
  await albums.getByLabel('Orden', { exact: true }).selectOption('date-desc');
  expect(new URL(page.url()).searchParams.has('sort')).toBe(false);
  expect(new URL(page.url()).searchParams.get('country')).toBe('Francia');
  await expect(albums.getByLabel('Orden', { exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await albums.locator('.filters').screenshot({
    path: testInfo.outputPath('albums.png'),
    style: screenshotStyle,
  });
});

test('uses the shared chronological order for recent trips and album navigation while preserving the featured trip', async ({
  page,
}) => {
  const ordered = albumValues(
    Object.fromEntries(
      trips.map(album => [
        album.id,
        {
          ...album,
          status: 'published',
          featured: album.id === 'old',
        },
      ]),
    ),
  );
  await page.goto('/');
  await page.locator('home-page').evaluate((element, albums) => {
    const home = element as HTMLElement & Record<string, unknown>;
    home['albums'] = albums;
    home['loading'] = false;
    (home['requestUpdate'] as () => void).call(home);
  }, ordered);
  await expect(page.locator('home-page h1')).toHaveText('Viaje antiguo');
  await expect(page.locator('home-page album-card h2')).toHaveText([
    'Viaje reciente',
    'Viaje intermedio',
    'Sin fecha',
  ]);
  await page.goto('/album/middle');
  await page.locator('album-page').evaluate((element, albums) => {
    const album = element as HTMLElement & Record<string, unknown>;
    album['albums'] = albums;
    album['loading'] = false;
    (album['requestUpdate'] as () => void).call(album);
  }, ordered);
  await expect(
    page.getByRole('link', { name: '← Viaje antiguo' }),
  ).toHaveAttribute('href', '/album/old');
  await expect(
    page.getByRole('link', { name: 'Viaje reciente →' }),
  ).toHaveAttribute('href', '/album/recent');
});

test('orders the admin list and preserves saved slugs and legacy categories', async ({
  page,
}, testInfo) => {
  const admin = await mountAdmin(
    page,
    trips.map(album => ({
      ...album,
      category: album.id === 'old' ? 'Museos y cultura' : album.category,
    })),
  );
  await expect(admin.locator('.album-list strong')).toHaveText([
    'Viaje reciente',
    'Viaje intermedio',
    'Viaje antiguo',
    'Sin fecha',
  ]);
  await admin.getByLabel('Orden', { exact: true }).selectOption('date-asc');
  await expect(admin.locator('.album-list strong')).toHaveText([
    'Viaje antiguo',
    'Viaje intermedio',
    'Viaje reciente',
    'Sin fecha',
  ]);
  await admin.getByRole('button', { name: 'Viaje antiguo Borrador' }).click();
  const category = admin.getByLabel('Tipo de paseo', { exact: true });
  await expect(category).toHaveValue('Museos y cultura');
  await expect(category.locator('option')).toHaveText([
    'Selecciona un tipo',
    'Museos y cultura (valor anterior)',
    'Viaje',
    'Paseo urbano',
    'Naturaleza',
    'Playa',
    'Excursión',
    'Evento',
    'Otro',
  ]);
  await admin
    .getByLabel('Título', { exact: true })
    .fill('Historia actualizada');
  await expect(admin.getByLabel('URL corta', { exact: true })).toHaveValue(
    'old',
  );
  await admin.getByRole('button', { name: 'Guardar borrador' }).click();
  await expect(admin.getByText('Borrador guardado.')).toBeVisible();
  const calls = await admin.evaluate(
    element => (element as HTMLElement & Record<string, unknown>)['testCalls'],
  );
  expect(calls).toMatchObject([{ slug: 'old', category: 'Museos y cultura' }]);
  await category.selectOption('Excursión');
  await expect(category).toHaveValue('Excursión');
  await expect(
    admin.getByLabel('Lugares del álbum', { exact: true }),
  ).toBeVisible();
  expect(
    await admin.evaluate(element => element.scrollWidth <= window.innerWidth),
  ).toBe(true);
  await admin.locator('.field-grid').screenshot({
    path: testInfo.outputPath('admin.png'),
    style: screenshotStyle,
  });
});

test('generates the full slug while typing and freezes it after the first successful save', async ({
  page,
}) => {
  const admin = await mountAdmin(page);
  await admin.getByRole('button', { name: 'Nuevo', exact: true }).click();
  await admin
    .getByLabel('Título', { exact: true })
    .pressSequentially('París y Versalles');
  await expect(admin.getByLabel('URL corta', { exact: true })).toHaveValue(
    'paris-y-versalles',
  );
  await admin.getByRole('button', { name: 'Guardar borrador' }).click();
  await expect(admin.getByText('Borrador guardado.')).toBeVisible();
  await admin.getByLabel('Título', { exact: true }).fill('Otro título');
  await expect(admin.getByLabel('URL corta', { exact: true })).toHaveValue(
    'paris-y-versalles',
  );
});

test('allows custom slugs, normalizes them on blur and rejects duplicates on save', async ({
  page,
}) => {
  const admin = await mountAdmin(page, [
    fixture('paris-personal', 'Otro viaje'),
  ]);
  await admin.getByRole('button', { name: 'Nuevo', exact: true }).click();
  await admin.getByLabel('Título', { exact: true }).fill('Mi viaje');
  const slug = admin.getByLabel('URL corta', { exact: true });
  await slug.fill('');
  await slug.pressSequentially('París-personal');
  await expect(slug).toHaveValue('París-personal');
  await admin.getByLabel('Título', { exact: true }).fill('Cambio de título');
  await expect(slug).toHaveValue('paris-personal');
  await admin.getByRole('button', { name: 'Guardar borrador' }).click();
  await expect(admin.getByRole('alert')).toContainText(
    'Ya existe un álbum con esta URL corta.',
  );
  expect(
    await admin.evaluate(
      element =>
        (element as HTMLElement & Record<string, unknown>)['testCalls'],
    ),
  ).toEqual([]);
  await slug.fill(' URL única ');
  // Submit directly to also exercise normalization by the save handler.
  await admin
    .locator('form')
    .evaluate(form => (form as HTMLFormElement).requestSubmit());
  await expect(admin.getByText('Borrador guardado.')).toBeVisible();
  await expect(slug).toHaveValue('url-unica');
});

test('leaves new photo locations empty without coordinates and preserves existing locations on replacement', async ({
  page,
}) => {
  const admin = await mountAdmin(page);
  await admin.getByRole('button', { name: 'Nuevo', exact: true }).click();
  await admin.getByLabel('Título', { exact: true }).fill('París y Versalles');
  await admin
    .getByLabel('Lugares del álbum', { exact: true })
    .fill('París y Versalles');
  const result = await admin.evaluate(async element => {
    const component = element as HTMLElement & Record<string, unknown>;
    component['metadataReader'] = {
      read: async (file: File) =>
        file.name.startsWith('gps') ? { location: 'Versalles, Francia' } : {},
    };
    component['processor'] = {
      process: async () => ({
        originalWidth: 100,
        originalHeight: 80,
        variants: [],
        credit: {
          position: 'auto',
          color: 'auto',
          opacity: 0.8,
          scale: 1,
          margin: 0.02,
        },
      }),
    };
    component['repository'] = {
      uploadOriginal: async () => 'originals/test/photo.jpg',
      uploadVariants: async () => ({
        paths: [],
        urls: { thumbnail: '', grid: '', viewer: '' },
      }),
      saveAlbum: async () => undefined,
      deletePaths: async () => undefined,
    };
    const upload = async (...names: string[]) =>
      (component['uploadPhotos'] as (event: Event) => Promise<void>)({
        currentTarget: {
          files: names.map(name => new File(['test'], name)),
          value: '',
        },
      } as unknown as Event);
    await upload('plain.jpg', 'gps.jpg');
    const album = component['draft'] as Album;
    const byName = () =>
      Object.fromEntries(
        Object.values(album.photos).map(photo => [
          photo.fileName,
          photo.location,
        ]),
      );
    const added = byName();
    const gps = Object.values(album.photos).find(
      photo => photo.fileName === 'gps.jpg',
    );
    if (gps) gps.location = 'Lugar escrito a mano';
    await upload('plain.jpg', 'gps.jpg');
    return { added, replaced: byName(), albumLocation: album.location };
  });
  expect(result).toEqual({
    added: { 'plain.jpg': '', 'gps.jpg': 'Versalles, Francia' },
    replaced: { 'plain.jpg': '', 'gps.jpg': 'Lugar escrito a mano' },
    albumLocation: 'París y Versalles',
  });
});
