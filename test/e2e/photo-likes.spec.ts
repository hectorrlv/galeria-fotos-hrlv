import { isolateEditorialData } from '../../src/firebase/editorial-data.js';
import { expect, test, type Page } from '@playwright/test';
import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  connectDatabaseEmulator,
  getDatabase,
  ref,
  set,
  update,
  type Database,
} from 'firebase/database';
import { likesSeed } from '../fixtures/photo-likes.js';

const databaseAddress = process.env.FIREBASE_DATABASE_EMULATOR_HOST;
const authAddress = process.env.FIREBASE_AUTH_EMULATOR_HOST;
const localEmulators = [databaseAddress, authAddress].every(
  address =>
    address && ['127.0.0.1', 'localhost'].includes(address.split(':')[0]!),
);
test.skip(
  !localEmulators,
  'Ejecutar con playwright.likes.config.ts y emuladores locales.',
);
let app: FirebaseApp;
let database: Database;

test.beforeAll(() => {
  if (!localEmulators) return;
  app = initializeApp(
    {
      projectId: 'demo-gallery-likes',
      databaseURL: 'https://demo-gallery-likes-default-rtdb.firebaseio.com',
    },
    `likes-browser-${test.info().project.name}`,
  );
  database = getDatabase(app);
  const [host, port] = databaseAddress!.split(':');
  connectDatabaseEmulator(database, host!, Number(port), {
    mockUserToken: { sub: 'tt6Vtlpd7rfbX8F9ZSj2yqTyJTV2' },
  });
});
test.beforeEach(async () => {
  if (localEmulators)
    await set(ref(database), isolateEditorialData(likesSeed()));
});
test.afterAll(async () => {
  if (app) await deleteApp(app);
});

const gridLike = (page: Page) =>
  page.locator('album-page .photo-card').first().locator('photo-like');
const identity = async (page: Page) =>
  gridLike(page).evaluate(element => {
    const component = element as HTMLElement & {
      service: { services: { auth: { currentUser: { uid: string } | null } } };
    };
    return component.service.services.auth.currentUser?.uid ?? null;
  });
const visit = async (page: Page) => {
  await page.goto('/album/viaje');
  await expect(
    gridLike(page).getByRole('button', { name: 'Me gusta', exact: true }),
  ).toBeEnabled();
};

test('an open legacy gallery switches to the editorial layout without losing its likes', async ({
  page,
}) => {
  const legacy = likesSeed();
  await set(ref(database), legacy);
  await visit(page);
  const button = gridLike(page).getByRole('button');
  await button.click();
  await expect(button).toBeEnabled();
  await expect(button).toHaveText('1');
  const uid = await identity(page);
  await update(ref(database), {
    editorial: isolateEditorialData(legacy).editorial,
    private: null,
    public: null,
  });
  await expect(
    page.getByRole('button', { name: 'Abrir fotografía 1: Paisaje p' }),
  ).toBeVisible();
  await expect(button).toHaveAttribute('aria-pressed', 'true');
  await button.click();
  await expect(button).toHaveText('0');
  await expect(button).toBeEnabled();
  await page.reload();
  await expect(button).toBeEnabled();
  await expect(button).toHaveAttribute('aria-pressed', 'false');
  expect(await identity(page)).toBe(uid);
});

