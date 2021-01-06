/* eslint-disable no-console */

// To replicate logic we have on the client side
global.window = {
  log: {
    info: (...args) => console.log(...args),
    warn: (...args) => console.warn(...args),
    error: (...args) => console.error(...args),
  },
  i18n: key => `i18n(${key})`,
};

// For ducks/network.getEmptyState()
global.navigator = {};
global.WebSocket = {};
