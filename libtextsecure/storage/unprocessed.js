;(function() {
    'use strict';

    /*****************************************
     *** Not-yet-processed message storage ***
     *****************************************/
    window.textsecure = window.textsecure || {};
    window.textsecure.storage = window.textsecure.storage || {};

    window.textsecure.storage.unprocessed = {
        getAll: function() {
            return textsecure.storage.protocol.getAllUnprocessed();
        },
        add: function(data) {
            return textsecure.storage.protocol.addUnprocessed(data);
        },
        update: function(id, updates) {
            return textsecure.storage.protocol.updateUnprocessed(id, updates);
        },
        remove: function(id) {
            return textsecure.storage.protocol.removeUnprocessed(id);
        },
    };
})();
