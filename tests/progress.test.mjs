import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeResults } from '../extension/core/progress.js';

const checked = verified => ({ status: 'checked', seller: { reviewCount: 6, verified } });

test('regresión de la captura: 53 procesados, 20 cumplen, 30 desconocidos y 3 errores, ninguno nuevo', () => {
  const results = [...Array.from({ length: 20 }, () => checked(true)),
    ...Array.from({ length: 30 }, () => checked(null)),
    ...Array.from({ length: 3 }, () => ({ status: 'error' }))];
  const counts = summarizeResults(results, { minimumReviews: 0, verifiedOnly: true });
  assert.deepEqual(counts, { total: 53, match: 20, excluded: 0, pending: 0,
    unchecked: 0, unknown: 30, errors: 3, identityUnknown: 30, unprocessed: 0, processed: 53 });
});

test('los estados son disjuntos y los pendientes o nuevos aún no están procesados', () => {
  const counts = summarizeResults([undefined, {status:'unprocessed'}, {status:'pending'},
    {status:'unknown'}, {status:'error'}, checked(true), checked(false), checked(null)],
  { minimumReviews: 5, verifiedOnly: true });
  assert.equal(counts.total, 8);
  assert.equal(counts.processed, 5);
  assert.equal(counts.unprocessed, 2);
  assert.equal(counts.match + counts.excluded + counts.pending + counts.unchecked + counts.unknown + counts.errors, counts.total);
});

test('cambiar el filtro reclasifica la identidad sin crear nuevas consultas ni errores', () => {
  const results = [checked(true), checked(null), {status:'error'}, {status:'unknown'}];
  const counts = summarizeResults(results, { minimumReviews: 0, verifiedOnly: false });
  assert.equal(counts.match, 2);
  assert.equal(counts.unknown, 1);
  assert.equal(counts.errors, 1);
  assert.equal(counts.unprocessed, 0);
  assert.equal(counts.identityUnknown, 0);
});
