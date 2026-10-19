import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { isolateEditorialData } from '../src/firebase/editorial-data.ts';

// Offline only. No Firebase SDK, credentials, network, or automatic imports.
const args = process.argv.slice(2);
const input = args[0];
const apply = args.includes('--apply');
const outputIndex = args.indexOf('--output');
const output = outputIndex < 0 ? undefined : args[outputIndex + 1];
if (!input || input.startsWith('--') || (apply && !output))
  throw new Error(
    'Uso: node --import tsx scripts/migrate-editorial-root.mjs export.json [--apply --output migrado.json]',
  );
const raw = await readFile(input, 'utf8');
const source = JSON.parse(raw);
if (!source || typeof source !== 'object' || Array.isArray(source))
  throw new Error(
    'Se necesita una exportación de la raíz de Realtime Database.',
  );
const migrated = isolateEditorialData(source);
console.log(
  JSON.stringify(
    {
      mode: apply ? 'archivo local' : 'simulación; sin escrituras',
      layoutVersion: migrated.editorial.layoutVersion,
      albums: Object.keys(migrated.editorial.private?.albums ?? {}).length,
      photos: Object.keys(migrated.editorial.private?.photos ?? {}).length,
    },
    null,
    2,
  ),
);
if (apply) {
  if (resolve(input) === resolve(output))
    throw new Error('La salida debe ser distinta de la exportación original.');
  await writeFile(`${input}.backup-${Date.now()}.json`, raw, {
    flag: 'wx',
    mode: 0o600,
  });
  // A multi-location update, never a root replacement: live likes are untouched.
  const patch = { editorial: migrated.editorial, private: null, public: null };
  await writeFile(output, JSON.stringify(patch, null, 2) + '\n', {
    flag: 'wx',
    mode: 0o600,
  });
  console.log(
    'Respaldo y exportación migrada guardados localmente. No se modificó Firebase.',
  );
}
