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
            var number = textsecure.utils.unencodeNumber(deviceObject.encodedNumber)[0];
            return textsecure.storage.axolotl.getIdentityKey(number).then(function(identityKey) {
                if (identityKey !== undefined && deviceObject.identityKey !== undefined && getString(identityKey) != getString(deviceObject.identityKey)) {
                    var error = new Error("Identity key changed");
                    error.identityKey = deviceObject.identityKey;
                    throw error;
                }

                return textsecure.storage.axolotl.putIdentityKey(number, deviceObject.identityKey).then(function() {
                    tempKeys[deviceObject.encodedNumber] = {
                        preKey:  deviceObject.preKey,
                        preKeyId: deviceObject.preKeyId,
                        signedKey: deviceObject.signedKey,
                        signedKeyId: deviceObject.signedKeyId,
                        signedKeySignature: deviceObject.signedKeySignature,
                        registrationId: deviceObject.registrationId
                    };
                });
            });
        },

        removeTempKeysFromDevice: function(encodedNumber) {
            delete tempKeys[encodedNumber];
            return Promise.resolve();
        },
        needKeysForDevice: function(encodedNumber) {
            if (tempKeys[encodedNumber] !== undefined) {
                return Promise.resolve(false);
            } else {
                return textsecure.protocol_wrapper.hasOpenSession(encodedNumber).then(function(result) {
                    return !result;
                });
            }
        },

        getDeviceObjectsForNumber: function(number) {
            return textsecure.storage.axolotl.getIdentityKey(number).then(function(identityKey) {
                if (identityKey === undefined) {
                    return [];
                }
                return textsecure.storage.axolotl.getDeviceIds(number).then(function(deviceIds) {
                    // Add pending devices from tempKeys
                    for (var encodedNumber in tempKeys) {
                        var deviceNumber = textsecure.utils.unencodeNumber(encodedNumber)[0];
                        var deviceId = parseInt(textsecure.utils.unencodeNumber(encodedNumber)[1]);
                        if (deviceNumber === number && deviceIds.indexOf(deviceId) < 0) {
                            deviceIds.push(deviceId);
                        }
                    }
                    return deviceIds.map(function(deviceId) {
                        var encodedNumber = number + '.' + deviceId;
                        var deviceObject = tempKeys[encodedNumber] || {};
                        deviceObject.encodedNumber = encodedNumber;
                        deviceObject.identityKey = identityKey;
                        return deviceObject;
                    });
                });
            });
        },

        removeDeviceIdsForNumber: function(number, deviceIdsToRemove) {
            var promise = Promise.resolve();
            for (var j in deviceIdsToRemove) {
                promise = promise.then(function() {
                    var encodedNumber = number + "." + deviceIdsToRemove[j];
                    delete tempKeys[encodedNumber];
                    return textsecure.storage.axolotl.removeSession(encodedNumber);
                });
            }
            return promise;
        }
    };
})();
