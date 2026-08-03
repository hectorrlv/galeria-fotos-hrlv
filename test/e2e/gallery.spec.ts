import { expect, test } from '@playwright/test';

test('loads the home page and exposes accessible navigation', async ({
  page,
}) => {
  await page.goto('/');

  await expect(
    page.getByRole('heading', { name: 'Viajes, paseos y momentos.' }),
  ).toBeVisible();
  if ((page.viewportSize()?.width ?? 0) <= 672) {
    await expect(page.locator('details > summary')).toBeVisible();
  } else {
    await expect(
      page.getByRole('navigation', { name: 'Navegación principal' }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Inicio' })).toBeVisible();
  }
});

test('navigates between public routes', async ({ page }) => {
  await page.goto('/');
  if ((page.viewportSize()?.width ?? 0) <= 672) {
    await page.locator('details > summary').click();
    await page
      .getByRole('navigation', { name: 'Navegación móvil' })
      .getByRole('link', { name: 'Álbumes' })
      .click();
  } else {
    await page
      .getByRole('navigation', { name: 'Navegación principal' })
      .getByRole('link', { name: 'Álbumes' })
      .click();
  }

  await expect(page).toHaveURL(/\/albumes$/);
  await expect(
    page.getByRole('heading', { name: 'Álbumes', exact: true }),
  ).toBeVisible();
});

test('restores a direct internal route', async ({ page }) => {
  await page.goto('/album/viaje-de-prueba');

  await expect(
    page.getByRole('heading', { name: 'viaje-de-prueba' }),
  ).toBeVisible();
});

test('renders a not-found page for unknown routes', async ({ page }) => {
  await page.goto('/ruta-inexistente');

  await expect(
    page.getByRole('heading', { name: 'Página no encontrada' }),
  ).toBeVisible();
});

test('runs in demo mode without Firebase configuration or browser errors', async ({
  page,
}) => {
  const browserErrors: string[] = [];
  page.on('pageerror', error => browserErrors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') browserErrors.push(message.text());
  });

  await page.goto('/admin');

  await expect(page.getByRole('status')).toContainText('Modo de demostración');
  await expect(
    page.getByText('Firebase todavía no está configurado.'),
  ).toBeVisible();
  expect(browserErrors).toEqual([]);
});

test('makes the first navigation link keyboard reachable', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');

  await expect(
    page.getByRole('link', { name: 'Saltar al contenido' }),
  ).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Galería HRLV' })).toBeFocused();
});

test('shows the public empty state before the first album is published', async ({
  page,
}) => {
  await page.goto('/albumes');

  await expect(
    page.getByRole('heading', { name: 'No hay álbumes para estos filtros' }),
  ).toBeVisible();
  await expect(page.getByLabel('Año')).toBeVisible();
  await expect(page.getByLabel('País')).toBeVisible();
  await expect(page.getByLabel('Tipo de paseo')).toBeVisible();
});

test('keeps photo viewer controls and a long caption inside the viewport', async ({
  page,
}) => {
  await page.goto('/');
  await page.evaluate(() => {
    document.body.append(document.createElement('photo-viewer'));
  });
  const viewer = page.locator('photo-viewer');
  await viewer.evaluate((element: HTMLElement & Record<string, unknown>) => {
    element['photos'] = [
      {
        id: 'photo',
        albumId: 'album',
        fileName: 'photo.jpg',
        width: 1600,
        height: 1200,
        caption:
          'Un pie de foto deliberadamente largo para comprobar que el texto se ajusta y permanece visible dentro de una pantalla pequeña sin desplazar los controles de navegación.',
        location: 'Ciudad de México',
        takenAt: '2026-08-03',
        altText: 'Fotografía de prueba',
        visible: true,
        publicPaths: [],
        urls: {
          thumbnail:
            'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="4" height="3"/>',
          grid: '',
          viewer:
            'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1200"><rect width="100%25" height="100%25" fill="gray"/></svg>',
        },
        credit: {
          position: 'auto',
          color: 'auto',
          opacity: 0.8,
          scale: 1,
          margin: 0.02,
        },
      },
    ];
    element['open'] = true;
  });
  await expect(viewer).toHaveAttribute('open');

  const bounds = await viewer.evaluate(element => {
    const viewport = element.shadowRoot?.querySelector('.viewer');
    const image = element.shadowRoot?.querySelector('img');
    const caption = element.shadowRoot?.querySelector('.caption');
    const targets = [
      element.shadowRoot?.querySelector('.close'),
      element.shadowRoot?.querySelector('.previous'),
      element.shadowRoot?.querySelector('.next'),
      caption,
    ];
    return {
      viewport: viewport?.getBoundingClientRect().toJSON(),
      image: image?.getBoundingClientRect().toJSON(),
      caption: caption?.getBoundingClientRect().toJSON(),
      targets: targets.map(target => target?.getBoundingClientRect().toJSON()),
    };
  });

  expect(bounds.viewport?.left).toBeGreaterThanOrEqual(0);
  expect(bounds.viewport?.top).toBeGreaterThanOrEqual(0);
  expect(bounds.viewport?.right).toBeLessThanOrEqual(
    page.viewportSize()?.width ?? 0,
  );
  expect(bounds.viewport?.bottom).toBeLessThanOrEqual(
    page.viewportSize()?.height ?? 0,
  );
  expect(bounds.image?.bottom).toBeLessThanOrEqual(bounds.caption?.top ?? 0);
  for (const target of bounds.targets) {
    expect(target?.left).toBeGreaterThanOrEqual(0);
    expect(target?.top).toBeGreaterThanOrEqual(0);
    expect(target?.right).toBeLessThanOrEqual(page.viewportSize()?.width ?? 0);
    expect(target?.bottom).toBeLessThanOrEqual(
      page.viewportSize()?.height ?? 0,
    );
  }
});

