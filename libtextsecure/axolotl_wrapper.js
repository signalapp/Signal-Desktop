//TODO: Remove almost everything here...

'use strict';

;(function() {
    window.axolotl = window.axolotl || {};
    window.axolotl.api = {
        getMyIdentifier: function() {
            return textsecure.utils.unencodeNumber(textsecure.storage.getUnencrypted("number_id"))[0];
        },
        isIdentifierSane: function(identifier) {
            return textsecure.utils.isNumberSane(identifier);
        },
        storage: {
            put: function(key, value) {
                return textsecure.storage.putEncrypted(key, value);
            },
            get: function(key, defaultValue) {
                return textsecure.storage.getEncrypted(key, defaultValue);
            },
            remove: function(key) {
                return textsecure.storage.removeEncrypted(key);
            },
        },
    };
})();
