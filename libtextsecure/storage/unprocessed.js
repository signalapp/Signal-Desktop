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
    batchAdd(array) {
      return textsecure.storage.protocol.addMultipleUnprocessed(array);
    },
    updateAttempts(id, attempts) {
      return textsecure.storage.protocol.updateUnprocessedAttempts(
        id,
        attempts
      );
    },
    addDecryptedData(id, data) {
      return textsecure.storage.protocol.updateUnprocessedWithData(id, data);
    },
    addDecryptedDataToList(array) {
      return textsecure.storage.protocol.updateUnprocessedsWithData(array);
    },
    remove(idOrArray) {
      return textsecure.storage.protocol.removeUnprocessed(idOrArray);
    },
    removeAll() {
      return textsecure.storage.protocol.removeAllUnprocessed();
    },
  };
})();
