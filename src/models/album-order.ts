import type { Album } from './gallery.js';

export type AlbumSortOrder = 'date-desc' | 'date-asc';

const tripDate = (value: string): number => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return NaN;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.valueOf()) &&
    date.toISOString().slice(0, 10) === value
    ? date.valueOf()
    : NaN;
};

export const sortAlbums = (
  albums: readonly Album[],
  order: AlbumSortOrder = 'date-desc',
): Album[] =>
  [...albums].sort((left, right) => {
    const leftDate = tripDate(left.startDate);
    const rightDate = tripDate(right.startDate);
    const leftValid = Number.isFinite(leftDate);
    const rightValid = Number.isFinite(rightDate);
    if (leftValid !== rightValid) return leftValid ? -1 : 1;
    if (leftValid && leftDate !== rightDate)
      return order === 'date-asc' ? leftDate - rightDate : rightDate - leftDate;
    return (
      left.title.localeCompare(right.title, 'es') ||
      left.id.localeCompare(right.id)
    );
  });
