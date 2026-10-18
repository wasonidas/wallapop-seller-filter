import { normalizePreferences, evaluateSeller } from './core/filter.js';
import { summarizeResults } from './core/progress.js';
import { readSellerCards, GRID_SELECTOR } from './adapters/wallapop.js';
import { createPanel } from './ui/panel.js';

const BATCH_SIZE = 10;
let preferences = normalizePreferences();
let route = '';
let generation = '';
let panel;
let gate = null;
let busy = false;
let initialStarted = false;
let scanTimer;
let message = '';
const cards = new Map();
const results = new Map();
const send = data => chrome.runtime.sendMessage(data);
const isSearch = () => location.pathname.replace(/\/$/, '') === '/search';
const routeKey = () => location.pathname + location.search;

const style = document.createElement('style');
style.id = 'wsf-card-styles';
style.textContent = '[data-wsf-hidden]{visibility:hidden!important;pointer-events:none!important}[data-wsf-card]{position:relative}.wsf-card-note{position:absolute;top:8px;left:8px;right:8px;z-index:3;display:block;padding:5px 7px;border:1px solid #c5dbd0;border-radius:5px;background:#f4fbf7;color:#173c38;font:600 11px/1.3 system-ui,sans-serif;pointer-events:none}.wsf-card-note[data-unchecked]{background:#fff5df;border-color:#d7bc80;color:#684817}';
document.head.append(style);

function restore(element, record) {
  element.removeAttribute('data-wsf-hidden');
  element.removeAttribute('data-wsf-card');
  if (record.aria === null) element.removeAttribute('aria-hidden');
  else element.setAttribute('aria-hidden', record.aria);
  record.badge.remove();
}
function apply() {
  const counts = summarizeResults([...cards.values()].map(card => results.get(card.path)), preferences);
  for (const [element, card] of cards) {
    const result = results.get(card.path) || { status: 'unprocessed' };
    const evaluation = result.status === 'checked' ? evaluateSeller(result.seller, preferences) : { status: 'unknown' };
    if (!preferences.enabled) { restore(element, card); continue; }
    element.setAttribute('data-wsf-card', '');
    const show = evaluation.status === 'match' ||
      (preferences.showUnchecked && evaluation.status === 'unknown');
    element.toggleAttribute('data-wsf-hidden', !show);
    if (show) {
      if (card.aria === null) element.removeAttribute('aria-hidden');
      else element.setAttribute('aria-hidden', card.aria);
    } else element.setAttribute('aria-hidden', 'true');
    const checked = result.status === 'checked';
    card.badge.toggleAttribute('data-unchecked', evaluation.status === 'unknown');
    card.badge.textContent = checked
      ? `${result.seller.reviewCount} reseñas · Identidad ${result.seller.verified === true ? 'verificada' : result.seller.verified === false ? 'no verificada' : 'desconocida'}`
      : result.status === 'pending' ? 'Pendiente de comprobación'
        : result.status === 'error' ? 'Error de consulta · se puede reintentar' : result.status === 'unknown' ? 'Dato desconocido · consulta ya intentada' : 'Sin comprobar';
    card.badge.title = checked ? `Comprobado: ${new Date(result.seller.checkedAt).toLocaleString('es-ES')}${result.fromCache ? ' · caché local' : ''}. Fuente: ficha pública del anuncio.` : 'Este anuncio no es una coincidencia comprobada.';
    if (!card.badge.isConnected) element.append(card.badge);
  }
  panel?.update({ preferences, counts, busy, gate, message });
}
function reset() {
  if (generation) send({ type: 'CANCEL', generation }).catch(() => {});
  generation = crypto.randomUUID();
  for (const [element, card] of cards) restore(element, card);
  cards.clear();
  results.clear();
  busy = false;
  initialStarted = false;
  message = '';
  panel?.host.remove();
  panel = null;
}
async function startSession() {
  const current = generation;
  try {
    const state = await send({ type: 'SESSION', generation: current });
    if (current === generation) { gate = state?.gate || null; apply(); }
  } catch { message = 'No se pudo conectar con la extensión. Recarga la pestaña después de actualizarla.'; apply(); }
}
function scan() {
  if (routeKey() !== route) navigate();
  if (!isSearch()) return;
  if (!panel) {
    panel = createPanel({ onPreference: setPreference, onContinue: () => batch(), onRetry: () => batch('error'), onRefresh: refresh, onResume: resume });
  }
  const grid = document.querySelector(GRID_SELECTOR);
  if (!panel.host.isConnected) {
    if (grid) grid.before(panel.host);
    else (document.querySelector('main') || document.body).prepend(panel.host);
  }
  const found = readSellerCards(document);
  const present = new Set(found.map(card => card.element));
  for (const [element, card] of cards) {
    if (!present.has(element)) { restore(element, card); cards.delete(element); }
  }
  for (const { element, path } of found) {
    if (cards.get(element)?.path !== path) {
      const old = cards.get(element);
      if (old) restore(element, old);
      const badge = document.createElement('span');
      badge.className = 'wsf-card-note';
      cards.set(element, { path, badge, aria: element.getAttribute('aria-hidden') });
    }
    if (!results.has(path)) results.set(path, { status: 'unprocessed' });
  }
  apply();
  if (found.length && !initialStarted && preferences.enabled) {
    initialStarted = true;
    batch();
  }
}
function scheduleScan() {
  clearTimeout(scanTimer);
  scanTimer = setTimeout(scan, 100);
}
async function batch(status = 'unprocessed') {
  if (busy || !preferences.enabled || gate || !isSearch()) return;
  busy = true;
  message = '';
  const current = generation;
  const currentRoute = route;
  const paths = [...new Set([...cards.values()].map(c => c.path))]
    .filter(path => results.get(path)?.status === status).slice(0, BATCH_SIZE);
  const valid = () => current === generation && currentRoute === routeKey() && preferences.enabled;
  try {
    for (const path of paths) {
      if (!valid() || ![...cards.values()].some(c => c.path === path)) break;
      results.set(path, { status: 'pending' });
      apply();
      let result;
      try { result = await send({ type: 'LOOKUP', generation: current, path }); }
      catch { result = { status: 'error', code: 'extension_unavailable' }; }
      if (!valid()) break;
      if (!result || result.status === 'cancelled') { results.set(path, { status: 'unprocessed' }); break; }
      if (result.status === 'blocked') {
        gate = { code: result.code, retryAt: result.retryAt };
        results.set(path, { status: 'unknown', code: result.code });
        break;
      }
      results.set(path, result);
      apply();
    }
  } finally {
    if (current === generation) { busy = false; apply(); }
  }
}
async function setPreference(key, value) {
  const wasEnabled = preferences.enabled;
  preferences = normalizePreferences({ ...preferences, [key]: value });
  if (wasEnabled && !preferences.enabled) {
    send({ type: 'CANCEL', generation }).catch(() => {});
    generation = crypto.randomUUID();
    busy = false;
    for (const [path, result] of results) if (result.status === 'pending') results.set(path, { status: 'unprocessed' });
  }
  apply();
  try { await chrome.storage.local.set({ sellerPreferences: preferences }); }
  catch { message = 'Los filtros cambiaron, pero no se pudieron guardar las preferencias.'; apply(); }
  if (!wasEnabled && preferences.enabled) { initialStarted = false; await startSession(); scan(); }
}
async function refresh() {
  if (busy || gate) return;
  try {
    await send({ type: 'CLEAR_CACHE' });
    for (const path of results.keys()) results.set(path, { status: 'unprocessed' });
    await batch();
  } catch { message = 'No se pudo actualizar la caché local.'; apply(); }
}
async function resume() {
  try {
    const response = await send({ type: 'RESUME' });
    if (!response?.ok) { gate = { code: response.code, retryAt: response.retryAt }; apply(); return; }
    gate = null;
    for (const [path, result] of results) if (result.status !== 'checked') results.set(path, { status: 'unprocessed' });
    await startSession();
    await batch();
  } catch { message = 'No se pudo reanudar la consulta.'; apply(); }
}
function navigate() {
  route = routeKey();
  reset();
  if (isSearch()) startSession();
  scheduleScan();
}

