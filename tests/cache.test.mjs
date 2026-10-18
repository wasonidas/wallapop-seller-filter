import test from 'node:test';
import assert from 'node:assert/strict';
import { CACHE_STORAGE_KEY, SellerCache } from '../extension/core/cache.js';

function fixture(options = {}) {
  let time = 100_000;
  let stored;
  let writes = 0;
  const adapter = {
    get: async key => { assert.equal(key, CACHE_STORAGE_KEY); return structuredClone(stored); },
    set: async (key, value) => {
      assert.equal(key, CACHE_STORAGE_KEY);
      stored = structuredClone(value);
      writes++;
    },
  };
  const cache = new SellerCache(adapter, { now: () => time, ttlMs: 1000, ...options });
  const record = (sellerId = 'seller-a', extra = {}) => ({
    sellerId, reviewCount: 5, verified: null, checkedAt: time, source: '/item/example', ...extra,
  });
  return { cache, adapter, record, now: () => time, advance: ms => { time += ms; },
    stored: () => stored, writes: () => writes };
}

test('guarda solo datos necesarios, mantiene triestado y permite cero comprobado', async () => {
  const f = fixture();
  for (const [index, verified] of [true, false, null].entries()) {
    const record = f.record(`seller-${index}`, { reviewCount: 0, verified,
      email: 'private@example.invalid', description: 'irrelevante' });
    await f.cache.putSeller(record);
    const saved = await f.cache.getSeller(record.sellerId);
    assert.deepEqual(saved, { sellerId: record.sellerId, reviewCount: 0, verified,
      checkedAt: f.now(), source: '/item/example' });
    assert.equal('email' in saved, false);
  }
  const copy = await f.cache.getSeller('seller-0');
  copy.reviewCount = 900;
  assert.equal((await f.cache.getSeller('seller-0')).reviewCount, 0);
});

test('un TTL vence exactamente en su límite y no se amplía al leer', async () => {
  const f = fixture();
  await f.cache.putSeller(f.record());
  await f.cache.linkItem('/item/a?search=private#fragment', 'seller-a');
  f.advance(999);
  assert.equal((await f.cache.getSeller('seller-a')).reviewCount, 5);
  assert.equal(await f.cache.getItem('/item/a'), 'seller-a');
  assert.deepEqual(f.stored().items, [{ path: '/item/a', sellerId: 'seller-a', linkedAt: 100_000 }]);
  f.advance(1);
  assert.equal(await f.cache.getSeller('seller-a'), null);
  assert.equal(await f.cache.getItem('/item/a'), null);
  assert.equal(f.stored().sellers.length, 0);
  assert.equal(f.stored().items.length, 0);
});

test('persiste entre instancias y elimina duplicados sin perder escrituras concurrentes', async () => {
  const f = fixture();
  const record = f.record();
  await Promise.all([f.cache.putSeller(record), f.cache.putSeller(record),
    f.cache.linkItem('/item/a', 'seller-a'), f.cache.linkItem('/item/a', 'seller-a'),
    f.cache.putSeller(f.record('seller-b'))]);
  assert.equal(f.writes(), 3);
  assert.equal(f.stored().sellers.length, 2);
  assert.equal(f.stored().items.length, 1);
  const restored = new SellerCache(f.adapter, { now: f.now, ttlMs: 1000 });
  assert.deepEqual(await restored.getSeller('seller-a'), record);
  assert.equal(await restored.getItem('/item/a'), 'seller-a');
});

test('al restaurar retira también del disco los registros caducados', async () => {
  const f = fixture();
  await f.cache.putSeller(f.record());
  await f.cache.linkItem('/item/a', 'seller-a');
  f.advance(1000);
  const restored = new SellerCache(f.adapter, { now: f.now, ttlMs: 1000 });
  assert.equal(await restored.getSeller('seller-a'), null);
  assert.equal(await restored.getItem('/item/a'), null);
  assert.deepEqual(f.stored(), { version: 1, sellers: [], items: [] });
});

test('ausencias, estrellas y errores transitorios nunca se guardan como cero', async () => {
  const f = fixture();
  for (const extra of [{ reviewCount: undefined }, { reviewCount: null }, { reviewCount: '5' },
    { reviewCount: -1 }, { reviewCount: 4.5 }, { reviewCount: undefined, stars: 5 },
    { error: 'HTTP 429', reviewCount: 0 }, { status: 'error', reviewCount: 0 },
    { source: '' }, { checkedAt: f.now() + 1 }]) {
    assert.equal(await f.cache.putSeller(f.record('seller-a', extra)), null);
  }
  assert.equal(await f.cache.getSeller('seller-a'), null);
  assert.equal(f.writes(), 0);
});

test('los fallos no sustituyen un resultado conocido por un dato vacío', async () => {
  const f = fixture();
  await f.cache.putSeller(f.record());
  f.advance(100);
  await f.cache.putSeller(f.record('seller-a', { reviewCount: null, error: 'network' }));
  assert.equal((await f.cache.getSeller('seller-a')).reviewCount, 5);
  assert.equal((await f.cache.getSeller('seller-a')).checkedAt, 100_000);
});

test('limita ambas colecciones y conserva vendedores usados recientemente', async () => {
  const f = fixture({ maxEntries: 2 });
  await f.cache.putSeller(f.record('a'));
  await f.cache.putSeller(f.record('b'));
  await f.cache.getSeller('a');
  await f.cache.putSeller(f.record('c'));
  assert.equal(await f.cache.getSeller('b'), null);
  assert.ok(await f.cache.getSeller('a'));
  for (const id of ['a', 'b', 'c']) await f.cache.linkItem(`/item/${id}`, id);
  assert.equal(await f.cache.getItem('/item/a'), null);
  assert.equal(f.stored().items.length, 2);
});

test('rechaza asociaciones ajenas al pathname y permite vaciar toda la caché', async () => {
  const f = fixture();
  assert.equal(await f.cache.linkItem('https://example.invalid/item/a', 'a'), false);
  assert.equal(await f.cache.linkItem('//example.invalid/item/a', 'a'), false);
  await f.cache.putSeller(f.record());
  await f.cache.linkItem('/item/a', 'seller-a');
  await f.cache.clear();
  await f.cache.flush();
  assert.equal(await f.cache.getSeller('seller-a'), null);
  assert.equal(await f.cache.getItem('/item/a'), null);
  assert.deepEqual(f.stored(), { version: 1, sellers: [], items: [] });
});

test('un error de almacenamiento no envenena la cola y flush reintenta persistir', async () => {
  let fail = true;
  let saved;
  const cache = new SellerCache({ get: async () => undefined, set: async (_key, value) => {
    if (fail) throw new Error('storage unavailable');
    saved = structuredClone(value);
  } }, { now: () => 100 });
  await assert.rejects(cache.putSeller({ sellerId: 'a', reviewCount: 5, verified: true,
    checkedAt: 100, source: '/item/a' }), /storage unavailable/u);
  fail = false;
  await cache.flush();
  assert.equal(saved.sellers[0].reviewCount, 5);
  assert.equal((await cache.getSeller('a')).verified, true);
});
