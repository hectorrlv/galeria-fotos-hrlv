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

test('keeps the photo viewer close control and long caption inside the viewport', async ({
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
    const targets = [element.shadowRoot?.querySelector('.close'), caption];
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
  await expect(viewer).toContainText(
    'Un pie de foto deliberadamente largo para comprobar que el texto se ajusta y permanece visible dentro de una pantalla pequeña sin desplazar los controles de navegación. · Ciudad de México · 3 ago 2026',
  );

  await viewer.evaluate((element: HTMLElement & Record<string, unknown>) => {
    element['photos'] = [
      {
        ...(element['photos'] as Array<Record<string, unknown>>)[0],
        caption: '',
        location: '',
        takenAt: '',
      },
    ];
  });
  await expect(viewer).not.toContainText(' · ');
  await expect(
    viewer.getByRole('button', { name: 'Fotografía anterior' }),
  ).toHaveCount(0);
  await expect(
    viewer.getByRole('button', { name: 'Fotografía siguiente' }),
  ).toHaveCount(0);
});

test('navigates and zooms photos without visible navigation buttons', async ({
  page,
}) => {
  await page.goto('/');
  await page.evaluate(() => {
    document.body.append(document.createElement('photo-viewer'));
  });
  const viewer = page.locator('photo-viewer');
  await viewer.evaluate((element: HTMLElement & Record<string, unknown>) => {
    const photo = {
      id: 'photo',
      albumId: 'album',
      fileName: 'photo.jpg',
      width: 1600,
      height: 1200,
      caption: '',
      location: '',
      takenAt: '',
      altText: 'Fotografía de prueba',
      visible: true,
      publicPaths: [],
      urls: {
        thumbnail: '',
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
    };
    element['photos'] = [photo, { ...photo, id: 'photo-2' }];
    element['open'] = true;
  });

  await page.keyboard.press('ArrowRight');
  await expect(viewer).toContainText('2 / 2');
  await page.keyboard.press('ArrowLeft');
  await expect(viewer).toContainText('1 / 2');

  await viewer.evaluate(
    async (element: HTMLElement & Record<string, unknown>) => {
      const figure = element.shadowRoot?.querySelector('figure') as HTMLElement;
      figure.setPointerCapture = () => undefined;
      const pointerEvent = (x: number) =>
        ({
          pointerId: 1,
          clientX: x,
          clientY: 200,
          currentTarget: figure,
        }) as unknown as PointerEvent;
      (element['handlePointerDown'] as (event: PointerEvent) => void)(
        pointerEvent(200),
      );
      (element['handlePointerCancel'] as (event: PointerEvent) => void)(
        pointerEvent(120),
      );
      await (element['updateComplete'] as Promise<unknown>);
    },
  );
  await expect(viewer).toContainText('1 / 2');

  const image = viewer.locator('img');
  await image.dblclick();
  await expect(image).toHaveAttribute('style', /scale\(2\)/);
  await page.keyboard.press('0');
  await expect(image).toHaveAttribute('style', /scale\(1\)/);

  await viewer.evaluate(
    async (element: HTMLElement & Record<string, unknown>) => {
      const figure = element.shadowRoot?.querySelector('figure') as HTMLElement;
      figure.setPointerCapture = () => undefined;
      const pointerEvent = (pointerId: number, x: number, y: number) =>
        ({
          pointerId,
          clientX: x,
          clientY: y,
          currentTarget: figure,
        }) as unknown as PointerEvent;
      (element['handlePointerDown'] as (event: PointerEvent) => void)(
        pointerEvent(1, 200, 200),
      );
      (element['handlePointerUp'] as (event: PointerEvent) => void)(
        pointerEvent(1, 120, 200),
      );
      await (element['updateComplete'] as Promise<unknown>);
    },
  );
  await expect(viewer).toContainText('2 / 2');

  await image.dblclick();
  await expect(image).toHaveAttribute('style', /scale\(2\)/);
  await page.keyboard.press('ArrowRight');
  await expect(viewer).toContainText('1 / 2');
  await expect(image).toHaveAttribute('style', /scale\(1\)/);

  await viewer.evaluate(
    async (element: HTMLElement & Record<string, unknown>) => {
      const figure = element.shadowRoot?.querySelector('figure') as HTMLElement;
      figure.setPointerCapture = () => undefined;
      const pointerEvent = (pointerId: number, x: number, y: number) =>
        ({
          pointerId,
          clientX: x,
          clientY: y,
          currentTarget: figure,
          preventDefault: () => undefined,
        }) as unknown as PointerEvent;
      const down = element['handlePointerDown'] as (
        event: PointerEvent,
      ) => void;
      const move = element['handlePointerMove'] as (
        event: PointerEvent,
      ) => void;
      const up = element['handlePointerUp'] as (event: PointerEvent) => void;
      down(pointerEvent(1, 100, 100));
      down(pointerEvent(2, 200, 100));
      move(pointerEvent(2, 300, 100));
      up(pointerEvent(2, 300, 100));
      move(pointerEvent(1, 150, 100));
      up(pointerEvent(1, 150, 100));
      await (element['updateComplete'] as Promise<unknown>);
    },
  );
  await expect(image).toHaveAttribute(
    'style',
    /translate\(50px, 0px\) scale\(2\)/,
  );

  await page.keyboard.press('0');
  await image.hover();
  await page.mouse.wheel(0, -100);
  await expect(image).toHaveAttribute('style', /scale\(1\.15\)/);
});

test('releases the page scroll lock when an open viewer is disconnected', async ({
  page,
}) => {
  await page.goto('/');
  const overflow = await page.evaluate(async () => {
    const viewer = document.createElement('photo-viewer') as HTMLElement &
      Record<string, unknown> & { updateComplete?: Promise<unknown> };
    document.body.append(viewer);
    await viewer.updateComplete;
    viewer['photos'] = [
      {
        id: 'photo',
        albumId: 'album',
        fileName: 'photo.jpg',
        width: 4,
        height: 3,
        caption: '',
        location: '',
        takenAt: '',
        altText: 'Fotografía de prueba',
        visible: true,
        publicPaths: [],
        urls: {
          thumbnail: '',
          grid: '',
          viewer:
            'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="4" height="3"/>',
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
    viewer['open'] = true;
    await viewer.updateComplete;
    const locked = document.documentElement.style.overflow;
    viewer.remove();
    return { locked, afterDisconnect: document.documentElement.style.overflow };
  });

  expect(overflow.locked).toBe('hidden');
  expect(overflow.afterDisconnect).toBe('');
});

test('reorders all album photos from the compact mosaic', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const admin = document.createElement('admin-page') as HTMLElement &
      Record<string, unknown> & { updateComplete?: Promise<unknown> };
    document.body.append(admin);
    await admin.updateComplete;

    const photo = (id: string, visible = true) => ({
      id,
      albumId: 'album',
      fileName: `${id}.jpg`,
      width: 1200,
      height: 800,
      caption: '',
      location: '',
      takenAt: '',
      altText: `Foto ${id}`,
      visible,
      publicPaths: [],
      urls: {
        thumbnail:
          'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="4" height="3"/>',
        grid: '',
        viewer: '',
      },
      credit: {
        position: 'auto',
        color: 'auto',
        opacity: 0.8,
        scale: 1,
        margin: 0.02,
      },
    });
    const first = photo('first');
    const hidden = photo('hidden', false);
    const third = photo('third');
    const album = {
      id: 'album',
      slug: 'album',
      title: 'Álbum',
      description: '',
      country: '',
      location: '',
      startDate: '',
      endDate: '',
      category: '',
      coverPhotoId: 'first',
      photoOrder: ['first', 'hidden', 'third'],
      photos: { first, hidden, third },
      status: 'draft',
      featured: false,
      createdAt: 1,
      updatedAt: 1,
      publishedAt: null,
    };
    admin['draft'] = album;
    admin['render'] = () =>
      (admin['renderAlbumEditor'] as (value: typeof album) => unknown).call(
        admin,
        album,
      );
    (admin['requestUpdate'] as () => void).call(admin);
    await admin.updateComplete;

    admin['draggedPhotoId'] = 'third';
    (admin['dropPhoto'] as (targetId: string) => void).call(admin, 'first');
    await admin.updateComplete;

    const root = admin.shadowRoot as ShadowRoot;
    const order = [...root.querySelectorAll<HTMLElement>('.order-photo')].map(
      element => element.getAttribute('aria-label'),
    );
    const cards = [...root.querySelectorAll('.photo-card .hint')].map(
      element => element.textContent,
    );
    admin.remove();
    return { photoOrder: album.photoOrder, order, cards };
  });

  expect(result.photoOrder).toEqual(['third', 'first', 'hidden']);
  expect(result.order).toEqual([
    'Mover fotografía 1: third.jpg',
    'Mover fotografía 2: first.jpg',
    'Mover fotografía 3: hidden.jpg',
  ]);
  expect(result.cards).toEqual([
    '1. third.jpg',
    '2. first.jpg',
    '3. hidden.jpg',
  ]);
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

test('publishes regenerated credit before deleting its old variants', async ({
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
      deletePaths: async () => {
        calls.push('delete-old-variants');
      },
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
    admin.getByText('Crédito regenerado y publicado.'),
  ).toBeVisible();
  await expect
    .poll(() =>
      admin.evaluate(
        element =>
          (element as HTMLElement & Record<string, unknown>)['testCalls'],
      ),
    )
    .toEqual(['public', 'delete-old-variants']);
});

test('publishes an album update before deleting a published photo file', async ({
  page,
}) => {
  await page.goto('/');
  const calls = await page.evaluate(async () => {
    const admin = document.createElement('admin-page') as HTMLElement &
      Record<string, unknown> & { updateComplete?: Promise<unknown> };
    document.body.append(admin);
    await admin.updateComplete;

    const photo = {
      id: 'photo',
      albumId: 'published-album',
      fileName: 'photo.jpg',
      width: 1200,
      height: 800,
      caption: '',
      location: '',
      takenAt: '',
      altText: 'Fotografía publicada',
      visible: true,
      publicPaths: ['public/published-album/photo/viewer.webp'],
      urls: { thumbnail: '', grid: '', viewer: '' },
      credit: {
        position: 'auto',
        color: 'auto',
        opacity: 0.8,
        scale: 1,
        margin: 0.02,
      },
    };
    const album = {
      id: 'published-album',
      slug: 'album-publicado',
      title: 'Álbum publicado',
      description: '',
      country: '',
      location: '',
      startDate: '',
      endDate: '',
      category: '',
      coverPhotoId: 'photo',
      photoOrder: ['photo'],
      photos: { photo },
      status: 'published',
      featured: false,
      createdAt: 1,
      updatedAt: 1,
      publishedAt: 1,
    };
    const events: string[] = [];
    admin['draft'] = album;
    admin['albums'] = [album];
    admin['repository'] = {
      publishAlbum: async (updated: typeof album) => {
        events.push(`public:${Object.keys(updated.photos).join(',')}`);
      },
      deletePhotoFiles: async () => {
        events.push('delete-files');
      },
    };
    const originalConfirm = window.confirm;
    window.confirm = () => true;
    try {
      await (admin['deletePhoto'] as (value: typeof photo) => Promise<void>)(
        photo,
      );
    } finally {
      window.confirm = originalConfirm;
      admin.remove();
    }
    return events;
  });

  expect(calls).toEqual(['public:', 'delete-files']);
});
