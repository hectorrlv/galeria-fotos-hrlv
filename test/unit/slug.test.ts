import assert from 'node:assert/strict';
import test from 'node:test';
import { slugify } from '../../src/models/slug.js';

test('creates stable URL segments from Spanish titles', () => {
  assert.equal(slugify('México: Verano 2026'), 'mexico-verano-2026');
  assert.equal(slugify('  Peña de Bernal  '), 'pena-de-bernal');
});
