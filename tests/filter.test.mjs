import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_PREFERENCES, evaluateSeller, shouldKeepSeller, normalizePreferences,
} from '../extension/core/filter.js';

test('el umbral cinco excluye cero y cuatro e incluye cinco y seis', () => {
  for (const reviewCount of [0, 4, 5, 6]) {
    assert.equal(evaluateSeller({ reviewCount }).status, reviewCount < 5 ? 'exclude' : 'match');
    assert.equal(shouldKeepSeller({ reviewCount }), reviewCount >= 5);
  }
});

test('mínimo cero requiere un recuento comprobado y admite cero comprobado', () => {
  const options = { minimumReviews: 0 };
  assert.equal(evaluateSeller({ reviewCount: 0 }, options).status, 'match');
  assert.deepEqual(evaluateSeller({}, options), { status: 'unknown', reasons: ['reviews_unknown'] });
  assert.equal(shouldKeepSeller({}, options), false);
  assert.equal(shouldKeepSeller({}, { ...options, showUnchecked: true }), true);
});

test('ausencia, estrellas y tipos ambiguos no se convierten en recuentos', () => {
  for (const seller of [null, {}, { rating: 5, stars: 5 }, ...['5', -1, 5.5, Infinity, NaN, null]
    .map(reviewCount => ({ reviewCount }))]) {
    assert.deepEqual(evaluateSeller(seller), { status: 'unknown', reasons: ['reviews_unknown'] });
    assert.equal(shouldKeepSeller(seller), false);
  }
});

test('la verificación distingue true, false y desconocido', () => {
  const options = { minimumReviews: 0, verifiedOnly: true };
  assert.equal(evaluateSeller({ reviewCount: 0, verified: true }, options).status, 'match');
  assert.deepEqual(evaluateSeller({ reviewCount: 0, verified: false }, options), {
    status: 'exclude', reasons: ['not_verified'],
  });
  for (const verified of [null, undefined, 'true', 'false', 1]) {
    assert.deepEqual(evaluateSeller({ reviewCount: 0, verified }, options), {
      status: 'unknown', reasons: ['verification_unknown'],
    });
  }
  assert.equal(shouldKeepSeller({ reviewCount: 5, verified: false }), true);
});

test('un incumplimiento conocido excluye aunque falte otro dato', () => {
  const options = { minimumReviews: 5, verifiedOnly: true, showUnchecked: true };
  assert.equal(shouldKeepSeller({ reviewCount: 2, verified: null }, options), false);
  assert.equal(shouldKeepSeller({ reviewCount: null, verified: false }, options), false);
});

test('desactivar el filtro conserva todos los vendedores y su clasificación sigue disponible', () => {
  const options = { enabled: false, minimumReviews: 5, verifiedOnly: true };
  assert.equal(shouldKeepSeller(null, options), true);
  assert.equal(shouldKeepSeller({ reviewCount: 0, verified: false }, options), true);
  assert.equal(evaluateSeller(null, options).status, 'unknown');
});

test('mostrar sin comprobar solo amplía unknown, nunca un incumplimiento conocido', () => {
  const options = { showUnchecked: true };
  assert.equal(shouldKeepSeller(null, options), true);
  assert.equal(shouldKeepSeller({ reviewCount: 4 }, options), false);
  assert.equal(shouldKeepSeller({ reviewCount: 5 }, options), true);
});

test('preferencias por defecto y datos corruptos mantienen el modo estricto', () => {
  const expected = { enabled: true, minimumReviews: 5, verifiedOnly: false, showUnchecked: false };
  assert.deepEqual(DEFAULT_PREFERENCES, expected);
  assert.deepEqual(normalizePreferences(null), expected);
  assert.deepEqual(normalizePreferences({
    enabled: 'false', minimumReviews: -1, verifiedOnly: 'true', showUnchecked: 'true',
  }), expected);
  assert.deepEqual(normalizePreferences({ enabled: false, minimumReviews: 0, verifiedOnly: true,
    showUnchecked: true }), { enabled: false, minimumReviews: 0, verifiedOnly: true, showUnchecked: true });
});
