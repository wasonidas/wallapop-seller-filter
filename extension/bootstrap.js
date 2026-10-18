(() => {
  if (globalThis.__wallapopSellerFilters) return;
  globalThis.__wallapopSellerFilters = true;
  import(chrome.runtime.getURL('content.js')).catch(() => {
    delete globalThis.__wallapopSellerFilters;
  });
})();
