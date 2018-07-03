/* eslint-env browser */

const EventEmitter = require('events');

const POLL_INTERVAL_MS = 5 * 1000;
const IDLE_THRESHOLD_MS = 20;

class IdleDetector extends EventEmitter {
  constructor() {
    super();
    this.handle = null;
    this.timeoutId = null;
  }

  start() {
    console.log('Start idle detector');
    this._scheduleNextCallback();
  }

  stop() {
    if (!this.handle) {
      return;
    }

    console.log('Stop idle detector');
    this._clearScheduledCallbacks();
  }

  _clearScheduledCallbacks() {
    if (this.handle) {
      cancelIdleCallback(this.handle);
      this.handle = null;
    }

    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  _scheduleNextCallback() {
    this._clearScheduledCallbacks();
    this.handle = window.requestIdleCallback(deadline => {
      const { didTimeout } = deadline;
      const timeRemaining = deadline.timeRemaining();
      const isIdle = timeRemaining >= IDLE_THRESHOLD_MS;
      this.timeoutId = setTimeout(
        () => this._scheduleNextCallback(),
        POLL_INTERVAL_MS
      );
      if (isIdle || didTimeout) {
        this.emit('idle', { timestamp: Date.now(), didTimeout, timeRemaining });
      }
    });
  }
}

module.exports = {
  IdleDetector,
};
