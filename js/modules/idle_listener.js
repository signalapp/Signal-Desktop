const desktopIdle = require('desktop-idle');
const EventEmitter = require('events');


const POLL_INTERVAL_MS = 10 * 1000;
const IDLE_THRESHOLD_MS = POLL_INTERVAL_MS;

class IdleListener extends EventEmitter {
  constructor() {
    super();
    this.intervalId = null;
  }

  start() {
    this.stop();
    this.intervalId = setInterval(() => {
      const idleDuration = desktopIdle.getIdleTime();
      const isIdle = idleDuration >= (IDLE_THRESHOLD_MS / 1000);
      if (!isIdle) {
        return;
      }

      this.emit('idle', { idleDuration });

    }, POLL_INTERVAL_MS);
  }

  stop() {
    if (!this.intervalId) {
      return;
    }

    clearInterval(this.intervalId);
  }
}

module.exports = {
  IdleListener,
};
