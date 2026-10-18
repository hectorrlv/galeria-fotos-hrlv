import { expect, test, type Page } from '@playwright/test';
import {
  createDraftAlbum,
  DEFAULT_CREDIT,
  type Album,
  type GalleryPhoto,
  type PhotoEdit,
  type SharedPhoto,
} from '../../src/models/gallery.js';

const makePhoto = (
  id: string,
  fileName: string,
  color: string,
): SharedPhoto => {
  const image = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="480" height="320"><rect width="480" height="320" fill="${color}"/><path d="M0 240 150 90 260 200 350 100 480 220V320H0Z" fill="#506e63"/><circle cx="350" cy="60" r="30" fill="#f4d58b"/></svg>`)}`;
  return {
    id,
    fileName,
    width: 480,
    height: 320,
    caption: 'Junto al Sena',
    location: 'París',
    takenAt: '2026-10-01',
    altText: fileName,
    originalPath: `originals/photos/${id}/original.jpg`,
    publicPaths: [`public/photos/${id}/old.webp`],
    urls: { thumbnail: image, grid: image, viewer: image },
    credit: { ...DEFAULT_CREDIT },
  };
};
const photos = [
  makePhoto('p', 'paris-sena.jpg', '#bacbd8'),
  makePhoto('q', 'paris-torre.jpg', '#d3c4ae'),
  makePhoto('r', 'bosque.jpg', '#b9c9ac'),
  makePhoto('s', 'costa.jpg', '#b3d5d8'),
];
const album = (id: string, title: string, ids: string[]): Album => ({
  ...createDraftAlbum(1),
  id,
  title,
  slug: id,
  description: 'Relato de viaje',
  photoOrder: ids,
  coverPhotoId: ids[0] ?? null,
  photos: Object.fromEntries(
    photos
      .filter(p => ids.includes(p.id))
      .map(p => [p.id, { ...p, albumId: id, visible: true }]),
  ),
});

const mount = async (page: Page, published = false) => {
  await page.goto('/admin');
  const albums = [
    album('viaje', 'Viaje a Francia', ['p']),
    album('favoritas', 'Mis favoritas', ['p', 'q']),
  ];
  if (published) albums[0]!.status = 'published';
  const admin = page.locator('admin-page');
  await admin.evaluate(
    async (element, fixture) => {
      const component = element as HTMLElement &
        Record<string, unknown> & { updateComplete: Promise<unknown> };
      await component.updateComplete;
      const library = Object.fromEntries(
        fixture.photos.map(photo => [photo.id, photo]),
      );
      component['albums'] = fixture.albums;
      component['libraryPhotos'] = fixture.photos;
      (component['selectAlbum'] as (album: Album) => void)(fixture.albums[0]!);
      const calls: string[] = [];
      component['testCalls'] = calls;
      component['site'] = {
        creditText: '@HRLV',
        defaultCredit: fixture.photos[0]!.credit,
      };
      const refresh = (next?: Album) => {
        if (next)
          component['albums'] = (component['albums'] as Album[]).map(item =>
            item.id === next.id ? structuredClone(next) : item,
          );
        component['libraryPhotos'] = Object.values(library);
        (component['requestUpdate'] as () => void).call(component);
      };
      component['repository'] = {
        associatePhotos: async (value: Album, ids: string[]) => {
          calls.push(`associate:${ids.join(',')}`);
          const next = structuredClone(value);
          for (const id of ids) {
            if (next.photos[id]) continue;
            next.photos[id] = {
              ...library[id]!,
              albumId: value.id,
              visible: true,
            };
            next.photoOrder.push(id);
          }
          refresh(next);
          return next;
        },
        removeAlbumPhotos: async (value: Album, ids: string[]) => {
          calls.push(`remove:${ids.join(',')}`);
          const next = structuredClone(value);
          for (const id of ids) delete next.photos[id];
          next.photoOrder = next.photoOrder.filter(id => !ids.includes(id));
          next.coverPhotoId = next.photoOrder[0] ?? null;
          refresh(next);
          return next;
        },
        deleteUnusedPhoto: async (id: string) => {
          calls.push(`delete:${id}`);
          delete library[id];
          refresh();
        },
        saveAlbum: async (_value: Album, edits: unknown[]) => {
          calls.push(`save:${edits.length}`);
          component['testEdits'] = edits;
          return structuredClone(_value);
        },
        unpublishAlbum: async (value: Album, edits: PhotoEdit[]) => {
          calls.push('unpublish');
          if (component['rejectUnpublish'])
            throw new Error('No se pudo retirar el álbum.');
          component['testEdits'] = structuredClone(edits);
          const next = { ...structuredClone(value), status: 'draft' as const };
          refresh(next);
          return next;
        },
        savePhoto: async () => {
          calls.push('save-photo');
          if (component['rejectPhotoSave'])
            throw new Error('No se pudo actualizar la fotografía compartida.');
        },
        getOriginalFile: async () => new File(['original'], 'photo.jpg'),
        uploadVariants: async () => ({
          paths: ['public/photos/new.webp'],
          urls: { thumbnail: 'new', grid: 'new', viewer: 'new' },
        }),
        uploadOriginal: async () => 'originals/photos/new.jpg',
        deletePaths: async () => {
          calls.push('delete-old-files');
        },
      };
      component['processor'] = {
        process: async () => ({
          originalWidth: 100,
          originalHeight: 100,
          variants: [],
          credit: fixture.photos[0]!.credit,
        }),
      };
      component['render'] = () => [
        (component['renderMessages'] as () => unknown).call(component),
        (component['renderAlbumWorkspace'] as () => unknown).call(component),
      ];
      refresh();
      await component.updateComplete;
    },
    { albums, photos },
  );
  return admin;
};

