function abortError(reason) {
  if (reason instanceof Error) return reason;
  return new DOMException(typeof reason === 'string' ? reason : 'Solicitud cancelada.', 'AbortError');
}

function sleep(ms, { signal } = {}) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(abortError(signal.reason)); return; }
    const finish = () => {
      signal?.removeEventListener('abort', abort);
      resolve();
    };
    const timer = setTimeout(finish, ms);
    const abort = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      reject(abortError(signal.reason));
    };
    signal?.addEventListener('abort', abort, { once: true });
  });
}

export class QueueStoppedError extends Error {
  constructor(reason = 'Cola detenida.') {
    super(reason instanceof Error ? reason.message : String(reason));
    this.name = 'QueueStoppedError';
  }
}

/** Serializa tareas y separa sus inicios. El caller aborta también su fetch activo. */
export class RequestQueue {
  constructor({ intervalMs = 3000, now = Date.now, sleep: wait = sleep } = {}) {
    if (!Number.isFinite(intervalMs) || intervalMs < 0 || typeof now !== 'function' ||
        typeof wait !== 'function') throw new TypeError('Opciones de cola inválidas.');
    this.intervalMs = intervalMs;
    this.now = now;
    this.sleep = wait;
    this._pending = [];
    this._active = false;
    this._draining = false;
    this._stopped = false;
    this._reason = null;
    this._pauseUntil = 0;
    this._lastStart = -Infinity;
    this._wakeController = null;
  }

  get state() {
    return Object.freeze({
      stopped: this._stopped,
      reason: this._reason,
      pending: this._pending.length,
      active: this._active,
      pauseUntil: this._pauseUntil,
      nextStartAt: Math.max(0, this._lastStart + this.intervalMs, this._pauseUntil),
    });
  }

  run(task, { signal } = {}) {
    if (typeof task !== 'function') return Promise.reject(new TypeError('Se necesita una tarea.'));
    if (signal?.aborted) return Promise.reject(abortError(signal.reason));
    if (this._stopped) return Promise.reject(new QueueStoppedError(this._reason));
    return new Promise((resolve, reject) => {
      const entry = { task, signal, resolve, reject, settled: false, onAbort: null };
      entry.onAbort = () => {
        this._settle(entry, false, abortError(signal.reason));
        const index = this._pending.indexOf(entry);
        if (index !== -1) this._pending.splice(index, 1);
        this._wakeController?.abort();
      };
      signal?.addEventListener('abort', entry.onAbort, { once: true });
      this._pending.push(entry);
      this._kick();
    });
  }

  pauseUntil(timestamp) {
    if (!Number.isFinite(timestamp) || timestamp < 0) throw new TypeError('Pausa inválida.');
    this._pauseUntil = Math.max(this._pauseUntil, timestamp);
    this._wakeController?.abort();
  }

  stop(reason = 'Cola detenida.') {
    this._stopped = true;
    this._reason = reason instanceof Error ? reason.message : String(reason);
    for (const entry of this._pending.splice(0)) {
      this._settle(entry, false, new QueueStoppedError(this._reason));
    }
    this._wakeController?.abort();
  }

  resume() {
    this._stopped = false;
    this._reason = null;
    this._kick();
  }

  _settle(entry, success, value) {
    if (entry.settled) return;
    entry.settled = true;
    entry.signal?.removeEventListener('abort', entry.onAbort);
    if (success) entry.resolve(value);
    else entry.reject(value);
  }

  async _wait(ms) {
    const controller = new AbortController();
    this._wakeController = controller;
    let onAbort;
    const interrupted = new Promise(resolve => {
      onAbort = resolve;
      controller.signal.addEventListener('abort', onAbort, { once: true });
    });
    try {
      await Promise.race([this.sleep(ms, { signal: controller.signal }), interrupted]);
    } catch (error) {
      if (!controller.signal.aborted) throw error;
    } finally {
      controller.signal.removeEventListener('abort', onAbort);
      if (this._wakeController === controller) this._wakeController = null;
    }
  }

  _kick() {
    if (this._draining || this._stopped) return;
    this._draining = true;
    void this._drain();
  }

  async _drain() {
    try {
      while (!this._stopped && this._pending.length) {
        const entry = this._pending[0];
        const delay = Math.max(this._lastStart + this.intervalMs, this._pauseUntil) - this.now();
        if (delay > 0) {
          try { await this._wait(Math.min(delay, 2_147_483_647)); }
          catch (error) {
            const index = this._pending.indexOf(entry);
            if (index !== -1) this._pending.splice(index, 1);
            this._settle(entry, false, error);
          }
          continue;
        }
        this._pending.shift();
        if (entry.settled || entry.signal?.aborted) continue;
        this._active = true;
        this._lastStart = this.now();
        try { this._settle(entry, true, await entry.task({ signal: entry.signal })); }
        catch (error) { this._settle(entry, false, error); }
        finally { this._active = false; }
      }
    } finally {
      this._draining = false;
      if (!this._stopped && this._pending.length) this._kick();
    }
  }
}

/** Retry-After puede contener segundos de espera o una fecha HTTP. */
export function retryAfterMs(value, now = Date.now()) {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text) return null;
  if (/^\d+(?:\.\d+)?$/u.test(text)) {
    const duration = Math.ceil(Number(text) * 1000);
    return Number.isSafeInteger(duration) ? duration : null;
  }
  if (/^[+\-\d.]+$/u.test(text)) return null;
  const timestamp = Date.parse(text);
  return Number.isFinite(timestamp) && Number.isFinite(now) ? Math.max(0, timestamp - now) : null;
}
