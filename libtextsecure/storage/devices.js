/* vim: ts=4:sw=4
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
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
        },

        removeTempKeysFromDevice: function(encodedNumber) {
            delete tempKeys[encodedNumber];
            return Promise.resolve();
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
