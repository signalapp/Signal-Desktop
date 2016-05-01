/*
 * vim: ts=4:sw=4:expandtab
 */

'use strict';

;(function() {
    /**********************
    *** Device Storage ***
    **********************/
    window.textsecure = window.textsecure || {};
    window.textsecure.storage = window.textsecure.storage || {};

    window.textsecure.storage.devices = {
        getStaleDeviceIdsForNumber: function(number) {
            return textsecure.storage.protocol.getDeviceIds(number).then(function(deviceIds) {
                if (deviceIds.length === 0) {
                    return [1];
                }
                var updateDevices = [];
                return Promise.all(deviceIds.map(function(deviceId) {
                    var address = new libsignal.SignalProtocolAddress(number, deviceId);
                    var sessionCipher =  new libsignal.SessionCipher(textsecure.storage.protocol, address);
                    return sessionCipher.hasOpenSession().then(function(hasSession) {
                        if (!hasSession) {
                            updateDevices.push(deviceId);
                        }
                    });
                })).then(function() {
                    return updateDevices;
                });
            });
        },
        getDeviceObjectsForNumber: function(number) {
            return textsecure.storage.protocol.loadIdentityKey(number).then(function(identityKey) {
                if (identityKey === undefined) {
                    return [];
                }
                return textsecure.storage.protocol.getDeviceIds(number).then(function(deviceIds) {
                    return Promise.all(deviceIds.map(function(deviceId) {
                        var address = new libsignal.SignalProtocolAddress(number, deviceId).toString();
                        return { encodedNumber  : address };
                    }));
                });
            });
        },

        removeDeviceIdsForNumber: function(number, deviceIdsToRemove) {
            var promise = Promise.resolve();
            for (var j in deviceIdsToRemove) {
                promise = promise.then(function() {
                    var encodedNumber = number + "." + deviceIdsToRemove[j];
                    return textsecure.storage.protocol.removeSession(encodedNumber);
                });
            }
            return promise;
        }
    };
})();
