export const routePaths = {
  home: '/',
  albums: '/albumes',
  about: '/acerca-de',
  admin: '/admin',
} as const;

export interface NavigationItem {
  readonly label: string;
  readonly path: string;
}

export const publicNavigation: readonly NavigationItem[] = [
  { label: 'Inicio', path: routePaths.home },
  { label: 'Álbumes', path: routePaths.albums },
  { label: 'Acerca de', path: routePaths.about },
];

export const albumPath = (slug: string): string =>
  `/album/${encodeURIComponent(slug)}`;
