export const CACHE_STORAGE_KEY = 'sellerCacheV1';

const DAY_MS = 24 * 60 * 60 * 1000;

function identity(value) {
  return typeof value === 'string' && value.trim() && value.length <= 256
    ? value.trim()
    : null;
}

function itemPath(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return null;
  const path = value.split(/[?#]/u, 1)[0];
  return path.length > 1 && path.length <= 2048 ? path : null;
}

function sellerRecord(value, timestamp) {
  if (!value || typeof value !== 'object' || value.error != null) return null;
  if (value.status != null && value.status !== 'ok' && value.status !== 'success') return null;
  const sellerId = identity(value.sellerId);
  const checkedAt = value.checkedAt ?? timestamp;
  if (!sellerId || !Number.isSafeInteger(value.reviewCount) || value.reviewCount < 0) return null;
  if (!Number.isSafeInteger(checkedAt) || checkedAt < 0 || checkedAt > timestamp) return null;
  if (typeof value.source !== 'string' || !value.source.trim() || value.source.length > 2048) return null;
  return {
    sellerId,
    reviewCount: value.reviewCount,
    verified: typeof value.verified === 'boolean' ? value.verified : null,
    checkedAt,
    source: value.source.trim(),
  };
}

function sameRecord(left, right) {
  return left && left.reviewCount === right.reviewCount && left.verified === right.verified &&
    left.checkedAt === right.checkedAt && left.source === right.source;
}

/**
 * Persistencia local de resultados comprobados; nunca infiere un recuento cero.
 * adapter.get(key) devuelve el valor, adapter.set(key, value) lo guarda.
 * Las operaciones están serializadas para no perder actualizaciones concurrentes.
 */
export class SellerCache {
  constructor(adapter, { now = Date.now, ttlMs = DAY_MS, maxEntries = 1000 } = {}) {
    if (typeof adapter?.get !== 'function' || typeof adapter?.set !== 'function') {
      throw new TypeError('El adaptador de caché necesita get y set.');
    }
    if (typeof now !== 'function' || !Number.isFinite(ttlMs) || ttlMs < 0 ||
        !Number.isSafeInteger(maxEntries) || maxEntries < 1) {
      throw new TypeError('Opciones de caché inválidas.');
    }
    this.adapter = adapter;
    this.now = now;
    this.ttlMs = ttlMs;
    this.maxEntries = maxEntries;
    this._sellers = new Map();
    this._items = new Map();
    this._loaded = false;
    this._dirty = false;
    this._operations = Promise.resolve();
  }

  _fresh(timestamp, currentTime) {
    return Number.isSafeInteger(timestamp) && timestamp >= 0 && timestamp <= currentTime &&
      currentTime - timestamp < this.ttlMs;
  }

  async _load() {
    if (this._loaded) return;
    const stored = await this.adapter.get(CACHE_STORAGE_KEY);
    const currentTime = this.now();
    if (stored?.version === 1) {
      for (const candidate of Array.isArray(stored.sellers) ? stored.sellers : []) {
        const record = candidate?.checkedAt == null ? null : sellerRecord(candidate, currentTime);
        const previous = record && this._sellers.get(record.sellerId);
        if (record && this._fresh(record.checkedAt, currentTime) &&
            (!previous || previous.checkedAt <= record.checkedAt)) {
          this._sellers.set(record.sellerId, record);
        }
      }
      for (const candidate of Array.isArray(stored.items) ? stored.items : []) {
        const path = itemPath(candidate?.path);
        const sellerId = identity(candidate?.sellerId);
        if (path && sellerId && this._fresh(candidate.linkedAt, currentTime)) {
          this._items.set(path, { path, sellerId, linkedAt: candidate.linkedAt });
        }
      }
      const normalized = {
        version: 1,
        sellers: [...this._sellers.values()],
        items: [...this._items.values()],
      };
      // Retira también del almacenamiento los datos caducados o no admitidos.
      this._dirty = JSON.stringify(stored) !== JSON.stringify(normalized);
    }
    this._loaded = true;
    this._prune(currentTime);
  }

  _prune(currentTime) {
    for (const [key, record] of this._sellers) {
      if (!this._fresh(record.checkedAt, currentTime)) {
        this._sellers.delete(key);
        this._dirty = true;
      }
    }
    for (const [key, record] of this._items) {
      if (!this._fresh(record.linkedAt, currentTime)) {
        this._items.delete(key);
        this._dirty = true;
      }
    }
    for (const collection of [this._sellers, this._items]) {
      while (collection.size > this.maxEntries) {
        collection.delete(collection.keys().next().value);
        this._dirty = true;
      }
    }
  }

  async _persist() {
    if (!this._dirty) return;
    await this.adapter.set(CACHE_STORAGE_KEY, {
      version: 1,
      sellers: [...this._sellers.values()].map(record => ({ ...record })),
      items: [...this._items.values()].map(record => ({ ...record })),
    });
    this._dirty = false;
  }

  _enqueue(operation) {
    const result = this._operations.then(async () => {
      await this._load();
      this._prune(this.now());
      const value = await operation();
      this._prune(this.now());
      await this._persist();
      return value;
    });
    this._operations = result.catch(() => {});
    return result;
  }

  getSeller(sellerId) {
    return this._enqueue(() => {
      const key = identity(sellerId);
      const record = key && this._sellers.get(key);
      if (!record) return null;
      this._sellers.delete(key);
      this._sellers.set(key, record);
      return { ...record };
    });
  }

  putSeller(value) {
    return this._enqueue(() => {
      const record = sellerRecord(value, this.now());
      if (!record || !this._fresh(record.checkedAt, this.now())) return null;
      const previous = this._sellers.get(record.sellerId);
      if (previous && previous.checkedAt > record.checkedAt) return { ...previous };
      if (!sameRecord(previous, record)) {
        this._sellers.delete(record.sellerId);
        this._sellers.set(record.sellerId, record);
        this._dirty = true;
      }
      return { ...record };
    });
  }

  getItem(path) {
    return this._enqueue(() => {
      const key = itemPath(path);
      const record = key && this._items.get(key);
      if (!record) return null;
      this._items.delete(key);
      this._items.set(key, record);
      return record.sellerId;
    });
  }

  linkItem(path, sellerId) {
    return this._enqueue(() => {
      const key = itemPath(path);
      const id = identity(sellerId);
      if (!key || !id) return false;
      const previous = this._items.get(key);
      if (!previous || previous.sellerId !== id) {
        this._items.delete(key);
        this._items.set(key, { path: key, sellerId: id, linkedAt: this.now() });
        this._dirty = true;
      }
      return true;
    });
  }

  clear() {
    return this._enqueue(() => {
      this._sellers.clear();
      this._items.clear();
      this._dirty = true;
    });
  }

  flush() {
    return this._enqueue(() => {});
  }
}