test('keeps album and photo date inputs inside the mobile editor', async ({
  page,
}) => {
  test.skip((page.viewportSize()?.width ?? 0) > 608, 'Mobile layout only');
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const admin = document.createElement('admin-page') as HTMLElement & {
      updateComplete?: Promise<unknown>;
    };
    admin.style.display = 'block';
    admin.style.width = '100%';
    document.body.append(admin);
    await admin.updateComplete;

    const fixtures = ['field-grid', 'photo-fields'].map(className => {
      const grid = document.createElement('div');
      grid.className = className;
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'date';
      input.value = '2026-08-03';
      label.append(input);
      grid.append(label);
      admin.shadowRoot?.append(grid);
      return {
        grid: grid.getBoundingClientRect().toJSON(),
        input: input.getBoundingClientRect().toJSON(),
      };
    });
    admin.remove();
    return fixtures;
  });

  for (const fixture of result) {
    expect(fixture.input.left).toBeGreaterThanOrEqual(fixture.grid.left);
    expect(fixture.input.right).toBeLessThanOrEqual(fixture.grid.right);
  }
});

test('stages regenerated credit privately and publishes it when changes are saved', async ({
  page,
}) => {
  await page.goto('/');
  await page.evaluate(async () => {
    const admin = document.createElement('admin-page') as HTMLElement &
      Record<string, unknown> & { updateComplete?: Promise<unknown> };
    document.body.append(admin);
    await admin.updateComplete;

    const credit = {
      position: 'auto',
      color: 'auto',
      opacity: 0.8,
      scale: 1,
      margin: 0.02,
    };
    const photo = {
      id: 'photo',
      albumId: 'published-album',
      fileName: 'photo.jpg',
      width: 1200,
      height: 800,
      caption: 'Pie actualizado',
      location: 'Ciudad de México',
      takenAt: '2026-08-03',
      altText: 'Fotografía publicada',
      visible: true,
      originalPath: 'originals/published-album/photo/original.jpg',
      publicPaths: ['public/published-album/photo/old.webp'],
      urls: {
        thumbnail: 'https://example.com/old-thumbnail.webp',
        grid: 'https://example.com/old-grid.webp',
        viewer: 'https://example.com/old-viewer.webp',
      },
      credit,
    };
    const album = {
      id: 'published-album',
      slug: 'album-publicado',
      title: 'Álbum publicado',
      description: 'Relato completo del viaje.',
      country: 'México',
      location: 'Ciudad de México',
      startDate: '2026-08-03',
      endDate: '2026-08-03',
      category: 'Paseo',
      coverPhotoId: 'photo',
      photoOrder: ['photo'],
      photos: { photo },
      status: 'published',
      featured: false,
      createdAt: 100,
      updatedAt: 200,
      publishedAt: 150,
    };
    const calls: string[] = [];
    admin['draft'] = album;
    admin['albums'] = [album];
    admin['site'] = {
      galleryName: 'Galería HRLV',
      introduction: '',
      creditText: '@HRLV',
      about: '',
      instagramUrl: '',
      xUrl: '',
      defaultCredit: credit,
    };
    admin['repository'] = {
      getOriginalFile: async () => new File(['original'], 'photo.jpg'),
      uploadVariants: async () => ({
        paths: ['public/published-album/photo/new.webp'],
        urls: {
          thumbnail: 'https://example.com/new-thumbnail.webp',
          grid: 'https://example.com/new-grid.webp',
          viewer: 'https://example.com/new-viewer.webp',
        },
      }),
      saveAlbum: async () => {
        calls.push('private');
      },
      publishAlbum: async () => {
        calls.push('public');
      },
      deletePaths: async () => undefined,
    };
    admin['processor'] = {
      process: async () => ({
        originalWidth: 1200,
        originalHeight: 800,
        credit,
        variants: [],
      }),
    };
    admin['testCalls'] = calls;
    admin['render'] = () =>
      (admin['renderAlbumEditor'] as (value: typeof album) => unknown).call(
        admin,
        album,
      );
    (admin['requestUpdate'] as () => void).call(admin);
    await admin.updateComplete;
  });

  const admin = page.locator('admin-page');
  await expect(
    admin.getByRole('button', { name: 'Guardar cambios' }),
  ).toBeVisible();
  await admin.getByRole('button', { name: 'Regenerar crédito' }).click();
  await expect(
    admin.getByText(
      'Crédito regenerado. Guarda los cambios para actualizar el álbum publicado.',
    ),
  ).toBeVisible();
  await expect
    .poll(() =>
      admin.evaluate(
        element =>
          (element as HTMLElement & Record<string, unknown>)['testCalls'],
      ),
    )
    .toEqual(['private']);

  await admin.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect
    .poll(() =>
      admin.evaluate(
        element =>
          (element as HTMLElement & Record<string, unknown>)['testCalls'],
      ),
    )
    .toEqual(['private', 'public']);
});
