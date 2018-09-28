/* global window, textsecure */

// eslint-disable-next-line func-names
(function() {
  /** ***************************************
   *** Not-yet-processed message storage ***
   **************************************** */
  window.textsecure = window.textsecure || {};
  window.textsecure.storage = window.textsecure.storage || {};

  window.textsecure.storage.unprocessed = {
    getCount() {
      return textsecure.storage.protocol.getUnprocessedCount();
    },
    getAll() {
      return textsecure.storage.protocol.getAllUnprocessed();
    },
    get(id) {
      return textsecure.storage.protocol.getUnprocessedById(id);
    },
    add(data) {
      return textsecure.storage.protocol.addUnprocessed(data);
    },
    save(data) {
      return textsecure.storage.protocol.saveUnprocessed(data);
    },
    remove(id) {
      return textsecure.storage.protocol.removeUnprocessed(id);
    },
    removeAll() {
      return textsecure.storage.protocol.removeAllUnprocessed();
    },
  };
})();
