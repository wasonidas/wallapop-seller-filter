// Integración de la extensión REAL con páginas sintéticas. Ninguna consulta a Wallapop.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import net from 'node:net';

const root = fileURLToPath(new URL('../', import.meta.url));
let playwright;
for (const entry of [process.env.PLAYWRIGHT_MODULE, 'playwright'].filter(Boolean)) {
  try { playwright = createRequire(import.meta.url)(entry); break; } catch { /* probar la instalación siguiente */ }
}
if (!playwright) throw new Error('Instala Playwright como herramienta de desarrollo o define PLAYWRIGHT_MODULE. No es dependencia de la extensión.');
const server = net.createServer();
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
await new Promise(resolve => server.close(resolve));
const profile = await mkdtemp(path.join(tmpdir(), 'wallapop-fixture-'));
const windowsChrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const executablePath = process.env.BROWSER_EXECUTABLE ||
  (process.platform === 'win32' && existsSync(windowsChrome) ? windowsChrome : playwright.chromium.executablePath());
const context = await playwright.chromium.launchPersistentContext(profile, {
  executablePath, headless: true, ignoreDefaultArgs: ['--disable-extensions'],
  args: [`--remote-debugging-address=127.0.0.1`, `--remote-debugging-port=${port}`, '--enable-unsafe-extension-debugging'],
  viewport: { width: 1280, height: 1000 }, locale: 'es-ES',
});
const browser = await playwright.chromium.connectOverCDP(`http://127.0.0.1:${port}`);
const cdp = await browser.newBrowserCDPSession();
const { id } = await cdp.send('Extensions.loadUnpacked', { path: path.join(root, 'dist') });
const requests = [], failures = [], completed = [];
let mode = 'normal';
const counts = [0, 4, 5, 6, null, 5, 6, 12, 1, 525, 6, 5, 6];
function itemData(index) {
  const sellerId = index === 6 ? 'seller-5' : `seller-${index}`;
  return { props: { pageProps: { item: { userId: sellerId }, itemSeller: {
    id: sellerId, verified: index === 3 || index === 7 || index === 9,
    sellerType: index === 9 ? 'Shop' : 'Private', badgeType: index === 9 ? 'shop' : null,
    stats: { counters: { reviews: counts[index] ?? null }, ratingAverage: 5, ratings: { reviews: 999 } },
  } } } };
}
function card(index) { return `<article data-fixture-index="${index}"><a href="/item/fixture-${index}">Anuncio ${index}</a><p>Producto de prueba ${index}</p></article>`; }
const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Prueba controlada · no es Wallapop real</title>
<style>body{font:16px system-ui;margin:30px;background:#fff}main{max-width:1100px;margin:auto}[aria-label="Items list"]{display:grid;grid-template-columns:repeat(4,1fr);gap:18px}article{height:230px;border:1px solid #ddd;border-radius:9px;padding:45px 12px;background:#f0f1f0}h1{font-size:24px}</style></head>
<body><main><h1>Prueba controlada de la extensión</h1><p>Datos sintéticos con el esquema observado. Esta pantalla no valida el acceso real a Wallapop.</p>
<div aria-label="Items list">${counts.slice(0,12).map((_,i)=>card(i)).join('')}</div><button id="fixture-load-more">Cargar más</button></main><article id="outside">Tarjeta ajena a resultados</article></body></html>`;
await context.route('https://es.wallapop.com/**', async route => {
  const pathname = new URL(route.request().url()).pathname;
  if (!pathname.startsWith('/item/')) { await route.fulfill({ status: 200, contentType: 'text/html', body: html }); return; }
  requests.push({ pathname, at: Date.now() });
  const index = Number(pathname.match(/fixture-(\d+)/)?.[1] ?? 2);
  if (mode === 'rate') { await route.fulfill({ status: 429, headers: { 'Retry-After': '2' }, body: 'Rate limit fixture' }); return; }
  if (mode === 'forbidden') { await route.fulfill({ status: 403, body: 'Forbidden fixture' }); return; }
  if (mode === 'unauthorized') { await route.fulfill({ status: 401, body: 'Unauthorized fixture' }); return; }
  if (mode === 'challenge') { await route.fulfill({ status: 200, contentType: 'text/html', body: '<title>CAPTCHA fixture</title>Verify you are human' }); return; }
  if (mode === 'network') { await route.abort('failed'); return; }
  if (mode === 'one-error' && index === 3) { await route.abort('failed'); return; }
  await route.fulfill({ status: 200, contentType: 'text/html', body: `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(itemData(index))}</script>` });
});
const page = await context.newPage();
page.on('pageerror', error => failures.push(error.message));
const panel = selector => page.locator(`#wallapop-seller-filters ${selector}`);
async function until(predicate, timeout = 45000) {
  const end = Date.now() + timeout;
  while (!(await predicate())) {
    if (Date.now() >= end) throw new Error('La condición de la prueba no se cumplió dentro del plazo.');
    await new Promise(resolve => setTimeout(resolve, 60));
  }
}
async function savePreference(selector, checked) { await panel(selector).setChecked(checked); }
try {
  await page.goto('https://es.wallapop.com/search?keywords=fixture');
  await panel('#enabled').waitFor();
  const heightBefore = await page.locator('[aria-label="Items list"]').evaluate(e => e.getBoundingClientRect().height);
  await until(async () => (await panel('#processed').textContent()).startsWith('10 de 12'));
  assert.equal(requests.length, 10, 'Límite de diez consultas, sin continuación automática');
  assert.equal(await panel('#match').textContent(), 'Cumplen: 6');
  assert.equal(await panel('#excluded').textContent(), 'Descartados: 3');
  assert.equal(await panel('#unchecked').textContent(), 'Sin comprobar: 2');
  assert.equal(await panel('#unknown').textContent(), 'Datos desconocidos: 1');
  assert.equal(await panel('#errors').textContent(), 'Errores: 0');
  assert.equal(await page.locator('[data-wsf-hidden]').count(), 6);
  assert.equal(await page.locator('#outside[data-wsf-card]').count(), 0);
  completed.push('lote inicial, umbral inclusivo, desconocidos estrictos y tarjetas ajenas');

  const initialOrder = await page.locator('[aria-label="Items list"] article').evaluateAll(es => es.map(e => e.dataset.fixtureIndex));
  const heightAfter = await page.locator('[aria-label="Items list"]').evaluate(e => e.getBoundingClientRect().height);
  assert.equal(heightAfter, heightBefore);
  await page.locator('#fixture-load-more').scrollIntoViewIfNeeded();
  await new Promise(resolve => setTimeout(resolve, 350));
  assert.equal(requests.length, 10);
  completed.push('altura y orden conservados; ocultar y hacer scroll no genera consultas');

  await savePreference('#showUnchecked', true);
  assert.equal(await page.locator('[data-wsf-hidden]').count(), 3);
  assert.match(await page.locator('[data-fixture-index="4"] .wsf-card-note').textContent(), /Dato desconocido/);
  await savePreference('#verifiedOnly', true);
  assert.equal(await panel('#match').textContent(), 'Cumplen: 2');
  await savePreference('#verifiedOnly', false);
  await panel('#minimumReviews').fill('6'); await panel('#minimumReviews').dispatchEvent('change');
  assert.equal(await panel('#match').textContent(), 'Cumplen: 4');
  await panel('#minimumReviews').fill('5'); await panel('#minimumReviews').dispatchEvent('change');
  await savePreference('#enabled', false);
  assert.equal(await page.locator('[data-wsf-hidden]').count(), 0);
  assert.equal(await page.locator('.wsf-card-note').count(), 0);
  await savePreference('#enabled', true);
  await until(async () => (await panel('#processed').textContent()).startsWith('12 de 12'));
  completed.push('mínimo, identidad, mostrar sin comprobar y desactivar/reactivar sin recargar');

  await page.locator('[aria-label="Items list"]').evaluate((e, content) => e.insertAdjacentHTML('beforeend', content), card(12));
  await until(async () => (await panel('#unchecked').textContent()) === 'Sin comprobar: 1');
  assert.equal(await panel('#unknown').textContent(), 'Datos desconocidos: 1');
  assert.equal(requests.length, 12, 'Nuevo resultado espera continuación manual');
  await panel('#continue').click();
  await until(async () => (await panel('#processed').textContent()).startsWith('13 de 13'));
  await page.locator('[data-fixture-index="0"] a').evaluate(e => { e.href = '/item/fixture-12'; });
  await until(async () => (await page.locator('[data-fixture-index="0"] .wsf-card-note').textContent()).startsWith('6 reseñas'));
  assert.equal(await page.locator('#wallapop-seller-filters').count(), 1);
  assert.deepEqual(await page.locator('[aria-label="Items list"] article').evaluateAll(es => es.map(e => e.dataset.fixtureIndex)), [...initialOrder, '12']);
  completed.push('nuevos resultados manuales, reutilización de tarjetas, orden y panel único');

  const beforeNavigation = requests.length;
  await page.evaluate(() => history.pushState({}, '', '/search?keywords=fixture-2'));
  await until(async () => (await panel('#processed').textContent()).startsWith('11 de 13'));
  // Un dato ausente no se cachea; se vuelve a consultar solo ese anuncio.
  assert.equal(requests.length, beforeNavigation + 1);
  await page.goBack();
  await new Promise(resolve => setTimeout(resolve, 650));
  await until(async () => (await panel('#processed').textContent()).startsWith('11 de 13'));
  await page.evaluate(() => { window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })); window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })); });
  await until(async () => (await panel('#processed').textContent()).startsWith('13 de 13'));
  completed.push('navegación interna, atrás, restauración de sesión y caché sin consultas repetidas');

  await mkdir(path.join(root, '.local'), { recursive: true });
  await savePreference('#showUnchecked', false);
  await savePreference('#verifiedOnly', true);
  assert.equal(await panel('#continue').isDisabled(), true);
  assert.equal(await panel('#unchecked').textContent(), 'Sin comprobar: 0');
  assert.ok(Number((await panel('#unknown').textContent()).split(': ')[1]) > 0);
  assert.match(await panel('#status').textContent(), /Todos los anuncios cargados ya se han intentado comprobar/);
  assert.match(await panel('#status').textContent(), /Identidad sin confirmar/);
  assert.match(await panel('#continue').getAttribute('title'), /datos desconocidos y los errores se indican aparte/);
  await savePreference('#verifiedOnly', false);
  completed.push('datos desconocidos ya procesados no se confunden con anuncios nuevos');
  await page.screenshot({ path: path.join(root, '.local/browser-fixture.png'), fullPage: true });
  await panel('#minimumReviews').fill('6'); await panel('#minimumReviews').dispatchEvent('change');
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${id}/popup.html`);
  await until(async () => await popup.locator('#reviews').inputValue() === '6');
  assert.equal(await popup.locator('#enabled').isChecked(), true);
  await popup.locator('#reviews').fill('5');
  await popup.locator('#save').click();
  await until(async () => await panel('#minimumReviews').inputValue() === '5');
  completed.push('popup cargado y preferencias compartidas persistidas');

  for (const [nextMode, status] of [['rate','429'],['forbidden','403'],['unauthorized','401'],['challenge','CAPTCHA']]) {
    mode = nextMode;
    const before = requests.length;
    await panel('#refresh').click();
    await until(async () => (await panel('#status').textContent()).includes(status));
    await new Promise(resolve => setTimeout(resolve, 200));
    assert.equal(requests.length, before + 1, `No reintenta tras ${status}`);
    if (nextMode === 'rate') {
      assert.equal(await panel('#resume').isDisabled(), true);
      await until(async () => !(await panel('#resume').isDisabled()), 5000);
    }
    // Se limpia solo el bloqueo en el worker: no inicia otra consulta.
    const worker = context.serviceWorkers().find(w => w.url().endsWith('/background.js'));
    await worker.evaluate(() => chrome.storage.local.set({accessState:null}));
    // RESUME debe gestionarse vía mensaje porque el worker mantiene gate en memoria.
    await popup.evaluate(() => chrome.runtime.sendMessage({ type: 'RESUME' }));
    await until(async () => !(await panel('#refresh').isDisabled()));
  }
  completed.push('429 con Retry-After, 401, 403 y CAPTCHA detienen las consultas sin bucles');
  mode = 'network';
  const networkBefore = requests.length;
  await panel('#refresh').click();
  await until(async () => (await panel('#processed').textContent()).startsWith('11 de 13'));
  assert.equal(requests.length, networkBefore + 10);
  assert.match(await panel('#processed').textContent(), /11 errores/);
  assert.match(await panel('#status').textContent(), /Hay anuncios sin comprobar, datos desconocidos o errores/);
  completed.push('fallos de red son errores separados de cero reseñas y cero coincidencias');
  await panel('#continue').click();
  await until(async () => (await panel('#processed').textContent()).startsWith('13 de 13'));
  assert.equal(requests.length, networkBefore + 12);
  assert.equal(await panel('#unchecked').textContent(), 'Sin comprobar: 0');
  assert.equal(await panel('#errors').textContent(), 'Errores: 13');
  assert.equal(await panel('#continue').isDisabled(), true);
  assert.equal(await panel('#retry').isEnabled(), true);
  const beforeRetry = requests.length;
  mode = 'one-error';
  await panel('#retry').click();
  await until(async () => !(await panel('#retry').isDisabled()));
  assert.equal(requests.length, beforeRetry + 10, 'Reintento manual limitado a diez rutas fallidas');
  assert.equal(await panel('#errors').textContent(), 'Errores: 3');
  assert.equal(await panel('#unknown').textContent(), 'Datos desconocidos: 1');
  const secondRetry = requests.length;
  mode = 'normal';
  await panel('#retry').click();
  await until(async () => (await panel('#processed').textContent()).startsWith('13 de 13') && await panel('#retry').isHidden());
  assert.equal(requests.length, secondRetry + 3, 'Solo se consultan los tres errores; no se repiten los datos desconocidos ni los comprobados');
  assert.deepEqual(requests.slice(secondRetry).map(r => r.pathname).sort(), ['/item/fixture-10', '/item/fixture-11', '/item/fixture-3']);
  assert.equal(await panel('#unchecked').textContent(), 'Sin comprobar: 0');
  assert.equal(await panel('#unknown').textContent(), 'Datos desconocidos: 1');
  assert.equal(await panel('#continue').isDisabled(), true);
  completed.push('reintento de errores por lotes sin borrar caché ni repetir desconocidos o comprobados');
  assert.deepEqual(failures, []);
  for (let i = 1; i < requests.length; i++) {
    assert.ok(requests[i].at - requests[i-1].at >= 2750, 'Cadencia de una petición cada tres segundos');
  }
  const result = { date: new Date().toISOString(), browser: await browser.version(), extensionId: id, scope: 'fixtures-only', passed: completed, errors: failures, networkQueries: requests.length };
  await mkdir(path.join(root, '.local'), { recursive: true });
  await writeFile(path.join(root, '.local/browser-results.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error({ completed, requests: requests.length, processed: await panel('#processed').textContent().catch(() => ''), status: await panel('#status').textContent().catch(() => ''), failures });
  throw error;
} finally { await context.close(); }
