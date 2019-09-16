/* global window, textsecure, localStorage */

// eslint-disable-next-line func-names
(function() {
  /** **********************************************
   *** Utilities to store data in local storage ***
   *********************************************** */
  window.textsecure = window.textsecure || {};
  window.textsecure.storage = window.textsecure.storage || {};

  // Overrideable storage implementation
  window.textsecure.storage.impl = window.textsecure.storage.impl || {
    /** ***************************
     *** Base Storage Routines ***
     **************************** */
    put(key, value) {
      if (value === undefined) {
        throw new Error('Tried to store undefined');
      }
      localStorage.setItem(`${key}`, textsecure.utils.jsonThing(value));
    },

    get(key, defaultValue) {
      const value = localStorage.getItem(`${key}`);
      if (value === null) {
        return defaultValue;
      }
      return JSON.parse(value);
    },

    remove(key) {
      localStorage.removeItem(`${key}`);
    },
  };

  window.textsecure.storage.put = (key, value) =>
    textsecure.storage.impl.put(key, value);
  window.textsecure.storage.get = (key, defaultValue) =>
    textsecure.storage.impl.get(key, defaultValue);
  window.textsecure.storage.remove = key => textsecure.storage.impl.remove(key);
})();
