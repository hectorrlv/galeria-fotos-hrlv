import { expect, test, type Page } from '@playwright/test';

const mountEmptyDraft = async (page: Page, rejectDeletion = false) => {
  await page.goto('/');
  await page.evaluate(async reject => {
    const admin = document.createElement('admin-page') as HTMLElement &
      Record<string, unknown> & { updateComplete?: Promise<unknown> };
    document.body.append(admin);
    await admin.updateComplete;
    (admin['createAlbum'] as () => void).call(admin);
    const album = admin['draft'] as {
      id: string;
      title: string;
      slug: string;
      photos: Record<string, unknown>;
      photoOrder: string[];
    };
    album.id = 'empty-draft';
    album.title = 'Viaje sin fotos';
    album.slug = 'viaje-sin-fotos';
    admin['albums'] = [structuredClone(album)];
    admin['draft'] = null;
    const calls: unknown[] = [];
    admin['testCalls'] = calls;
    admin['repository'] = {
      saveAlbum: async (updated: typeof album) => {
        calls.push({ saved: structuredClone(updated) });
        return structuredClone(updated);
      },
      deleteEmptyDraftAlbum: async (id: string) => {
        calls.push({ deleted: id });
        if (reject) throw new Error('No se pudo eliminar el borrador.');
      },
    };
    admin['render'] = () => [
      (admin['renderMessages'] as () => unknown).call(admin),
      (admin['renderAlbumWorkspace'] as () => unknown).call(admin),
    ];
    (admin['requestUpdate'] as () => void).call(admin);
    await admin.updateComplete;
  }, rejectDeletion);
  await page.getByRole('button', { name: 'Viaje sin fotos Borrador' }).click();
  return page.locator('admin-page');
};

test('selects and saves an empty draft through the album editor', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const admin = await mountEmptyDraft(page);
  await expect(
    admin.getByRole('heading', { name: 'Fotografías', exact: true }),
  ).toBeVisible();
  await expect(
    admin.getByText('Agregar fotografías', { exact: true }),
  ).toBeVisible();
  await admin.getByLabel('Título', { exact: true }).fill('Viaje recuperado');
  await admin.getByRole('button', { name: 'Guardar borrador' }).click();
  await expect(admin.getByText('Borrador guardado.')).toBeVisible();
  const calls = await admin.evaluate(
    element => (element as HTMLElement & Record<string, unknown>)['testCalls'],
  );
  expect(calls).toMatchObject([
    { saved: { title: 'Viaje recuperado', photos: {}, photoOrder: [] } },
  ]);
  await admin.getByRole('button', { name: 'Publicar', exact: true }).click();
  await expect(admin.getByRole('alert')).toContainText(
    'Agrega al menos una fotografía visible.',
  );
  expect(errors).toEqual([]);
});

test('keeps a draft when deletion is cancelled and removes it after confirmation', async ({
  page,
}) => {
  const admin = await mountEmptyDraft(page);
  page.once('dialog', dialog => dialog.dismiss());
  await admin.getByRole('button', { name: 'Eliminar borrador' }).click();
  await expect(admin.getByLabel('Título', { exact: true })).toHaveValue(
    'Viaje sin fotos',
  );
  expect(
    await admin.evaluate(
      element =>
        (element as HTMLElement & Record<string, unknown>)['testCalls'],
    ),
  ).toEqual([]);

  page.once('dialog', dialog => dialog.accept());
  await admin.getByRole('button', { name: 'Eliminar borrador' }).click();
  await expect(admin.getByText('Borrador eliminado.')).toBeVisible();
  await expect(admin.getByText('Aún no hay álbumes.')).toBeVisible();
  await expect(
    admin.getByRole('heading', { name: 'Selecciona o crea un álbum' }),
  ).toBeVisible();
  expect(
    await admin.evaluate(
      element =>
        (element as HTMLElement & Record<string, unknown>)['testCalls'],
    ),
  ).toEqual([{ deleted: 'empty-draft' }]);
});

test('keeps the selected draft and shows an error when deletion fails', async ({
  page,
}) => {
  const admin = await mountEmptyDraft(page, true);
  page.once('dialog', dialog => dialog.accept());
  await admin.getByRole('button', { name: 'Eliminar borrador' }).click();
  await expect(admin.getByRole('alert')).toContainText(
    'No se pudo eliminar el borrador.',
  );
  await expect(admin.getByLabel('Título', { exact: true })).toHaveValue(
    'Viaje sin fotos',
  );
  await expect(
    admin.getByRole('button', { name: 'Eliminar borrador' }),
  ).toBeEnabled();
  await expect(
    admin.getByRole('button', { name: 'Viaje sin fotos Borrador' }),
  ).toBeVisible();
});
