import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { migrateSharedPhotos } from '../src/firebase/shared-photos.ts';

// Offline only. No Firebase credentials, network requests, or automatic imports.
const args = process.argv.slice(2);
const input = args[0];
const apply = args.includes('--apply');
const outputIndex = args.indexOf('--output');
const output = outputIndex < 0 ? undefined : args[outputIndex + 1];
if (!input || input.startsWith('--') || (apply && !output)) {
  throw new Error(
    'Uso: node --import tsx scripts/migrate-shared-photos.mjs export.json [--apply --output migrado.json]',
  );
}
const raw = await readFile(input, 'utf8');
const source = JSON.parse(raw);
if (
  !source ||
  typeof source !== 'object' ||
  Array.isArray(source) ||
  (!source.private && !source.public)
) {
  throw new Error(
    'Se necesita una exportación de la raíz de Realtime Database.',
  );
}
const migrated = migrateSharedPhotos(source);
console.log(
  JSON.stringify(
    {
      mode: apply ? 'archivo local' : 'simulación; sin escrituras',
      albums: Object.keys(migrated.private?.albums ?? {}).length,
      photos: Object.keys(migrated.private?.photos ?? {}).length,
      schemaVersion: migrated.private.schemaVersion,
    },
    null,
    2,
  ),
);
if (apply) {
  if (resolve(input) === resolve(output))
    throw new Error('La salida debe ser distinta de la exportación original.');
  // Exclusive creation: never overwrite an earlier backup or migration.
  const backup = `${input}.backup-${Date.now()}.json`;
  await writeFile(backup, raw, { flag: 'wx', mode: 0o600 });
  await writeFile(output, JSON.stringify(migrated, null, 2) + '\n', {
    flag: 'wx',
    mode: 0o600,
  });
  console.log(
    'Respaldo y exportación migrada guardados localmente. No se modificó Firebase.',
  );
}
