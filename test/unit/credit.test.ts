import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveCredit } from '../../src/image-processing/credit.js';

test('selects the quietest high-contrast corner and a readable color', () => {
  const credit = resolveCredit(
    { position: 'auto', color: 'auto', opacity: 0.8, scale: 1, margin: 0.02 },
    [
      { position: 'top-left', luminance: 0.5, variation: 0.3 },
      { position: 'bottom-right', luminance: 0.1, variation: 0.02 },
    ],
  );
  assert.equal(credit.resolvedPosition, 'bottom-right');
  assert.equal(credit.resolvedColor, 'light');
  assert.equal(credit.requiresReview, false);
});
