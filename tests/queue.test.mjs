import test from 'node:test';
import assert from 'node:assert/strict';
import { RequestQueue, retryAfterMs } from '../extension/core/queue.js';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const tick = () => new Promise(resolve => setImmediate(resolve));

test('serializa todas las tareas y separa sus inicios sin pausa extra tras una tarea larga', async () => {
  let time = 10_000;
  let active = 0;
  let maximum = 0;
  const starts = [];
  const waits = [];
  const gate = deferred();
  const queue = new RequestQueue({ intervalMs: 3000, now: () => time,
    sleep: async ms => { waits.push(ms); time += ms; } });
  const first = queue.run(async () => {
    starts.push(time);
    maximum = Math.max(maximum, ++active);
    await gate.promise;
    time += 4000;
    active--;
    return 'a';
  });
  const second = queue.run(async () => {
    starts.push(time);
    maximum = Math.max(maximum, ++active);
    active--;
    return 'b';
  });
  const third = queue.run(async () => {
    starts.push(time);
    maximum = Math.max(maximum, ++active);
    active--;
    return 'c';
  });
  assert.equal(queue.state.active, true);
  assert.equal(queue.state.pending, 2);
  gate.resolve();
  assert.deepEqual(await Promise.all([first, second, third]), ['a', 'b', 'c']);
  assert.equal(maximum, 1);
  assert.deepEqual(starts, [10_000, 14_000, 17_000]);
  assert.deepEqual(waits, [3000]);
  assert.equal(queue.state.active, false);
});

test('Retry-After puede ampliar la pausa global mientras una tarea está esperando', async () => {
  let time = 0;
  const sleeps = [];
  const queue = new RequestQueue({ intervalMs: 3000, now: () => time, sleep: (ms, { signal }) => {
    const wait = deferred();
    sleeps.push({ ms, wait });
    signal.addEventListener('abort', () => wait.reject(new DOMException('Cancelado', 'AbortError')),
      { once: true });
    return wait.promise;
  } });
  await queue.run(() => 'first');
  const task = queue.run(() => time);
  await tick();
  assert.equal(sleeps[0].ms, 3000);
  queue.pauseUntil(9000);
  await tick();
  assert.equal(sleeps[1].ms, 9000);
  time = 9000;
  sleeps[1].wait.resolve();
  assert.equal(await task, 9000);
});

test('cancelar una tarea en espera impide ejecutarla y no bloquea las siguientes', async () => {
  const gate = deferred();
  const controller = new AbortController();
  let ran = false;
  const queue = new RequestQueue({ intervalMs: 0 });
  const first = queue.run(() => gate.promise);
  const second = queue.run(() => { ran = true; }, { signal: controller.signal });
  const rejection = assert.rejects(second, { name: 'AbortError' });
  const third = queue.run(() => 'third');
  controller.abort();
  await rejection;
  gate.resolve('first');
  assert.deepEqual(await Promise.all([first, third]), ['first', 'third']);
  assert.equal(ran, false);
});

test('abortar una tarea activa rechaza su resultado pero ocupa el puesto hasta terminar', async () => {
  const gate = deferred();
  const controller = new AbortController();
  const queue = new RequestQueue({ intervalMs: 0 });
  const first = queue.run(({ signal }) => {
    assert.equal(signal, controller.signal);
    return gate.promise;
  }, { signal: controller.signal });
  const rejection = assert.rejects(first, { name: 'AbortError' });
  let secondStarted = false;
  const second = queue.run(() => { secondStarted = true; return 'second'; });
  controller.abort();
  await rejection;
  assert.equal(secondStarted, false);
  assert.equal(queue.state.active, true);
  gate.resolve('stale');
  assert.equal(await second, 'second');
});

test('detener rechaza tareas pendientes y futuras; resume permite trabajo nuevo', async () => {
  const gate = deferred();
  const queue = new RequestQueue({ intervalMs: 0 });
  const first = queue.run(() => gate.promise);
  const pending = queue.run(() => assert.fail('no se debe iniciar'));
  const rejection = assert.rejects(pending, { name: 'QueueStoppedError', message: 'HTTP 429' });
  queue.stop('HTTP 429');
  await rejection;
  assert.equal(queue.state.stopped, true);
  assert.equal(queue.state.reason, 'HTTP 429');
  await assert.rejects(queue.run(() => 'blocked'), { name: 'QueueStoppedError' });
  gate.resolve('active');
  assert.equal(await first, 'active');
  queue.resume();
  assert.equal(await queue.run(() => 'resumed'), 'resumed');
  assert.equal(queue.state.stopped, false);
});

test('stop interrumpe el temporizador sin aguardar todo Retry-After', async () => {
  const queue = new RequestQueue({ intervalMs: 0 });
  queue.pauseUntil(Date.now() + 60_000);
  const pending = queue.run(() => assert.fail('no debe iniciarse'));
  const rejection = assert.rejects(pending, { name: 'QueueStoppedError' });
  queue.stop('paused');
  await rejection;
  await tick();
  assert.equal(queue.state.pending, 0);
  assert.equal(queue.state.active, false);
});

test('una tarea fallida y una señal ya abortada no envenenan el trabajo posterior', async () => {
  const queue = new RequestQueue({ intervalMs: 0 });
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(queue.run(() => assert.fail('abortada'), { signal: controller.signal }),
    { name: 'AbortError' });
  await assert.rejects(queue.run(() => { throw new Error('network'); }), /network/u);
  assert.equal(await queue.run(() => 'ok'), 'ok');
});

test('Retry-After admite segundos, fechas HTTP, pasado y valores no válidos', () => {
  const now = Date.UTC(2026, 9, 18, 10, 0, 0);
  assert.equal(retryAfterMs('12', now), 12_000);
  assert.equal(retryAfterMs(0, now), 0);
  assert.equal(retryAfterMs('1.5', now), 1500);
  assert.equal(retryAfterMs('Sun, 18 Oct 2026 10:00:09 GMT', now), 9000);
  assert.equal(retryAfterMs('Sun, 18 Oct 2026 09:00:00 GMT', now), 0);
  for (const value of [null, undefined, '', 'garbage', '-1', Infinity, '1e309']) {
    assert.equal(retryAfterMs(value, now), null, `valor ${String(value)}`);
  }
});
