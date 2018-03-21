const desktopIdle = require('desktop-idle');
const EventEmitter = require('events');


const POLL_INTERVAL = 10; // seconds
const IDLE_THRESHOLD = POLL_INTERVAL;

class IdleDetector extends EventEmitter {
  constructor() {
    super();
    this.intervalId = null;
  }

  start() {
    this.stop();
    this.intervalId = setInterval(() => {
      const idleDurationInSeconds = desktopIdle.getIdleTime();
      const isIdle = idleDurationInSeconds >= IDLE_THRESHOLD;
      if (!isIdle) {
        return;
      }

      this.emit('idle', { idleDurationInSeconds });

    }, POLL_INTERVAL * 1000);
  }

  stop() {
    if (!this.intervalId) {
      return;
    }

    clearInterval(this.intervalId);
  }
}

module.exports = {
  IdleDetector,
};