const calls = (admin: ReturnType<Page['locator']>) =>
  admin.evaluate(
    element => (element as HTMLElement & Record<string, unknown>)['testCalls'],
  );

test('selects multiple existing photos, disables included photos and fits the dialog to the viewport', async ({
  page,
}, testInfo) => {
  const admin = await mount(page);
  await admin
    .getByRole('button', { name: 'Elegir fotos existentes', exact: true })
    .click();
  const dialog = admin.getByRole('dialog');
  await expect(dialog.getByLabel('paris-sena.jpg')).toBeChecked();
  await expect(dialog.getByLabel('paris-sena.jpg')).toBeDisabled();
  await expect(
    dialog.getByText('Ya incluida en este álbum.', { exact: false }),
  ).toBeVisible();
  const bounds = await dialog.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(
    page.viewportSize()!.width,
  );
  await page.screenshot({ path: testInfo.outputPath('selector.png') });
  await dialog.getByLabel('Buscar por nombre').fill('paris');
  await expect(dialog.locator('.library-card')).toHaveCount(2);
  await dialog.getByLabel('paris-torre.jpg').check();
  await dialog.getByLabel('Buscar por nombre').fill('bosque');
  await dialog.getByLabel('bosque.jpg').check();
  await expect(dialog.getByRole('status')).toHaveText('2 seleccionadas');
  await dialog.getByRole('button', { name: 'Agregar seleccionadas' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(admin.locator('.photo-card')).toHaveCount(3);
  expect(await calls(admin)).toEqual(['associate:q,r']);
  await admin
    .getByRole('button', { name: 'Elegir fotos existentes', exact: true })
    .click();
  await expect(
    admin.getByRole('dialog').getByLabel('bosque.jpg'),
  ).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(admin.getByRole('dialog')).toHaveCount(0);
});

test('removes an album association without deleting files and deletes only library orphans after confirmation', async ({
  page,
}) => {
  const admin = await mount(page);
  page.once('dialog', dialog => dialog.accept());
  await admin.getByRole('button', { name: 'Quitar del álbum' }).click();
  await expect(admin.locator('.photo-card')).toHaveCount(0);
  expect(await calls(admin)).toEqual(['remove:p']);
  await admin
    .getByRole('button', { name: 'Elegir fotos existentes', exact: true })
    .click();
  const dialog = admin.getByRole('dialog');
  const shared = dialog
    .locator('.library-card')
    .filter({ hasText: 'paris-sena.jpg' });
  await expect(shared.getByText('En: Mis favoritas')).toBeVisible();
  await expect(
    shared.getByRole('button', { name: 'Eliminar definitivamente' }),
  ).toHaveCount(0);
  const orphan = dialog
    .locator('.library-card')
    .filter({ hasText: 'bosque.jpg' });
  page.once('dialog', value => value.dismiss());
  await orphan
    .getByRole('button', { name: 'Eliminar definitivamente' })
    .click();
  expect(await calls(admin)).toEqual(['remove:p']);
  page.once('dialog', value => value.accept());
  await orphan
    .getByRole('button', { name: 'Eliminar definitivamente' })
    .click();
  await expect(orphan).toHaveCount(0);
  expect(await calls(admin)).toEqual(['remove:p', 'delete:r']);
});

test('prevents hiding or removing the last visible photo in a published album', async ({
  page,
}) => {
  const admin = await mount(page, true);
  const visible = admin.getByLabel('Visible al publicar');
  await visible.click();
  await expect(visible).toBeChecked();
  await expect(admin.getByRole('alert')).toContainText('Retira el álbum');
  await admin.getByRole('button', { name: 'Quitar del álbum' }).click();
  expect(await calls(admin)).toEqual([]);
});

test('saves shared metadata from a draft and explains which albums are affected', async ({
  page,
}) => {
  const admin = await mount(page);
  await expect(admin.locator('.photo-fields .hint')).toContainText(
    'Viaje a Francia, Mis favoritas',
  );
  await admin
    .getByLabel('Pie de foto', { exact: true })
    .fill('Una tarde en París');
  await admin.getByRole('button', { name: 'Guardar borrador' }).click();
  expect(await calls(admin)).toEqual(['save:1']);
  const edits = await admin.evaluate(
    element => (element as HTMLElement & Record<string, unknown>)['testEdits'],
  );
  expect(edits).toMatchObject([
    {
      photo: { caption: 'Una tarde en París' },
      previous: { caption: 'Junto al Sena' },
    },
  ]);
});

test('withdrawing preserves unsaved shared metadata and resets the edit baseline', async ({
  page,
}) => {
  const admin = await mount(page, true);
  await admin.getByLabel('Pie de foto', { exact: true }).fill('Pie al retirar');
  await admin.getByLabel('Lugar', { exact: true }).fill('Francia');
  await admin.getByLabel('Texto alternativo', { exact: true }).fill('El Sena');
  await admin
    .getByRole('combobox', { name: 'Color', exact: true })
    .selectOption('dark');
  await admin.getByRole('button', { name: 'Retirar', exact: true }).click();
  await expect(
    admin.getByRole('button', { name: 'Guardar borrador' }),
  ).toBeVisible();
  await expect(admin.getByLabel('Pie de foto', { exact: true })).toHaveValue(
    'Pie al retirar',
  );
  const edits = await admin.evaluate(
    element => (element as HTMLElement & Record<string, unknown>)['testEdits'],
  );
  expect(edits).toMatchObject([
    {
      photo: {
        caption: 'Pie al retirar',
        location: 'Francia',
        altText: 'El Sena',
        credit: { color: 'dark' },
      },
      previous: {
        caption: 'Junto al Sena',
        location: 'París',
        credit: { color: 'auto' },
      },
    },
  ]);
  await admin.getByRole('button', { name: 'Guardar borrador' }).click();
  expect(await calls(admin)).toEqual(['unpublish', 'save:0']);
});

test('a failed withdrawal retains the published state and pending shared edits', async ({
  page,
}) => {
  const admin = await mount(page, true);
  await admin
    .getByLabel('Pie de foto', { exact: true })
    .fill('Edición pendiente');
  await admin.evaluate(element => {
    (element as HTMLElement & Record<string, unknown>)['rejectUnpublish'] =
      true;
  });
  await admin.getByRole('button', { name: 'Retirar', exact: true }).click();
  await expect(admin.getByRole('alert')).toContainText('No se pudo retirar');
  await expect(
    admin.getByRole('button', { name: 'Guardar cambios' }),
  ).toBeVisible();
  await expect(admin.getByLabel('Pie de foto', { exact: true })).toHaveValue(
    'Edición pendiente',
  );
});

for (const action of ['regeneratePhoto', 'replacePhoto']) {
  test(`preserves the old files and local photo when ${action} cannot save`, async ({
    page,
  }) => {
    const admin = await mount(page);
    const before = await admin.evaluate(async (element, method) => {
      const component = element as HTMLElement & Record<string, unknown>;
      component['rejectPhotoSave'] = true;
      const photo = (component['draft'] as Album).photos.p!;
      const snapshot = structuredClone(photo);
      const originalConfirm = window.confirm;
      window.confirm = () => true;
      try {
        if (method === 'regeneratePhoto')
          await (component[method] as (photo: GalleryPhoto) => Promise<void>)(
            photo,
          );
        else
          await (
            component[method] as (
              photo: GalleryPhoto,
              event: Event,
            ) => Promise<void>
          )(photo, {
            currentTarget: {
              files: [new File(['new'], 'replacement.jpg')],
              value: '',
            },
          } as unknown as Event);
      } finally {
        window.confirm = originalConfirm;
      }
      return { snapshot, current: photo };
    }, action);
    expect(before.current).toEqual(before.snapshot);
    expect(await calls(admin)).toEqual(['save-photo']);
    await expect(admin.getByRole('alert').first()).toContainText(
      'No se pudo actualizar',
    );
  });
}

test('shows legacy albums in read only mode until migration', async ({
  page,
}) => {
  const admin = await mount(page);
  await admin.evaluate(element => {
    const component = element as HTMLElement & Record<string, unknown>;
    component['libraryWritable'] = false;
    (component['requestUpdate'] as () => void).call(component);
  });
  await expect(
    admin.getByText('La biblioteca necesita migración.', { exact: false }),
  ).toBeVisible();
  await expect(
    admin.getByRole('button', { name: 'Guardar borrador' }),
  ).toBeDisabled();
  await expect(
    admin.getByRole('button', { name: 'Elegir fotos existentes' }),
  ).toBeDisabled();
});
