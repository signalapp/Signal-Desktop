/* global window */

// eslint-disable-next-line func-names
(function() {
  /** ***************************************
   *** Not-yet-processed message storage ***
   **************************************** */
  window.textsecure = window.textsecure || {};
  window.textsecure.storage = window.textsecure.storage || {};

  window.textsecure.storage.unprocessed = {
    getCount() {
      return window.Signal.Data.getUnprocessedCount();
    },
    getAll() {
      return window.Signal.Data.getAllUnprocessed();
    },
    get(id) {
      return window.Signal.Data.getUnprocessedById(id);
    },
    add(data) {
      return window.Signal.Data.saveUnprocessed(data, {
        forceSave: true,
      });
    },
    updateAttempts(id, attempts) {
      return window.Signal.Data.updateUnprocessedAttempts(id, attempts);
    },
    addDecryptedData(id, data) {
      return window.Signal.Data.updateUnprocessedWithData(id, data);
    },
    remove(id) {
      return window.Signal.Data.removeUnprocessed(id);
    },
    removeAll() {
      return window.Signal.Data.removeAllUnprocessed();
    },
  };
})();
