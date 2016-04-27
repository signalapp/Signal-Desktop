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

    var tempKeys = {};

    window.textsecure.storage.devices = {
        saveKeysToDeviceObject: function(deviceObject) {
            return textsecure.protocol_wrapper.processPreKey(deviceObject).then(function() {
                tempKeys[deviceObject.encodedNumber] = deviceObject;
            });
        },

        removeTempKeysFromDevice: function(encodedNumber) {
            delete tempKeys[encodedNumber];
            return Promise.resolve();
        },

        getStaleDeviceIdsForNumber: function(number) {
            return textsecure.storage.protocol.getDeviceIds(number).then(function(deviceIds) {
                if (deviceIds.length === 0) {
                    return [1];
                }
                var updateDevices = [];
                return Promise.all(deviceIds.map(function(deviceId) {
                    var encodedNumber = number + '.' + deviceId;
                    return textsecure.protocol_wrapper.hasOpenSession(encodedNumber).then(function(hasSession) {
                        if (!hasSession && !tempKeys[encodedNumber]) {
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
                    // Add pending devices from tempKeys
                    for (var encodedNumber in tempKeys) {
                        var deviceNumber = textsecure.utils.unencodeNumber(encodedNumber)[0];
                        var deviceId = parseInt(textsecure.utils.unencodeNumber(encodedNumber)[1]);
                        if (deviceNumber === number && deviceIds.indexOf(deviceId) < 0) {
                            deviceIds.push(deviceId);
                        }
                    }
                    return Promise.all(deviceIds.map(function(deviceId) {
                        var encodedNumber = number + '.' + deviceId;
                        var deviceObject = tempKeys[encodedNumber] || {};
                        deviceObject.encodedNumber = encodedNumber;
                        deviceObject.identityKey = identityKey;
                        return textsecure.protocol_wrapper.getRegistrationId(encodedNumber).then(function(registrationId) {
                            if (deviceObject.registrationId === undefined) {
                                deviceObject.registrationId = registrationId;
                            }
                            return deviceObject;
                        });
                    }));
                });
            });
        },

        removeDeviceIdsForNumber: function(number, deviceIdsToRemove) {
            var promise = Promise.resolve();
            for (var j in deviceIdsToRemove) {
                promise = promise.then(function() {
                    var encodedNumber = number + "." + deviceIdsToRemove[j];
                    delete tempKeys[encodedNumber];
                    return textsecure.storage.protocol.removeSession(encodedNumber);
                });
            }
            return promise;
        }
    };
})();
