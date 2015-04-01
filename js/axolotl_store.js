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
;(function() {
    'use strict';

    function isStringable(thing) {
        return (thing === Object(thing) &&
                    (thing.__proto__ == StaticArrayBufferProto ||
                    thing.__proto__ == StaticUint8ArrayProto ||
                    thing.__proto__ == StaticByteBufferProto));
    }
    function convertToArrayBuffer(thing) {
        if (thing === undefined)
            return undefined;
        if (thing === Object(thing)) {
            if (thing.__proto__ == StaticArrayBufferProto)
                return thing;
            //TODO: Several more cases here...
        }

        if (thing instanceof Array) {
            // Assuming Uint16Array from curve25519
            //TODO: Move to convertToArrayBuffer
            var res = new ArrayBuffer(thing.length * 2);
            var uint = new Uint16Array(res);
            for (var i = 0; i < thing.length; i++)
                uint[i] = thing[i];
            return res;
        }

        var str;
        if (isStringable(thing))
            str = stringObject(thing);
        else if (typeof thing == "string")
            str = thing;
        else
            throw new Error("Tried to convert a non-stringable thing of type " + typeof thing + " to an array buffer");
        var res = new ArrayBuffer(str.length);
        var uint = new Uint8Array(res);
        for (var i = 0; i < str.length; i++)
            uint[i] = str.charCodeAt(i);
        return res;
    }

    var Model = Backbone.Model.extend({ database: Whisper.Database });
    var PreKey = Model.extend({ storeName: 'preKeys' });
    var SignedPreKey = Model.extend({ storeName: 'signedPreKeys' });

    function AxolotlStore() {}

    AxolotlStore.prototype = {
        constructor: AxolotlStore,
        get: function(key,defaultValue) {
            return textsecure.storage.get(key, defaultValue);
        },
        put: function(key, value) {
            textsecure.storage.put(key, value);
        },
        remove: function(key) {
            textsecure.storage.remove(key);
        },
        getMyIdentityKey: function() {
            var res = textsecure.storage.get('identityKey');
            if (res === undefined)
                return undefined;

            return {
                pubKey: convertToArrayBuffer(res.pubKey),
                privKey: convertToArrayBuffer(res.privKey)
            };
        },
        getMyRegistrationId: function() {
                return textsecure.storage.get('registrationId');
        },

        getIdentityKey: function(identifier) {
            if (identifier === null || identifier === undefined)
                throw new Error("Tried to get identity key for undefined/null key");
            return Promise.resolve(convertToArrayBuffer(textsecure.storage.devices.getIdentityKeyForNumber(textsecure.utils.unencodeNumber(identifier)[0])));
        },
        putIdentityKey: function(identifier, identityKey) {
            if (identifier === null || identifier === undefined)
                throw new Error("Tried to put identity key for undefined/null key");
            return Promise.resolve(textsecure.storage.devices.checkSaveIdentityKeyForNumber(textsecure.utils.unencodeNumber(identifier)[0], identityKey));
        },

        /* Returns a prekeypair object or undefined */
        getPreKey: function(keyId) {
            var prekey = new PreKey({id: keyId});
            return new Promise(function(resolve) {
                prekey.fetch().then(function() {
                    resolve({
                        pubKey: prekey.attributes.publicKey,
                        privKey: prekey.attributes.privateKey
                    });
                }).fail(resolve);
            });
        },
        putPreKey: function(keyId, keyPair) {
            var prekey = new PreKey({
                id         : keyId,
                publicKey  : keyPair.pubKey,
                privateKey : keyPair.privKey
            });
            return new Promise(function(resolve) {
                prekey.save().always(function() {
                    resolve();
                });
            });
        },
        removePreKey: function(keyId) {
            var prekey = new PreKey({id: keyId});
            return new Promise(function(resolve) {
                prekey.destroy().then(function() {
                    resolve();
                });
            });
        },

        /* Returns a signed keypair object or undefined */
        getSignedPreKey: function(keyId) {
            var prekey = new SignedPreKey({id: keyId});
            return new Promise(function(resolve) {
                prekey.fetch().then(function() {
                    resolve({
                        pubKey: prekey.attributes.publicKey,
                        privKey: prekey.attributes.privateKey
                    });
                }).fail(resolve);
            });
        },
        putSignedPreKey: function(keyId, keyPair) {
            var prekey = new SignedPreKey({
                id         : keyId,
                publicKey  : keyPair.pubKey,
                privateKey : keyPair.privKey
            });
            return new Promise(function(resolve) {
                prekey.save().always(function() {
                    resolve();
                });
            });
        },
        removeSignedPreKey: function(keyId) {
            var prekey = new SignedPreKey({id: keyId});
            return new Promise(function(resolve) {
                prekey.destroy().then(function() {
                    resolve();
                });
            });
        },

        getSession: function(identifier) {
            if (identifier === null || identifier === undefined)
                throw new Error("Tried to get session for undefined/null key");
            return new Promise(function(resolve) {
                resolve(textsecure.storage.sessions.getSessionsForNumber(identifier));
            });
        },
        putSession: function(identifier, record) {
            if (identifier === null || identifier === undefined)
                throw new Error("Tried to put session for undefined/null key");
            return new Promise(function(resolve) {
                resolve(textsecure.storage.sessions.putSessionsForDevice(identifier, record));
            });
        }
    };

    window.AxolotlStore = AxolotlStore;
})();
