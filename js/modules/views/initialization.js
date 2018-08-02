/* eslint-env browser */

/* global i18n: false */

const DISPLAY_THRESHOLD = 3000; // milliseconds
const SELECTOR = '.app-loading-screen .message';

let timeout;
let targetString;
let didTimeout = false;

const clear = () => {
  if (timeout) {
    clearTimeout(timeout);
    timeout = null;
  }
};

const setMessage = loadingText => {
  const message = document.querySelector(SELECTOR);
  if (!message) {
    return clear;
  }

  targetString = loadingText || i18n('optimizingApplication');

  message.innerText = didTimeout ? targetString : i18n('loading');

  if (timeout) {
    return clear;
  }

  timeout = setTimeout(() => {
    didTimeout = true;
    const innerMessage = document.querySelector(SELECTOR);
    if (!innerMessage) {
      return;
    }
    innerMessage.innerText = targetString;
  }, DISPLAY_THRESHOLD);

  return clear;
};

module.exports = {
  setMessage,
};
