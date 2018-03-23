/* eslint-env browser */

const EventEmitter = require('events');


const POLL_INTERVAL_MS = 30 * 1000;
const IDLE_THRESHOLD_MS = 25;

class IdleDetector extends EventEmitter {
  constructor() {
    super();
    this.handle = null;
    this.timeoutId = null;
  }

  start() {
    this._scheduleNextCallback();
  }

  stop() {
    if (this.handle) {
      cancelIdleCallback(this.handle);
    }

    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }
  }

  _scheduleNextCallback() {
    this.stop();
    this.handle = window.requestIdleCallback((deadline) => {
      const { didTimeout } = deadline;
      const timeRemaining = deadline.timeRemaining();
      const isIdle = timeRemaining >= IDLE_THRESHOLD_MS;
      if (isIdle || didTimeout) {
        this.emit('idle', { timestamp: Date.now(), didTimeout, timeRemaining });
      }
      this.timeoutId = setTimeout(() => this._scheduleNextCallback(), POLL_INTERVAL_MS);
    });
  }
}

module.exports = {
  IdleDetector,
};
