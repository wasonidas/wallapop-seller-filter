// Sources observed on 2026-10-18: docs/RESEARCH.md.
export const ORIGIN = 'https://es.wallapop.com';
export const GRID_SELECTOR = '[aria-label="Items list"]';
export const CARD_SELECTOR = `${GRID_SELECTOR} article`;
export const ADAPTER_STATUS = 'observed_next_data_v1';

export function itemPath(value) {
  try {
    const url = new URL(value, ORIGIN);
    const decoded = decodeURIComponent(url.pathname);
    if (url.origin !== ORIGIN || url.username || url.password ||
        !/^\/item\/[^/\s?#<>\\]+$/.test(decoded) || decoded.includes('..') || decoded.length > 512) return null;
    return url.pathname;
  } catch { return null; }
}

export function readSellerCards(document) {
  const cards = [];
  for (const element of document.querySelectorAll(CARD_SELECTOR)) {
    const path = itemPath(element.querySelector('a[href*="/item/"]')?.getAttribute('href'));
    if (path) cards.push({ element, path });
  }
  return cards;
}

export function extractNextData(html) {
  if (typeof html !== 'string' || html.length > 5_000_000) return null;
  // No ejecutar scripts, ni buscar cifras en textos libres o descripciones.
  const match = html.match(/<script\b(?=[^>]*\bid\s*=\s*["']__NEXT_DATA__["'])[^>]*>([\s\S]*?)<\/script\s*>/i);
  if (!match) return null;
  try { return JSON.parse(match[1]); } catch { return null; }
}

export function sellerFromNextData(data, path, checkedAt = Date.now()) {
  const p = data?.props?.pageProps;
  const s = p?.itemSeller;
  if (!itemPath(path) || typeof s?.id !== 'string' || !/^[\w-]{1,100}$/.test(s.id) ||
      p?.item?.userId !== s.id) return null;
  const count = s.stats?.counters?.reviews;
  if (!Number.isSafeInteger(count) || count < 0) return null;
  // verified también significa verificación comercial en Shop: no equivale a KYC.
  // La ausencia de insignia / verified:false conserva identidad desconocida.
  const identity = s.verified === true && s.sellerType === 'Private' && s.badgeType === null ? true : null;
  return { sellerId: s.id, reviewCount: count, verified: identity,
    checkedAt, source: ORIGIN + itemPath(path) };
}

export function isAccessChallenge(html) {
  // Se llama solo si faltan los datos estructurados esperados.
  return /captcha|access denied|request blocked|verify you are human|verifica que eres humano|the request could not be satisfied/i.test(html);
}
