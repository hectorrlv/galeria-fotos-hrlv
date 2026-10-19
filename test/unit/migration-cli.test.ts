import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { createDraftAlbum } from '../../src/models/gallery.js';
import { likesSeed } from '../fixtures/photo-likes.js';

const script = resolve('scripts/migrate-shared-photos.mjs');
test('migration CLI defaults to a dry run, backs up before conversion and never overwrites files', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'gallery-migration-'));
  try {
    const input = join(folder, 'export.json');
    const output = join(folder, 'migrated.json');
    const album = { ...createDraftAlbum(1), id: 'empty' };
    const original = JSON.stringify({
      private: { albums: { empty: album } },
      public: { site: { galleryName: 'HRLV' } },
    });
    await writeFile(input, original);
    const run = (...args: string[]) =>
      execFileSync(
        process.execPath,
        ['--import', 'tsx', script, input, ...args],
        { encoding: 'utf8', stdio: 'pipe' },
      );
    assert.match(run(), /simulación; sin escrituras/);
    assert.deepEqual(await readdir(folder), ['export.json']);
    assert.match(run('--apply', '--output', output), /No se modificó Firebase/);
    const backup = (await readdir(folder)).find(name =>
      name.includes('.backup-'),
    )!;
    assert.equal(await readFile(join(folder, backup), 'utf8'), original);
    assert.equal(await readFile(input, 'utf8'), original);
    const migrated = JSON.parse(await readFile(output, 'utf8'));
    assert.equal(migrated.private.schemaVersion, 2);
    assert.equal(migrated.public.site.galleryName, 'HRLV');
    assert.throws(() => run('--apply', '--output', output), /EEXIST/);
    assert.throws(() => run('--apply', '--output', input), /distinta/);
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});

test('editorial migration backs up the export and emits only an atomic patch, without overwriting live likes', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'editorial-migration-'));
  try {
    const input = join(folder, 'export.json');
    const output = join(folder, 'patch.json');
    const original = JSON.stringify({
      ...likesSeed(),
      photoLikes: { p: { count: 1 } },
      unrelated: { keep: true },
    });
    await writeFile(input, original);
    const run = (...args: string[]) =>
      execFileSync(
        process.execPath,
        [
          '--import',
          'tsx',
          resolve('scripts/migrate-editorial-root.mjs'),
          input,
          ...args,
        ],
        { encoding: 'utf8', stdio: 'pipe' },
      );
    assert.match(run(), /simulación; sin escrituras/);
    assert.deepEqual(await readdir(folder), ['export.json']);
    assert.match(run('--apply', '--output', output), /No se modificó Firebase/);
    const patch = JSON.parse(await readFile(output, 'utf8'));
    assert.deepEqual(Object.keys(patch).sort(), [
      'editorial',
      'private',
      'public',
    ]);
    assert.equal(patch.editorial.layoutVersion, 1);
    assert.deepEqual(patch.editorial.private, likesSeed().private);
    assert.deepEqual(patch.editorial.public, likesSeed().public);
    assert.equal(patch.private, null);
    assert.equal(patch.public, null);
    const backup = (await readdir(folder)).find(name =>
      name.includes('.backup-'),
    )!;
    assert.equal(await readFile(join(folder, backup), 'utf8'), original);
    assert.equal(await readFile(input, 'utf8'), original);
    assert.throws(() => run('--apply', '--output', output), /EEXIST/);
    assert.throws(() => run('--apply', '--output', input), /distinta/);
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});
