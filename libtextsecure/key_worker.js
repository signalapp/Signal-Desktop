'use strict';

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
                console.log(e.data.keys);
        }
    };
*/
var store = {};
window.textsecure.storage.impl = {
  /*****************************
   *** Override Storage Routines ***
   *****************************/
  put: function(key, value) {
    if (value === undefined) throw new Error('Tried to store undefined');
    store[key] = value;
    postMessage({ method: 'set', key: key, value: value });
  },

  get: function(key, defaultValue) {
    if (key in store) {
      return store[key];
    } else {
      return defaultValue;
    }
  },

  remove: function(key) {
    delete store[key];
    postMessage({ method: 'remove', key: key });
  },
};
onmessage = function(e) {
  store = e.data;
  textsecure.protocol_wrapper.generateKeys().then(function(keys) {
    postMessage({ method: 'done', keys: keys });
    close();
  });
};
