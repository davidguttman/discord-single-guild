const test = require('node:test');
const assert = require('node:assert/strict');

const { InstallQueue } = require('../src/install-queue');

function deferred() {
  let resolve;
  const promise = new Promise((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

test('idle notification waits for queued installs and is invalidated by a newly forwarded install', async () => {
  const scheduled = [];
  let idleNotifications = 0;
  const queue = new InstallQueue({
    onIdle: () => {
      idleNotifications += 1;
    },
    schedule: (callback) => scheduled.push(callback),
  });
  const first = deferred();
  const second = deferred();
  const third = deferred();
  const started = [];

  const firstResult = queue.enqueue(async () => {
    started.push('first');
    await first.promise;
  });
  const secondResult = queue.enqueue(async () => {
    started.push('second');
    await second.promise;
  });

  await Promise.resolve();
  assert.deepEqual(started, ['first']);
  assert.equal(queue.pendingCount, 2);

  first.resolve();
  await firstResult;
  await Promise.resolve();
  assert.deepEqual(started, ['first', 'second']);
  assert.equal(scheduled.length, 0);

  second.resolve();
  await secondResult;
  assert.equal(queue.pendingCount, 0);
  assert.equal(scheduled.length, 1);

  const thirdResult = queue.enqueue(async () => {
    started.push('third');
    await third.promise;
  });
  scheduled.shift()();
  assert.equal(idleNotifications, 0);
  assert.equal(queue.pendingCount, 1);

  third.resolve();
  await thirdResult;
  assert.equal(scheduled.length, 1);
  scheduled.shift()();
  assert.equal(idleNotifications, 1);
});
