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

    window.textsecure.storage.devices = {
        saveDeviceObject: function(deviceObject) {
            return internalSaveDeviceObject(deviceObject, false);
        },

        saveKeysToDeviceObject: function(deviceObject) {
            return internalSaveDeviceObject(deviceObject, true);
        },

        removeTempKeysFromDevice: function(encodedNumber) {
            var deviceObject = textsecure.storage.devices.getDeviceObject(encodedNumber);
            try {
                delete deviceObject['signedKey'];
                delete deviceObject['signedKeyId'];
                delete deviceObject['signedKeySignature'];
                delete deviceObject['preKey'];
                delete deviceObject['preKeyId'];
                delete deviceObject['registrationId'];
            } catch(_) {}
            return internalSaveDeviceObject(deviceObject, false);
        },

        getDeviceObjectsForNumber: function(number) {
            var map = textsecure.storage.getEncrypted("devices" + number);
            if (map === undefined)
               return [];
            for (key in map.devices) {
                if (map.devices[key].sessions !== undefined) {
                    var record = new axolotl.sessions.RecipientRecord();
                    record.deserialize(map.devices[key].sessions);
                    if (getString(map.identityKey) !== getString(record.identityKey))
                        throw new Error("Got mismatched identity key on device object load");
                    map.devices[key].sessions = record;
                }
            }
            return map.devices;
        },

        getIdentityKeyForNumber: function(number) {
            var map = textsecure.storage.getEncrypted("devices" + number);
            return map === undefined ? undefined : map.identityKey;
        },

        checkSaveIdentityKeyForNumber: function(number, identityKey) {
            var map = textsecure.storage.getEncrypted("devices" + number);
            if (map === undefined)
                textsecure.storage.putEncrypted("devices" + number, { devices: [], identityKey: identityKey});
            else if (getString(map.identityKey) !== getString(identityKey))
                throw new Error("Attempted to overwrite a different identity key");
        },

        removeIdentityKeyForNumber: function(number) {
            var map = textsecure.storage.getEncrypted("devices" + number);
            if (map === undefined)
                throw new Error("Tried to remove identity for unknown number");
            textsecure.storage.removeEncrypted("devices" + number);
        },

        getDeviceObject: function(encodedNumber, returnIdentityKey) {
            var number = textsecure.utils.unencodeNumber(encodedNumber)[0];
            var devices = textsecure.storage.devices.getDeviceObjectsForNumber(number);
            if (devices.length == 0) {
                if (returnIdentityKey) {
                    var identityKey = textsecure.storage.devices.getIdentityKeyForNumber(number);
                    if (identityKey !== undefined)
                        return {identityKey: identityKey};
                }
                return undefined;
            }

            for (var i in devices)
                if (devices[i].encodedNumber == encodedNumber)
                    return devices[i];

            if (returnIdentityKey)
                return {identityKey: devices[0].identityKey};

            return undefined;
        },

        removeDeviceIdsForNumber: function(number, deviceIdsToRemove) {
            var map = textsecure.storage.getEncrypted("devices" + number);
            if (map === undefined)
                throw new Error("Tried to remove device for unknown number");

            var newDevices = [];
            var devicesRemoved = 0;
            for (var i in map.devices) {
                var keep = true;
                for (var j in deviceIdsToRemove)
                    if (map.devices[i].encodedNumber == number + "." + deviceIdsToRemove[j])
                        keep = false;

                if (keep)
                    newDevices.push(map.devices[i]);
                else
                    devicesRemoved++;
            }

            if (devicesRemoved != deviceIdsToRemove.length)
                throw new Error("Tried to remove unknown device");

            if (newDevices.length === 0)
                textsecure.storage.removeEncrypted("devices" + number);
            else {
                map.devices = newDevices;
                textsecure.storage.putEncrypted("devices" + number, map);
            }
        }
    };

    var internalSaveDeviceObject = function(deviceObject, onlyKeys) {
        if (deviceObject.identityKey === undefined || deviceObject.encodedNumber === undefined)
            throw new Error("Tried to store invalid deviceObject");

        var number = textsecure.utils.unencodeNumber(deviceObject.encodedNumber)[0];
        var map = textsecure.storage.getEncrypted("devices" + number);

        if (deviceObject.sessions !== undefined)
            deviceObject.sessions = deviceObject.sessions.serialize()

        if (map === undefined)
            map = { devices: [deviceObject], identityKey: deviceObject.identityKey };
        else if (map.identityKey != getString(deviceObject.identityKey))
            throw new Error("Identity key changed");
        else {
            var updated = false;
            for (var i in map.devices) {
                if (map.devices[i].encodedNumber == deviceObject.encodedNumber) {
                    if (!onlyKeys)
                        map.devices[i] = deviceObject;
                    else {
                        map.devices[i].preKey = deviceObject.preKey;
                        map.devices[i].preKeyId = deviceObject.preKeyId;
                        map.devices[i].signedKey = deviceObject.signedKey;
                        map.devices[i].signedKeyId = deviceObject.signedKeyId;
                        map.devices[i].signedKeySignature = deviceObject.signedKeySignature;
                        map.devices[i].registrationId = deviceObject.registrationId;
                    }
                    updated = true;
                }
            }

            if (!updated)
                map.devices.push(deviceObject);
        }

        textsecure.storage.putEncrypted("devices" + number, map);
    };
})();
