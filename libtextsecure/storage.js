'use strict';

;(function() {

    /************************************************
    *** Utilities to store data in local storage ***
    ************************************************/
    window.textsecure = window.textsecure || {};
    window.textsecure.storage = window.textsecure.storage || {};

    // Overrideable storage implementation
    window.textsecure.storage.impl = window.textsecure.storage.impl || {
        /*****************************
        *** Base Storage Routines ***
        *****************************/
        put: function(key, value) {
            if (value === undefined)
                throw new Error("Tried to store undefined");
            localStorage.setItem("" + key, textsecure.utils.jsonThing(value));
        },

        get: function(key, defaultValue) {
            var value = localStorage.getItem("" + key);
            if (value === null)
                return defaultValue;
            return JSON.parse(value);
        },

        remove: function(key) {
            localStorage.removeItem("" + key);
        },
    };

    window.textsecure.storage.put = function(key, value) {
        return textsecure.storage.impl.put(key, value);
    };

    window.textsecure.storage.get = function(key, defaultValue) {
        return textsecure.storage.impl.get(key, defaultValue);
    };

    window.textsecure.storage.remove = function(key) {
        return textsecure.storage.impl.remove(key);
    };
})();

