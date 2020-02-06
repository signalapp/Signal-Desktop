/* global window, postMessage, textsecure, close */

/* eslint-disable more/no-then, no-global-assign, no-restricted-globals, no-unused-vars */

/*
*  Load this script in a Web Worker to generate new prekeys without
*  tying up the main thread.
*  https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API
*
*  Because workers don't have access to the window or localStorage, we
*  create our own version that proxies back to the caller for actual
*  storage.
*
*  Example usage:
*
    var myWorker = new Worker('/js/key_worker.js');
    myWorker.onmessage = function(e) {
        switch(e.data.method) {
            case 'set':
                localStorage.setItem(e.data.key, e.data.value);
                break;
            case 'remove':
                localStorage.removeItem(e.data.key);
                break;
            case 'done':
                console.error(e.data.keys);
        }
    };
*/
let store = {};
window.textsecure.storage.impl = {
  /** ***************************
   *** Override Storage Routines ***
   **************************** */
  put(key, value) {
    if (value === undefined) {
      throw new Error('Tried to store undefined');
    }
    store[key] = value;
    postMessage({ method: 'set', key, value });
  },

  get(key, defaultValue) {
    if (key in store) {
      return store[key];
    }
    return defaultValue;
  },

  remove(key) {
    delete store[key];
    postMessage({ method: 'remove', key });
  },
};
// eslint-disable-next-line no-undef
onmessage = e => {
  store = e.data;
  textsecure.protocol_wrapper.generateKeys().then(keys => {
    postMessage({ method: 'done', keys });
    close();
  });
};
