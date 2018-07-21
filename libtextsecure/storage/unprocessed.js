/* global window, textsecure */

// eslint-disable-next-line func-names
(function() {
  /** ***************************************
   *** Not-yet-processed message storage ***
   **************************************** */
  window.textsecure = window.textsecure || {};
  window.textsecure.storage = window.textsecure.storage || {};

  window.textsecure.storage.unprocessed = {
    getAll() {
      return textsecure.storage.protocol.getAllUnprocessed();
    },
    add(data) {
      return textsecure.storage.protocol.addUnprocessed(data);
    },
    update(id, updates) {
      return textsecure.storage.protocol.updateUnprocessed(id, updates);
    },
    remove(id) {
      return textsecure.storage.protocol.removeUnprocessed(id);
    },
  };
})();
