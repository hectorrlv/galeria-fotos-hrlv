import assert from 'node:assert/strict';
import test from 'node:test';
import { isAdminUid } from '../../src/firebase/admin-access.js';

test('recognizes the configured administrator UID', () => {
  assert.equal(isAdminUid('tt6Vtlpd7rfbX8F9ZSj2yqTyJTV2'), true);
});

test('rejects missing and unknown UIDs', () => {
  assert.equal(isAdminUid(undefined), false);
  assert.equal(isAdminUid(null), false);
  assert.equal(isAdminUid('another-user'), false);
});
