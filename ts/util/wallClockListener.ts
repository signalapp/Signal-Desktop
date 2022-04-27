let lastTime = Date.now();
const interval = 10 * 1000;
let timeTravelListener: (() => void) | undefined;

function checkTime() {
  const currentTime = Date.now();
  if (currentTime > lastTime + interval * 2) {
    if (!timeTravelListener) {
      throw new Error('timeTravelListener should have been set in initWallClockListener');
    }
    timeTravelListener();
  }
  lastTime = currentTime;
}

export const initWallClockListener = (onTimeTravelDetectedListener: () => void) => {
  if (timeTravelListener) {
    throw new Error('Wall clock listener already init');
  }
  timeTravelListener = onTimeTravelDetectedListener;
  global.setInterval(checkTime, interval);
};
