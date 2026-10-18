import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { itemPath, extractNextData, sellerFromNextData, isAccessChallenge } from '../extension/adapters/wallapop.js';

const { samples } = JSON.parse(readFileSync(new URL('./fixtures/observed-sellers.json', import.meta.url)));
const path = '/item/example-123';
test('esquema observado: contador total, sin confundir estrellas ni otro campo reviews', () => {
  assert.deepEqual(samples.map(s => sellerFromNextData(s, path, 1).reviewCount), [525, 1, 12]);
});
test('identidad: comercial y ausencia desconocidas; particular con evidencia explícita', () => {
  assert.deepEqual(samples.map(s => sellerFromNextData(s, path, 1).verified), [null, null, true]);
  const changed = structuredClone(samples[2]);
  delete changed.props.pageProps.itemSeller.sellerType;
  assert.equal(sellerFromNextData(changed, path).verified, null);
});
test('anuncio y vendedor deben tener el mismo identificador; datos ausentes no son cero', () => {
  const changed = structuredClone(samples[0]);
  changed.props.pageProps.item.userId = 'other';
  assert.equal(sellerFromNextData(changed, path), null);
  changed.props.pageProps.item.userId = 'seller-a';
  delete changed.props.pageProps.itemSeller.stats.counters.reviews;
  assert.equal(sellerFromNextData(changed, path), null);
  for (const invalid of [null, '5', -1, 4.8]) {
    changed.props.pageProps.itemSeller.stats.counters.reviews = invalid;
    assert.equal(sellerFromNextData(changed, path), null);
  }
  changed.props.pageProps.itemSeller.stats.counters.reviews = 0;
  assert.equal(sellerFromNextData(changed, path).reviewCount, 0);
});
test('solo admite URLs de anuncios en el dominio autorizado y elimina query/hash', () => {
  assert.equal(itemPath('/item/example-123?secret=omitted#anchor'), path);
  for (const url of ['https://evil.test/item/a', 'http://es.wallapop.com/item/a', '/search', '/item/a/b', '/item/%2e%2e', '/item/a%2fb', null]) assert.equal(itemPath(url), null);
});
test('JSON embebido se analiza sin ejecutar scripts y soporta orden de atributos', () => {
  const html = `<script type="application/json" id="__NEXT_DATA__">${JSON.stringify(samples[0])}</script><script>throw new Error('no ejecutar')</script>`;
  assert.deepEqual(extractNextData(html), samples[0]);
  assert.equal(extractNextData('<script id="__NEXT_DATA__">bad</script>'), null);
  assert.equal(extractNextData('5 estrellas y 9 reseñas'), null);
  assert.equal(extractNextData('x'.repeat(5_000_001)), null);
  assert.equal(isAccessChallenge('<h1>Request blocked</h1>'), true);
});
