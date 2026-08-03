import { expect, test } from '@playwright/test';

test('loads the home page and exposes accessible navigation', async ({
  page,
}) => {
  await page.goto('/');

  await expect(
    page.getByRole('heading', { name: 'Viajes, paseos y momentos.' }),
  ).toBeVisible();
  await expect(
    page.getByRole('navigation', { name: 'Navegación principal' }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Inicio' })).toBeVisible();
});

test('navigates between public routes', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Álbumes' }).click();

  await expect(page).toHaveURL(/\/albumes$/);
  await expect(page.getByRole('heading', { name: 'Álbumes' })).toBeVisible();
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

  await expect(page.getByRole('link', { name: 'Galería HRLV' })).toBeFocused();
});
