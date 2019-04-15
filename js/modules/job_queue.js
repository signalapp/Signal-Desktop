/* eslint-disable more/no-then */
class JobQueue {
  constructor() {
    this.pending = Promise.resolve();
  }

  add(job) {
    const previous = this.pending || Promise.resolve();
    this.pending = previous.then(job, job);
    const current = this.pending;

    current.then(() => {
      if (this.pending === current) {
        delete this.pending;
      }
    });

    return current;
  }
}

module.exports = {
  JobQueue,
}
