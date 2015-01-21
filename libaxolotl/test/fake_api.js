'use strict';

var testSessionMap = {};
var testIdentityKeysMap = {};

;(function() {
    window.axolotl = window.axolotl || {};
    window.axolotl.api = {
        getMyRegistrationId: function() {
            return window.myRegistrationId;
        },
        storage: {
            put: function(key, value) {
                if (value === undefined)
                    throw new Error("Tried to store undefined");
                localStorage.setItem(key, textsecure.utils.jsonThing(value));
            },
            get: function(key, defaultValue) {
                var value = localStorage.getItem(key);
                if (value === null)
                    return defaultValue;
                return JSON.parse(value);
            },
            remove: function(key) {
                localStorage.removeItem(key);
            },

            identityKeys: {
                get: function(identifier) {
                    return testIdentityKeysMap[identifier];
                },
                put: function(identifier, identityKey) {
                    testIdentityKeysMap[identifier] = identityKey;
                },
            },

            sessions: {
                get: function(identifier) {
                    return testSessionMap[identifier];
                },
                put: function(identifier, record) {
                    testSessionMap[identifier] = record;
                }
            }
        },
        updateKeys: function(keys) {
            return textsecure.api.registerKeys(keys).catch(function(e) {
                //TODO: Notify the user somehow?
                console.error(e);
            });
        },
    };
})();
