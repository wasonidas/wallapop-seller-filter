import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const sample = JSON.parse(readFileSync(new URL('./fixtures/observed-sellers.json', import.meta.url))).samples[2];

test('servicio de fondo: caché, cancelación, permisos y barreras de acceso persistentes', async t => {
  const originalFetch = globalThis.fetch;
  const originalChrome = globalThis.chrome;
  const values = {};
  let handler;
  const listeners = [];
  globalThis.chrome = {
    storage: { local: {
      get: async key => ({ [key]: structuredClone(values[key]) }),
      set: async object => { Object.assign(values, structuredClone(object)); },
    } },
    runtime: {
      getURL: path => 'chrome-extension://fixture/' + path,
      onMessage: { addListener: listener => { handler = listener; } },
    },
    tabs: { onRemoved: { addListener: listener => { listeners.push(listener); } } },
  };
  let requests = 0;
  let status = 200;
  let html = `<script id="__NEXT_DATA__">${JSON.stringify(sample)}</script>`;
  globalThis.fetch = async (url, options) => {
    requests++;
    assert.equal(url, 'https://es.wallapop.com/item/fixture-1');
    assert.equal(options.redirect, 'error');
    return new Response(html, { status, headers: { 'content-type': 'text/html', 'retry-after': '0' } });
  };
  await import('../extension/background.js?test-background');
  const sender = { tab: { id: 1, url: 'https://es.wallapop.com/search?keywords=fixture' } };
  const popup = { url: 'chrome-extension://fixture/popup.html' };
  const message = (data, from = sender) => new Promise(resolve => {
    const accepts = handler(data, from, resolve);
    if (!accepts) resolve(undefined);
  });
  const lookup = () => message({ type: 'LOOKUP', path: '/item/fixture-1', generation: 'one' });
  try {
    await message({ type: 'SESSION', generation: 'one' });
    await t.test('obtiene campos observados y reutiliza caché sin red', async () => {
      const first = await lookup();
      assert.equal(first.status, 'checked');
      assert.equal(first.seller.reviewCount, 12);
      assert.equal(first.seller.verified, true);
      assert.equal(first.fromCache, false);
      const second = await lookup();
      assert.equal(second.fromCache, true);
      assert.equal(requests, 1);
      assert.equal(values.sellerCacheV1.sellers.length, 1);
      assert.deepEqual(Object.keys(values.sellerCacheV1.sellers[0]).sort(), ['checkedAt','reviewCount','sellerId','source','verified']);
    });
    await t.test('rechaza otros dominios, paths y sesiones canceladas sin consultar', async () => {
      assert.equal(await message({ type: 'STATE' }, { tab: { id: 2, url: 'https://evil.test/' } }), undefined);
      assert.equal((await message({ type: 'LOOKUP', path: 'https://evil.test/item/a', generation: 'one' })).status, 'cancelled');
      await message({ type: 'CANCEL', generation: 'one' });
      assert.equal((await lookup()).status, 'cancelled');
      await message({ type: 'SESSION', generation: 'one' });
      assert.equal(requests, 1);
    });
    await t.test('429 se guarda como barrera; no reintenta ni escribe cero reseñas', async () => {
      await message({ type: 'CLEAR_CACHE' }, popup);
      status = 429;
      const before = requests;
      const limited = await lookup();
      assert.equal(limited.status, 'blocked');
      assert.equal(limited.code, 'rate_limit');
      assert.equal(values.accessState.code, 'rate_limit');
      assert.ok(Number.isFinite(limited.retryAt));
      await lookup();
      assert.equal(requests, before + 1);
      assert.equal(values.sellerCacheV1.sellers.length, 0);
      assert.equal((await message({ type: 'RESUME' }, popup)).ok, true);
    });
    for (const accessStatus of [401, 403]) {
      await t.test(`HTTP ${accessStatus}: detener y reanudar solo expresamente`, async () => {
        status = accessStatus;
        const before = requests;
        assert.equal((await lookup()).code, `http_${accessStatus}`);
        assert.equal((await lookup()).status, 'blocked');
        assert.equal(requests, before + 1);
        assert.equal(values.accessState.code, `http_${accessStatus}`);
        await message({ type: 'RESUME' }, popup);
      });
    }
    await t.test('CAPTCHA con HTTP 200 detiene sin interpretar el texto como anuncio', async () => {
      status = 200; html = '<title>Verify you are human</title><p>captcha</p>';
      const before = requests;
      assert.equal((await lookup()).code, 'challenge');
      await lookup();
      assert.equal(requests, before + 1);
      assert.equal(values.sellerCacheV1.sellers.length, 0);
    });
    await t.test('cancelar una consulta en vuelo es cancelled y una generación vieja no cancela la nueva', async () => {
      await message({ type: 'RESUME' }, popup);
      let started;
      const active = new Promise(resolve => { started = resolve; });
      globalThis.fetch = async (url, {signal}) => {
        started();
        return new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), {once:true}));
      };
      const running = lookup();
      await active;
      await message({type:'CANCEL',generation:'one'});
      assert.equal((await running).status, 'cancelled');
      await message({type:'SESSION',generation:'two'});
      await message({type:'CANCEL',generation:'one'});
      globalThis.fetch = async () => new Response(`<script id="__NEXT_DATA__">${JSON.stringify(sample)}</script>`,{headers:{'content-type':'text/html'}});
      assert.equal((await message({type:'LOOKUP',generation:'two',path:'/item/fixture-1'})).status, 'checked');
    });
  } finally { globalThis.fetch = originalFetch; globalThis.chrome = originalChrome; }
});
