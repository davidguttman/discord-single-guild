class InstallQueue {
  constructor({ onIdle, schedule = setImmediate }) {
    if (typeof onIdle !== 'function') throw new TypeError('onIdle must be a function.');
    if (typeof schedule !== 'function') throw new TypeError('schedule must be a function.');
    this.onIdle = onIdle;
    this.schedule = schedule;
    this.pendingCount = 0;
    this.tail = Promise.resolve();
    this.idleGeneration = 0;
  }

  enqueue(operation) {
    if (typeof operation !== 'function') throw new TypeError('operation must be a function.');

    this.pendingCount += 1;
    this.idleGeneration += 1;
    const result = this.tail.then(operation);
    this.tail = result.catch(() => {});

    return result.finally(() => {
      this.pendingCount -= 1;
      if (this.pendingCount === 0) this.requestIdleCheck();
    });
  }

  requestIdleCheck() {
    if (this.pendingCount !== 0) return;
    const generation = ++this.idleGeneration;
    this.schedule(() => {
      if (this.pendingCount === 0 && this.idleGeneration === generation) this.onIdle();
    });
  }
}

module.exports = { InstallQueue };