test('shares grid/viewer state and persists the identity and like through reload and other albums', async ({
  page,
}, testInfo) => {
  await visit(page);
  expect(await identity(page)).toBeNull();
  await expect(gridLike(page).getByRole('button')).toHaveText('0');
  const button = gridLike(page).getByRole('button');
  const box = await button.boundingBox();
  expect(box!.width).toBeGreaterThanOrEqual(44);
  expect(box!.height).toBeGreaterThanOrEqual(44);
  await button.click();
  await expect(button).toHaveAttribute('aria-pressed', 'true');
  await expect(button).toBeEnabled();
  const uid = await identity(page);
  expect(uid).toBeTruthy();
  await expect(page.locator('photo-viewer')).not.toHaveAttribute('open');
  await page
    .getByRole('button', { name: 'Abrir fotografía 1: Paisaje p' })
    .click();
  const viewer = page.locator('photo-viewer');
  const viewerLike = viewer.locator('photo-like').getByRole('button');
  await expect(viewerLike).toHaveAttribute('aria-pressed', 'true');
  await expect(viewerLike).toHaveText('1');
  await expect(viewerLike).toBeEnabled();
  await page.screenshot({ path: testInfo.outputPath('likes-viewer.png') });
  await viewerLike.click();
  await expect(button).toHaveAttribute('aria-pressed', 'false');
  await expect(button).toHaveText('0');
  await viewerLike.click();
  await expect(viewerLike).toBeEnabled();
  await page.keyboard.press('ArrowRight');
  await expect(viewerLike).toHaveAttribute('aria-pressed', 'false');
  await expect(viewerLike).toHaveText('0');
  await page.keyboard.press('Escape');
  await page.reload();
  await expect(button).toHaveAttribute('aria-pressed', 'true');
  await expect(button).toHaveText('1');
  expect(await identity(page)).toBe(uid);
  await page.goto('/album/favoritas');
  await expect(gridLike(page).getByRole('button')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(gridLike(page).getByRole('button')).toHaveText('1');
  await gridLike(page).scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('likes-grid.png') });
});

test('synchronizes tabs but permits two independent browser identities', async ({
  page,
  context,
  browser,
}) => {
  await visit(page);
  await gridLike(page).getByRole('button').click();
  await expect(gridLike(page).getByRole('button')).toBeEnabled();
  const uid = await identity(page);
  const tab = await context.newPage();
  const otherContext = await browser.newContext();
  try {
    await tab.goto('/album/viaje');
    await expect(gridLike(tab).getByRole('button')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(await identity(tab)).toBe(uid);
    const other = await otherContext.newPage();
    await other.goto('http://127.0.0.1:8017/album/viaje');
    await expect(gridLike(other).getByRole('button')).toBeEnabled();
    await expect(gridLike(other).getByRole('button')).toHaveText('1');
    await expect(gridLike(other).getByRole('button')).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    await gridLike(other).getByRole('button').click();
    await expect(gridLike(page).getByRole('button')).toHaveText('2');
    expect(await identity(other)).not.toBe(uid);
    await gridLike(tab).getByRole('button').click();
    await expect(gridLike(page).getByRole('button')).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    await expect(gridLike(page).getByRole('button')).toHaveText('1');
    await expect(gridLike(other).getByRole('button')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  } finally {
    await otherContext.close();
    await tab.close();
  }
});

test('shows the admin login form after an anonymous visitor has liked a photo', async ({
  page,
}) => {
  await visit(page);
  await gridLike(page).getByRole('button').click();
  await expect(gridLike(page).getByRole('button')).toBeEnabled();
  await page.goto('/admin');
  await expect(page.getByRole('button', { name: /Google/ })).toBeVisible();
  await expect(
    page.getByRole('textbox', { name: 'Correo', exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/no está autorizada/)).toHaveCount(0);
});

test('disables both controls while saving and restores confirmed state on a rejected vote', async ({
  page,
}) => {
  await visit(page);
  await page
    .getByRole('button', { name: 'Abrir fotografía 1: Paisaje p' })
    .click();
  const viewer = page.locator('photo-viewer');
  await gridLike(page).evaluate(element => {
    const component = element as HTMLElement & { albumId: string };
    component.albumId = 'unpublished-album';
  });
  await viewer.locator('photo-like').evaluate(element => {
    const component = element as HTMLElement & { albumId: string };
    component.albumId = 'unpublished-album';
  });
  let release = () => undefined as void;
  const signup = new Promise<void>(resolve => {
    release = resolve;
  });
  await page.route(/accounts:signUp/, async route => {
    await signup;
    await route.continue();
  });
  const viewerButton = viewer.locator('photo-like').getByRole('button');
  await viewerButton.click();
  try {
    await expect(viewerButton).toBeDisabled();
    await expect(gridLike(page).getByRole('button')).toBeDisabled();
  } finally {
    release();
  }
  await expect(viewer.locator('photo-like').getByRole('status')).toContainText(
    'No se pudo guardar',
  );
  await expect(gridLike(page).getByRole('status')).toContainText(
    'No se pudo guardar',
  );
  await expect(viewerButton).toHaveAttribute('aria-pressed', 'false');
  await expect(viewerButton).toHaveText('0');
  await expect(viewerButton).toBeEnabled();
});
