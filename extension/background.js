import { SellerCache } from './core/cache.js';
import { RequestQueue, retryAfterMs } from './core/queue.js';
import { ORIGIN, itemPath, extractNextData, sellerFromNextData, isAccessChallenge } from './adapters/wallapop.js';

const storage = {
  async get(key) { return (await chrome.storage.local.get(key))[key]; },
  async set(key, value) { await chrome.storage.local.set({ [key]: value }); },
};
const cache = new SellerCache(storage);
const queue = new RequestQueue({ intervalMs: 3000 });
const sessions = new Map();
let gate = null;
const ready = storage.get('accessState').then(v => { gate = v || null; });

function session(tabId, generation) {
  let current = sessions.get(tabId);
  if (!current) { current = { generation, controller: new AbortController() }; sessions.set(tabId, current); }
  return current.generation === generation ? current : null;
}
async function block(code, retryAt = null) {
  gate = { code, retryAt };
  await storage.set('accessState', gate);
}
async function cached(path) {
  const id = await cache.getItem(path);
  return id ? cache.getSeller(id) : null;
}
async function lookup(path, current, force) {
  const signal = current.controller.signal;
  if (signal.aborted) return { status: 'cancelled' };
  if (!force) {
    const hit = await cached(path);
    if (hit) return { status: 'checked', seller: hit, fromCache: true };
  }
  if (gate) return { status: 'blocked', ...gate };
  return queue.run(async () => {
    if (gate) return { status: 'blocked', ...gate };
    if (!force) {
      const hit = await cached(path);
      if (hit) return { status: 'checked', seller: hit, fromCache: true };
    }
    const timeout = new AbortController();
    const timer = setTimeout(() => timeout.abort(), 20000);
    const combined = AbortSignal.any([signal, timeout.signal]);
    try {
      const response = await fetch(ORIGIN + path, { credentials: 'include', redirect: 'error', signal: combined });
      if (response.status === 429) {
        const retryAt = Date.now() + (retryAfterMs(response.headers.get('Retry-After')) ?? 60000);
        queue.pauseUntil(retryAt);
        await block('rate_limit', retryAt);
        return { status: 'blocked', ...gate };
      }
      if ([401, 403].includes(response.status)) {
        await block(`http_${response.status}`);
        return { status: 'blocked', ...gate };
      }
      if (!response.ok) return { status: 'error', code: `http_${response.status}` };
      if (!(response.headers.get('content-type') || '').includes('text/html')) return { status: 'unknown', code: 'format_changed' };
      if (Number(response.headers.get('content-length')) > 5_000_000) return { status: 'unknown', code: 'response_too_large' };
      const html = await response.text();
      if (combined.aborted) return { status: signal.aborted ? 'cancelled' : 'error', code: 'timeout' };
      const data = extractNextData(html);
      const seller = sellerFromNextData(data, path);
      if (!seller) {
        if (isAccessChallenge(html) && !data?.props?.pageProps?.item) {
          await block('challenge');
          return { status: 'blocked', ...gate };
        }
        return { status: 'unknown', code: 'data_missing' };
      }
      await cache.putSeller(seller);
      await cache.linkItem(path, seller.sellerId);
      return { status: 'checked', seller, fromCache: false };
    } catch {
      return { status: signal.aborted ? 'cancelled' : 'error', code: timeout.signal.aborted ? 'timeout' : 'network' };
    } finally { clearTimeout(timer); }
  }, { signal });
}

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (!message || typeof message.type !== 'string') return false;
  let allowed = false;
  try { allowed = new URL(sender.tab?.url || sender.url).origin === ORIGIN; } catch { /* popup below */ }
  const popup = sender.url === chrome.runtime.getURL('popup.html');
  if (!allowed && !popup) return false;
  (async () => {
    await ready;
    if (message.type === 'STATE') return { gate };
    if (message.type === 'CLEAR_CACHE') { await cache.clear(); return { ok: true }; }
    if (message.type === 'RESUME') {
      if (gate?.retryAt && Date.now() < gate.retryAt) return { status: 'blocked', ...gate };
      gate = null;
      queue.resume();
      await storage.set('accessState', null);
      return { ok: true };
    }
    const tabId = sender.tab?.id;
    if (!Number.isInteger(tabId) || typeof message.generation !== 'string' || message.generation.length > 100) return { status: 'cancelled' };
    if (message.type === 'SESSION') {
      sessions.get(tabId)?.controller.abort();
      sessions.set(tabId, { generation: message.generation, controller: new AbortController() });
      return { ok: true, gate };
    }
    if (message.type === 'CANCEL') {
      const current = sessions.get(tabId);
      if (current?.generation === message.generation) current.controller.abort();
      return { ok: true };
    }
    if (message.type === 'LOOKUP') {
      const path = itemPath(message.path);
      const current = session(tabId, message.generation);
      if (!path || !current || current.controller.signal.aborted) return { status: 'cancelled' };
      return lookup(path, current, message.force === true);
    }
    return { status: 'unknown', code: 'unsupported' };
  })().then(respond, error => respond(error?.name === 'AbortError'
    ? { status: 'cancelled' }
    : { status: 'error', code: 'local_storage' }));
  return true;
});
chrome.tabs.onRemoved.addListener(tabId => {
  sessions.get(tabId)?.controller.abort();
  sessions.delete(tabId);
});
