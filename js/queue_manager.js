/* eslint-disable more/no-then */

// eslint-disable-next-line func-names
(function() {
  'use strict';

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

  window.JobQueue = JobQueue;
})();
