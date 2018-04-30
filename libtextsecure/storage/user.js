'use strict';

;(function() {
    /*********************************************
    *** Utilities to store data about the user ***
    **********************************************/
    window.textsecure = window.textsecure || {};
    window.textsecure.storage = window.textsecure.storage || {};

    window.textsecure.storage.user = {
        setNumberAndDeviceId: function(number, deviceId, deviceName) {
            textsecure.storage.put("number_id", number + "." + deviceId);
            if (deviceName) {
                textsecure.storage.put("device_name", deviceName);
            }
        },

        getNumber: function(key, defaultValue) {
            var number_id = textsecure.storage.get("number_id");
            if (number_id === undefined)
                return undefined;
            return textsecure.utils.unencodeNumber(number_id)[0];
        },

        getDeviceId: function(key) {
            var number_id = textsecure.storage.get("number_id");
            if (number_id === undefined)
                return undefined;
            return textsecure.utils.unencodeNumber(number_id)[1];
        },

        getDeviceName: function(key) {
            return textsecure.storage.get("device_name");
        }
    };
})();
