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

    function equalArrayBuffers(ab1, ab2) {
        if (!(ab1 instanceof ArrayBuffer && ab2 instanceof ArrayBuffer)) {
            return false;
        }
        if (ab1.byteLength !== ab2.byteLength) {
            return false;
        }
        var result = true;
        var ta1 = new Uint8Array(ab1);
        var ta2 = new Uint8Array(ab2);
        for (var i = 0; i < ab1.byteLength; ++i) {
            if (ta1[i] !== ta2[i]) { result = false; }
        }
        return result;
    }

    var Model = Backbone.Model.extend({ database: Whisper.Database });
    var PreKey = Model.extend({ storeName: 'preKeys' });
    var SignedPreKey = Model.extend({ storeName: 'signedPreKeys' });
    var Session = Model.extend({ storeName: 'sessions' });
    var SessionCollection = Backbone.Collection.extend({
        storeName: 'sessions',
        database: Whisper.Database,
        model: Session,
        fetchSessionsForNumber: function(number) {
            return this.fetch({range: [number + '.1', number + '.' + ':']});
        }
    });
    var IdentityKey = Model.extend({ storeName: 'identityKeys' });
    var Group = Model.extend({ storeName: 'groups' });
    var Item = Model.extend({ storeName: 'items' });

    function AxolotlStore() {}

    AxolotlStore.prototype = {
        constructor: AxolotlStore,
        getMyIdentityKey: function() {
            var item = new Item({id: 'identityKey'});
            return new Promise(function(resolve) {
                item.fetch().then(function() {
                    resolve(item.get('value'));
                });
            });
        },
        getMyRegistrationId: function() {
            var item = new Item({id: 'registrationId'});
            return new Promise(function(resolve) {
                item.fetch().then(function() {
                    resolve(item.get('value'));
                });
            });
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

            new Promise(function(resolve) {
                var accountManager = new textsecure.AccountManager();
                accountManager.refreshPreKeys().then(resolve);
            });

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

        getSession: function(encodedNumber) {
            if (encodedNumber === null || encodedNumber === undefined)
                throw new Error("Tried to get session for undefined/null key");
            return new Promise(function(resolve) {
                var session = new Session({id: encodedNumber});
                session.fetch().always(function() {
                    resolve(session.get('record'));
                });

            });
        },
        putSession: function(encodedNumber, record) {
            if (encodedNumber === null || encodedNumber === undefined)
                throw new Error("Tried to put session for undefined/null key");
            return new Promise(function(resolve) {
                var number = textsecure.utils.unencodeNumber(encodedNumber)[0];
                var deviceId = parseInt(textsecure.utils.unencodeNumber(encodedNumber)[1]);

                var session = new Session({id: encodedNumber});
                session.fetch().always(function() {
                    session.save({
                        record: record,
                        deviceId: deviceId,
                        number: number
                    }).always(resolve);
                });
            });
        },
        getDeviceIds: function(number) {
            if (number === null || number === undefined)
                throw new Error("Tried to put session for undefined/null key");
            return new Promise(function(resolve) {
                var sessions = new SessionCollection();
                sessions.fetchSessionsForNumber(number).always(function() {
                    resolve(sessions.pluck('deviceId'));
                });
            });
        },
        removeSession: function(encodedNumber) {
            return new Promise(function(resolve) {
                var session = new Session({id: encodedNumber});
                session.fetch().then(function() {
                    session.destroy().then(resolve);
                });
            });
        },
        removeAllSessions: function(number) {
            if (number === null || number === undefined)
                throw new Error("Tried to put session for undefined/null key");
            return new Promise(function(resolve) {
                var sessions = new SessionCollection();
                sessions.fetchSessionsForNumber(number).always(function() {
                    var promises = [];
                    while(sessions.length > 0) {
                        promises.push(new Promise(function(res) {
                            sessions.pop().destroy().then(res);
                        }));
                    }
                    Promise.all(promises).then(resolve);
                });
            });
        },
        getIdentityKey: function(identifier) {
            if (identifier === null || identifier === undefined)
                throw new Error("Tried to get identity key for undefined/null key");
            var number = textsecure.utils.unencodeNumber(identifier)[0];
            return new Promise(function(resolve) {
                var identityKey = new IdentityKey({id: number});
                identityKey.fetch().always(function() {
                    resolve(identityKey.get('publicKey'));
                });
            });
        },
        putIdentityKey: function(identifier, publicKey) {
            if (identifier === null || identifier === undefined)
                throw new Error("Tried to put identity key for undefined/null key");
            if (!(publicKey instanceof ArrayBuffer)) {
                publicKey = convertToArrayBuffer(publicKey);
            }
            var number = textsecure.utils.unencodeNumber(identifier)[0];
            return new Promise(function(resolve) {
                var identityKey = new IdentityKey({id: number});
                identityKey.fetch().always(function() {
                    var oldpublicKey = identityKey.get('publicKey');
                    if (!oldpublicKey) {
                        // Lookup failed, or the current key was removed, so save this one.
                        identityKey.save({publicKey: publicKey}).then(resolve);
                    } else {
                        // Key exists, if it matches do nothing, else throw
                        if (equalArrayBuffers(oldpublicKey, publicKey)) {
                            resolve();
                        } else {
                            throw new Error("Attempted to overwrite a different identity key");
                        }
                    }
                });
            });
        },
        removeIdentityKey: function(number) {
            return new Promise(function(resolve) {
                var identityKey = new IdentityKey({id: number});
                identityKey.fetch().then(function() {
                    identityKey.save({publicKey: undefined});
                }).fail(function() {
                    throw new Error("Tried to remove identity for unknown number");
                });
                resolve(textsecure.storage.axolotl.removeAllSessions(number));
            });
        },
        getGroup: function(groupId) {
            if (groupId === null || groupId === undefined)
                throw new Error("Tried to get group for undefined/null id");
            return new Promise(function(resolve) {
                var group = new Group({id: groupId});
                group.fetch().always(function() {
                    resolve(group.get('data'));
                });
            });
        },
        putGroup: function(groupId, group) {
            if (groupId === null || groupId === undefined)
                throw new Error("Tried to put group key for undefined/null id");
            if (group === null || group === undefined)
                throw new Error("Tried to put undefined/null group object");
            var group = new Group({id: groupId, data: group});
            return new Promise(function(resolve) {
                group.save().always(resolve);
            });
        },
        removeGroup: function(groupId) {
            if (groupId === null || groupId === undefined)
                throw new Error("Tried to remove group key for undefined/null id");
            return new Promise(function(resolve) {
                var group = new Group({id: groupId});
                group.destroy().always(resolve);
            });
        },

    };

    window.AxolotlStore = AxolotlStore;
})();