try {
  const saved = await chrome.storage.local.get('sellerPreferences');
  preferences = normalizePreferences(saved.sellerPreferences);
} catch { message = 'No se pudieron leer las preferencias guardadas.'; }
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.accessState) { gate = changes.accessState.newValue || null; apply(); }
  if (changes.sellerPreferences) {
    const next = normalizePreferences(changes.sellerPreferences.newValue);
    if (JSON.stringify(next) !== JSON.stringify(preferences)) {
      const previous = preferences.enabled;
      preferences = next;
      if (previous !== next.enabled) {
        send({ type: 'CANCEL', generation }).catch(() => {});
        generation = crypto.randomUUID();
        busy = false;
        for (const [path, result] of results) if (result.status === 'pending') results.set(path, { status: 'unprocessed' });
        if (next.enabled) {
          initialStarted = false;
          startSession().then(scan);
          return;
        }
      }
      scan();
    }
  }
});
const observer = new MutationObserver(records => {
  if (records.some(record => record.type === 'attributes' ||
      [...record.addedNodes, ...record.removedNodes].some(node => node.nodeType === 1 &&
        !node.matches?.('.wsf-card-note, #wallapop-seller-filters') &&
        (node.matches?.('article, a[href*="/item/"]') || node.querySelector?.('article, a[href*="/item/"]'))))) scheduleScan();
});
observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['href'] });
window.addEventListener('popstate', scheduleScan);
window.addEventListener('pageshow', event => {
  if (!event.persisted) { scheduleScan(); return; }
  generation = crypto.randomUUID();
  busy = false;
  initialStarted = false;
  for (const [path, result] of results) if (result.status === 'pending') results.set(path, { status: 'unprocessed' });
  if (isSearch()) startSession().then(scan);
});
window.addEventListener('pagehide', () => send({ type: 'CANCEL', generation }).catch(() => {}));
setInterval(() => { if (routeKey() !== route) navigate(); else if (gate?.retryAt) apply(); }, 500);
navigate();
