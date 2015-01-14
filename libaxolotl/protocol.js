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
window.textsecure = window.textsecure || {};

window.textsecure.protocol = function() {
    var self = {};

    /******************************
    *** Random constants/utils ***
    ******************************/
    // We consider messages lost after a week and might throw away keys at that point
    // (also the time between signedPreKey regenerations)
    var MESSAGE_LOST_THRESHOLD_MS = 1000*60*60*24*7;

    function objectContainsKeys(object) {
        var count = 0;
        for (var key in object) {
            count++;
            break;
        }
        return count != 0;
    }

    /***************************
    *** Key/session storage ***
    ***************************/
    var crypto_storage = {};

    crypto_storage.putKeyPair = function(keyName, keyPair) {
        textsecure.storage.putEncrypted("25519Key" + keyName, keyPair);
    }

    crypto_storage.getNewStoredKeyPair = function(keyName) {
        return textsecure.crypto.createKeyPair().then(function(keyPair) {
            crypto_storage.putKeyPair(keyName, keyPair);
            return keyPair;
        });
    }

    crypto_storage.getStoredKeyPair = function(keyName) {
        var res = textsecure.storage.getEncrypted("25519Key" + keyName);
        if (res === undefined)
            return undefined;
        return { pubKey: toArrayBuffer(res.pubKey), privKey: toArrayBuffer(res.privKey) };
    }

    crypto_storage.removeStoredKeyPair = function(keyName) {
        textsecure.storage.removeEncrypted("25519Key" + keyName);
    }

    crypto_storage.getIdentityKey = function() {
        return this.getStoredKeyPair("identityKey");
    }

    crypto_storage.saveSession = function(encodedNumber, session, registrationId) {
        var device = textsecure.storage.devices.getDeviceObject(encodedNumber);
        if (device === undefined)
            device = { sessions: {}, encodedNumber: encodedNumber };

        if (registrationId !== undefined)
            device.registrationId = registrationId;

        crypto_storage.saveSessionAndDevice(device, session);
    }

    crypto_storage.saveSessionAndDevice = function(device, session) {
        if (device.sessions === undefined)
            device.sessions = {};
        var sessions = device.sessions;

        var doDeleteSession = false;
        if (session.indexInfo.closed == -1 || device.identityKey === undefined)
            device.identityKey = session.indexInfo.remoteIdentityKey;

        if (session.indexInfo.closed != -1) {
            doDeleteSession = (session.indexInfo.closed < (new Date().getTime() - MESSAGE_LOST_THRESHOLD_MS));

            if (!doDeleteSession) {
                var keysLeft = false;
                for (var key in session) {
                    if (key != "indexInfo" && key != "oldRatchetList" && key != "currentRatchet") {
                        keysLeft = true;
                        break;
                    }
                }
                doDeleteSession = !keysLeft;
                console.log((doDeleteSession ? "Deleting " : "Not deleting ") + "closed session which has not yet timed out");
            } else
                console.log("Deleting closed session due to timeout (created at " + session.indexInfo.closed + ")");
        }

        if (doDeleteSession)
            delete sessions[getString(session.indexInfo.baseKey)];
        else
            sessions[getString(session.indexInfo.baseKey)] = session;

        var openSessionRemaining = false;
        for (var key in sessions)
            if (sessions[key].indexInfo.closed == -1)
                openSessionRemaining = true;
        if (!openSessionRemaining)
            try {
                delete device['registrationId'];
            } catch(_) {}

        textsecure.storage.devices.saveDeviceObject(device);
    }

    var getSessions = function(encodedNumber) {
        var device = textsecure.storage.devices.getDeviceObject(encodedNumber);
        if (device === undefined || device.sessions === undefined)
            return undefined;
        return device.sessions;
    }

    crypto_storage.getOpenSession = function(encodedNumber) {
        var sessions = getSessions(encodedNumber);
        if (sessions === undefined)
            return undefined;

        for (var key in sessions)
            if (sessions[key].indexInfo.closed == -1)
                return sessions[key];
        return undefined;
    }

    crypto_storage.getSessionByRemoteEphemeralKey = function(encodedNumber, remoteEphemeralKey) {
        var sessions = getSessions(encodedNumber);
        if (sessions === undefined)
            return undefined;

        var searchKey = getString(remoteEphemeralKey);

        var openSession = undefined;
        for (var key in sessions) {
            if (sessions[key].indexInfo.closed == -1) {
                if (openSession !== undefined)
                    throw new Error("Datastore inconsistensy: multiple open sessions for " + encodedNumber);
                openSession = sessions[key];
            }
            if (sessions[key][searchKey] !== undefined)
                return sessions[key];
        }
        if (openSession !== undefined)
            return openSession;

        return undefined;
    }

    crypto_storage.getSessionOrIdentityKeyByBaseKey = function(encodedNumber, baseKey) {
        var sessions = getSessions(encodedNumber);
        var device = textsecure.storage.devices.getDeviceObject(encodedNumber);
        if (device === undefined)
            return undefined;

        var preferredSession = device.sessions && device.sessions[getString(baseKey)];
        if (preferredSession !== undefined)
            return preferredSession;

        if (device.identityKey !== undefined)
            return { indexInfo: { remoteIdentityKey: device.identityKey } };

        throw new Error("Datastore inconsistency: device was stored without identity key");
    }

    /*****************************
    *** Internal Crypto stuff ***
    *****************************/
    var HKDF = function(input, salt, info) {
        // HKDF for TextSecure has a bit of additional handling - salts always end up being 32 bytes
        if (salt == '')
            salt = new ArrayBuffer(32);
        if (salt.byteLength != 32)
            throw new Error("Got salt of incorrect length");

        info = toArrayBuffer(info); // TODO: maybe convert calls?

        return textsecure.crypto.HKDF(input, salt, info);
    }

    var verifyMAC = function(data, key, mac) {
        return textsecure.crypto.sign(key, data).then(function(calculated_mac) {
            if (!isEqual(calculated_mac, mac, true))
                throw new Error("Bad MAC");
        });
    }

    /******************************
    *** Ratchet implementation ***
    ******************************/
    var calculateRatchet = function(session, remoteKey, sending) {
        var ratchet = session.currentRatchet;

        return textsecure.crypto.ECDHE(remoteKey, toArrayBuffer(ratchet.ephemeralKeyPair.privKey)).then(function(sharedSecret) {
            return HKDF(sharedSecret, toArrayBuffer(ratchet.rootKey), "WhisperRatchet").then(function(masterKey) {
                if (sending)
                    session[getString(ratchet.ephemeralKeyPair.pubKey)] = { messageKeys: {}, chainKey: { counter: -1, key: masterKey[1] } };
                else
                    session[getString(remoteKey)]                       = { messageKeys: {}, chainKey: { counter: -1, key: masterKey[1] } };
                ratchet.rootKey = masterKey[0];
            });
        });
    }

    var initSession = function(isInitiator, ourEphemeralKey, ourSignedKey, encodedNumber, theirIdentityPubKey, theirEphemeralPubKey, theirSignedPubKey) {
        var ourIdentityKey = crypto_storage.getIdentityKey();

        if (isInitiator) {
            if (ourSignedKey !== undefined)
                throw new Error("Invalid call to initSession");
            ourSignedKey = ourEphemeralKey;
        } else {
            if (theirSignedPubKey !== undefined)
                throw new Error("Invalid call to initSession");
            theirSignedPubKey = theirEphemeralPubKey;
        }

        var sharedSecret;
        if (ourEphemeralKey === undefined || theirEphemeralPubKey === undefined)
            sharedSecret = new Uint8Array(32 * 4);
        else
            sharedSecret = new Uint8Array(32 * 5);

        for (var i = 0; i < 32; i++)
            sharedSecret[i] = 0xff;

        return textsecure.crypto.ECDHE(theirSignedPubKey, ourIdentityKey.privKey).then(function(ecRes1) {
            function finishInit() {
                return textsecure.crypto.ECDHE(theirSignedPubKey, ourSignedKey.privKey).then(function(ecRes) {
                    sharedSecret.set(new Uint8Array(ecRes), 32 * 3);

                    return HKDF(sharedSecret.buffer, '', "WhisperText").then(function(masterKey) {
                        var session = {currentRatchet: { rootKey: masterKey[0], lastRemoteEphemeralKey: theirSignedPubKey, previousCounter: 0 },
                                        indexInfo: { remoteIdentityKey: theirIdentityPubKey, closed: -1 },
                                        oldRatchetList: []
                                    };
                        if (!isInitiator)
                            session.indexInfo.baseKey = theirEphemeralPubKey;
                        else
                            session.indexInfo.baseKey = ourEphemeralKey.pubKey;

                        // If we're initiating we go ahead and set our first sending ephemeral key now,
                        // otherwise we figure it out when we first maybeStepRatchet with the remote's ephemeral key
                        if (isInitiator) {
                            return textsecure.crypto.createKeyPair().then(function(ourSendingEphemeralKey) {
                                session.currentRatchet.ephemeralKeyPair = ourSendingEphemeralKey;
                                return calculateRatchet(session, theirSignedPubKey, true).then(function() {
                                    return session;
                                });
                            });
                        } else {
                            session.currentRatchet.ephemeralKeyPair = ourSignedKey;
                            return session;
                        }
                    });
                });
            }

            var promise;
            if (ourEphemeralKey === undefined || theirEphemeralPubKey === undefined)
                promise = Promise.resolve(new ArrayBuffer(0));
            else
                promise = textsecure.crypto.ECDHE(theirEphemeralPubKey, ourEphemeralKey.privKey);
            return promise.then(function(ecRes4) {
                sharedSecret.set(new Uint8Array(ecRes4), 32 * 4);

                if (isInitiator)
                    return textsecure.crypto.ECDHE(theirIdentityPubKey, ourSignedKey.privKey).then(function(ecRes2) {
                        sharedSecret.set(new Uint8Array(ecRes1), 32);
                        sharedSecret.set(new Uint8Array(ecRes2), 32 * 2);
                    }).then(finishInit);
                else
                    return textsecure.crypto.ECDHE(theirIdentityPubKey, ourSignedKey.privKey).then(function(ecRes2) {
                        sharedSecret.set(new Uint8Array(ecRes1), 32 * 2);
                        sharedSecret.set(new Uint8Array(ecRes2), 32)
                    }).then(finishInit);
            });
        });
    }

    var removeOldChains = function(session) {
        // Sending ratchets are always removed when we step because we never need them again
        // Receiving ratchets are either removed if we step with all keys used up to previousCounter
        // and are otherwise added to the oldRatchetList, which we parse here and remove ratchets
        // older than a week (we assume the message was lost and move on with our lives at that point)
        var newList = [];
        for (var i = 0; i < session.oldRatchetList.length; i++) {
            var entry = session.oldRatchetList[i];
            var ratchet = getString(entry.ephemeralKey);
            console.log("Checking old chain with added time " + (entry.added/1000));
            if ((!objectContainsKeys(session[ratchet].messageKeys) && (session[ratchet].chainKey === undefined || session[ratchet].chainKey.key === undefined))
                    || entry.added < new Date().getTime() - MESSAGE_LOST_THRESHOLD_MS) {
                delete session[ratchet];
                console.log("...deleted");
            } else
                newList[newList.length] = entry;
        }
        session.oldRatchetList = newList;
    }

    var closeSession = function(session, sessionClosedByRemote) {
        if (session.indexInfo.closed > -1)
            return;

        // After this has run, we can still receive messages on ratchet chains which
        // were already open (unless we know we dont need them),
        // but we cannot send messages or step the ratchet

        // Delete current sending ratchet
        delete session[getString(session.currentRatchet.ephemeralKeyPair.pubKey)];
        // Move all receive ratchets to the oldRatchetList to mark them for deletion
        for (var i in session) {
            if (session[i].chainKey !== undefined && session[i].chainKey.key !== undefined) {
                if (!sessionClosedByRemote)
                    session.oldRatchetList[session.oldRatchetList.length] = { added: new Date().getTime(), ephemeralKey: i };
                else
                    delete session[i].chainKey.key;
            }
        }
        // Delete current root key and our ephemeral key pair to disallow ratchet stepping
        delete session.currentRatchet['rootKey'];
        delete session.currentRatchet['ephemeralKeyPair'];
        session.indexInfo.closed = new Date().getTime();
        removeOldChains(session);
    }

    self.closeOpenSessionForDevice = function(encodedNumber) {
        var session = crypto_storage.getOpenSession(encodedNumber);
        if (session === undefined)
            return;

        closeSession(session);
        crypto_storage.saveSession(encodedNumber, session);
    }

    var initSessionFromPreKeyWhisperMessage;
    var decryptWhisperMessage;
    var handlePreKeyWhisperMessage = function(from, encodedMessage) {
        var preKeyProto = textsecure.protobuf.PreKeyWhisperMessage.decode(encodedMessage, 'binary');
        return initSessionFromPreKeyWhisperMessage(from, preKeyProto).then(function(sessions) {
            return decryptWhisperMessage(from, getString(preKeyProto.message), sessions[0], preKeyProto.registrationId).then(function(result) {
                if (sessions[1] !== undefined)
                    sessions[1]();
                return result;
            });
        });
    }

    var wipeIdentityAndTryMessageAgain = function(from, encodedMessage, message_id) {
        // Wipe identity key!
        textsecure.storage.removeEncrypted("devices" + from.split('.')[0]);
        return handlePreKeyWhisperMessage(from, encodedMessage).then(
            function(pushMessageContent) {
                extension.trigger('message:decrypted', {
                    message_id : message_id,
                    data       : pushMessageContent
                });
            }
        );
    }
    textsecure.replay.registerFunction(wipeIdentityAndTryMessageAgain, textsecure.replay.Type.INIT_SESSION);

    initSessionFromPreKeyWhisperMessage = function(encodedNumber, message) {
        var preKeyPair = crypto_storage.getStoredKeyPair("preKey" + message.preKeyId);
        var signedPreKeyPair = crypto_storage.getStoredKeyPair("signedKey" + message.signedPreKeyId);

        var session = crypto_storage.getSessionOrIdentityKeyByBaseKey(encodedNumber, toArrayBuffer(message.baseKey));
        var open_session = crypto_storage.getOpenSession(encodedNumber);
        if (signedPreKeyPair === undefined) {
            // Session may or may not be the right one, but if its not, we can't do anything about it
            // ...fall through and let decryptWhisperMessage handle that case
            if (session !== undefined && session.currentRatchet !== undefined)
                return Promise.resolve([session, undefined]);
            else
                throw new Error("Missing Signed PreKey for PreKeyWhisperMessage");
        }
        if (session !== undefined) {
            // Duplicate PreKeyMessage for session:
            if (isEqual(session.indexInfo.baseKey, message.baseKey, false))
                return Promise.resolve([session, undefined]);

            // We already had a session/known identity key:
            if (isEqual(session.indexInfo.remoteIdentityKey, message.identityKey, false)) {
                // If the identity key matches the previous one, close the previous one and use the new one
                if (open_session !== undefined)
                    closeSession(open_session); // To be returned and saved later
            } else {
                // ...otherwise create an error that the UI will pick up and ask the user if they want to re-negotiate
                throw new textsecure.IncomingIdentityKeyError(encodedNumber, getString(message.encode()));
            }
        }
        return initSession(false, preKeyPair, signedPreKeyPair, encodedNumber, toArrayBuffer(message.identityKey), toArrayBuffer(message.baseKey), undefined)
                        .then(function(new_session) {
            // Note that the session is not actually saved until the very end of decryptWhisperMessage
            // ... to ensure that the sender actually holds the private keys for all reported pubkeys
            return [new_session, function() {
                if (open_session !== undefined)
                    crypto_storage.saveSession(encodedNumber, open_session);
                crypto_storage.removeStoredKeyPair("preKey" + message.preKeyId);
            }];
        });;
    }

    var fillMessageKeys = function(chain, counter) {
        if (chain.chainKey.counter + 1000 < counter) //TODO: maybe 1000 is too low/high in some cases?
            return Promise.resolve(); // Stalker, much?

        if (chain.chainKey.counter >= counter)
            return Promise.resolve(); // Already calculated

        if (chain.chainKey.key === undefined)
            throw new Error("Got invalid request to extend chain after it was already closed");

        var key = toArrayBuffer(chain.chainKey.key);
        var byteArray = new Uint8Array(1);
        byteArray[0] = 1;
        return textsecure.crypto.sign(key, byteArray.buffer).then(function(mac) {
            byteArray[0] = 2;
            return textsecure.crypto.sign(key, byteArray.buffer).then(function(key) {
                chain.messageKeys[chain.chainKey.counter + 1] = mac;
                chain.chainKey.key = key
                chain.chainKey.counter += 1;
                return fillMessageKeys(chain, counter);
            });
        });
    }

    var maybeStepRatchet = function(session, remoteKey, previousCounter) {
        if (session[getString(remoteKey)] !== undefined)
            return Promise.resolve();

        var ratchet = session.currentRatchet;

        var finish = function() {
            return calculateRatchet(session, remoteKey, false).then(function() {
                // Now swap the ephemeral key and calculate the new sending chain
                var previousRatchet = getString(ratchet.ephemeralKeyPair.pubKey);
                if (session[previousRatchet] !== undefined) {
                    ratchet.previousCounter = session[previousRatchet].chainKey.counter;
                    delete session[previousRatchet];
                }

                return textsecure.crypto.createKeyPair().then(function(keyPair) {
                    ratchet.ephemeralKeyPair = keyPair;
                    return calculateRatchet(session, remoteKey, true).then(function() {
                        ratchet.lastRemoteEphemeralKey = remoteKey;
                    });
                });
            });
        }

        var previousRatchet = session[getString(ratchet.lastRemoteEphemeralKey)];
        if (previousRatchet !== undefined) {
            return fillMessageKeys(previousRatchet, previousCounter).then(function() {
                delete previousRatchet.chainKey.key;
                if (!objectContainsKeys(previousRatchet.messageKeys))
                    delete session[getString(ratchet.lastRemoteEphemeralKey)];
                else
                    session.oldRatchetList[session.oldRatchetList.length] = { added: new Date().getTime(), ephemeralKey: ratchet.lastRemoteEphemeralKey };
            }).then(finish);
        } else
            return finish();
    }

    // returns decrypted protobuf
    decryptWhisperMessage = function(encodedNumber, messageBytes, session, registrationId) {
        if (messageBytes[0] != String.fromCharCode((3 << 4) | 3))
            throw new Error("Bad version number on WhisperMessage");

        var messageProto = messageBytes.substring(1, messageBytes.length - 8);
        var mac = messageBytes.substring(messageBytes.length - 8, messageBytes.length);

        var message = textsecure.protobuf.WhisperMessage.decode(messageProto, 'binary');
        var remoteEphemeralKey = toArrayBuffer(message.ephemeralKey);

        if (session === undefined) {
            var session = crypto_storage.getSessionByRemoteEphemeralKey(encodedNumber, remoteEphemeralKey);
            if (session === undefined)
                throw new Error("No session found to decrypt message from " + encodedNumber);
        }

        return maybeStepRatchet(session, remoteEphemeralKey, message.previousCounter).then(function() {
            var chain = session[getString(message.ephemeralKey)];

            return fillMessageKeys(chain, message.counter).then(function() {
                return HKDF(toArrayBuffer(chain.messageKeys[message.counter]), '', "WhisperMessageKeys").then(function(keys) {
                    delete chain.messageKeys[message.counter];

                    var messageProtoArray = toArrayBuffer(messageProto);
                    var macInput = new Uint8Array(messageProtoArray.byteLength + 33*2 + 1);
                    macInput.set(new Uint8Array(toArrayBuffer(session.indexInfo.remoteIdentityKey)));
                    macInput.set(new Uint8Array(toArrayBuffer(crypto_storage.getIdentityKey().pubKey)), 33);
                    macInput[33*2] = (3 << 4) | 3;
                    macInput.set(new Uint8Array(messageProtoArray), 33*2 + 1);

                    return verifyMAC(macInput.buffer, keys[1], mac).then(function() {
                        return window.textsecure.crypto.decrypt(keys[0], toArrayBuffer(message.ciphertext), keys[2].slice(0, 16))
                                    .then(function(paddedPlaintext) {

                            paddedPlaintext = new Uint8Array(paddedPlaintext);
                            var plaintext;
                            for (var i = paddedPlaintext.length - 1; i >= 0; i--) {
                                if (paddedPlaintext[i] == 0x80) {
                                    plaintext = new Uint8Array(i);
                                    plaintext.set(paddedPlaintext.subarray(0, i));
                                    plaintext = plaintext.buffer;
                                    break;
                                } else if (paddedPlaintext[i] != 0x00)
                                    throw new Error('Invalid padding');
                            }

                            delete session['pendingPreKey'];

                            var finalMessage = textsecure.protobuf.PushMessageContent.decode(plaintext);

                            if ((finalMessage.flags & textsecure.protobuf.PushMessageContent.Flags.END_SESSION)
                                    == textsecure.protobuf.PushMessageContent.Flags.END_SESSION)
                                closeSession(session, true);

                            removeOldChains(session);

                            crypto_storage.saveSession(encodedNumber, session, registrationId);
                            return finalMessage;
                        });
                    });
                });
            });
        });
    }

    /*************************
    *** Public crypto API ***
    *************************/
    // Decrypts message into a raw string
    self.decryptWebsocketMessage = function(message) {
        var signaling_key = textsecure.storage.getEncrypted("signaling_key"); //TODO: in crypto_storage
        var aes_key = toArrayBuffer(signaling_key.substring(0, 32));
        var mac_key = toArrayBuffer(signaling_key.substring(32, 32 + 20));

        var decodedMessage = message.toArrayBuffer();
        if (new Uint8Array(decodedMessage)[0] != 1)
            throw new Error("Got bad version number: " + decodedMessage[0]);

        var iv = decodedMessage.slice(1, 1 + 16);
        var ciphertext = decodedMessage.slice(1 + 16, decodedMessage.byteLength - 10);
        var ivAndCiphertext = decodedMessage.slice(0, decodedMessage.byteLength - 10);
        var mac = decodedMessage.slice(decodedMessage.byteLength - 10, decodedMessage.byteLength);

        return verifyMAC(ivAndCiphertext, mac_key, mac).then(function() {
            return window.textsecure.crypto.decrypt(aes_key, ciphertext, iv);
        });
    };

    self.decryptAttachment = function(encryptedBin, keys) {
        var aes_key = keys.slice(0, 32);
        var mac_key = keys.slice(32, 64);

        var iv = encryptedBin.slice(0, 16);
        var ciphertext = encryptedBin.slice(16, encryptedBin.byteLength - 32);
        var ivAndCiphertext = encryptedBin.slice(0, encryptedBin.byteLength - 32);
        var mac = encryptedBin.slice(encryptedBin.byteLength - 32, encryptedBin.byteLength);

        return verifyMAC(ivAndCiphertext, mac_key, mac).then(function() {
            return window.textsecure.crypto.decrypt(aes_key, ciphertext, iv);
        });
    };

    self.encryptAttachment = function(plaintext, keys, iv) {
        var aes_key = keys.slice(0, 32);
        var mac_key = keys.slice(32, 64);

        return window.textsecure.crypto.encrypt(aes_key, plaintext, iv).then(function(ciphertext) {
            var ivAndCiphertext = new Uint8Array(16 + ciphertext.byteLength);
            ivAndCiphertext.set(new Uint8Array(iv));
            ivAndCiphertext.set(new Uint8Array(ciphertext), 16);

            return textsecure.crypto.sign(mac_key, ivAndCiphertext.buffer).then(function(mac) {
                var encryptedBin = new Uint8Array(16 + ciphertext.byteLength + 32);
                encryptedBin.set(ivAndCiphertext);
                encryptedBin.set(new Uint8Array(mac), 16 + ciphertext.byteLength);
                return encryptedBin.buffer;
            });
        });
    };

    self.handleIncomingPushMessageProto = function(proto) {
        switch(proto.type) {
        case textsecure.protobuf.IncomingPushMessageSignal.Type.PLAINTEXT:
            return Promise.resolve(textsecure.protobuf.PushMessageContent.decode(proto.message));
        case textsecure.protobuf.IncomingPushMessageSignal.Type.CIPHERTEXT:
            var from = proto.source + "." + (proto.sourceDevice == null ? 0 : proto.sourceDevice);
            return decryptWhisperMessage(from, getString(proto.message));
        case textsecure.protobuf.IncomingPushMessageSignal.Type.PREKEY_BUNDLE:
            if (proto.message.readUint8() != ((3 << 4) | 3))
                throw new Error("Bad version byte");
            var from = proto.source + "." + (proto.sourceDevice == null ? 0 : proto.sourceDevice);
            return handlePreKeyWhisperMessage(from, getString(proto.message));
        case textsecure.protobuf.IncomingPushMessageSignal.Type.RECEIPT:
            return Promise.resolve(null);
        default:
            return new Promise(function(resolve, reject) { reject(new Error("Unknown message type")); });
        }
    }

    // return Promise(encoded [PreKey]WhisperMessage)
    self.encryptMessageFor = function(deviceObject, pushMessageContent) {
        var session = crypto_storage.getOpenSession(deviceObject.encodedNumber);

        var doEncryptPushMessageContent = function() {
            var msg = new textsecure.protobuf.WhisperMessage();
            var plaintext = toArrayBuffer(pushMessageContent.encode());

            var paddedPlaintext = new Uint8Array(Math.ceil((plaintext.byteLength + 1) / 160.0) * 160 - 1);
            paddedPlaintext.set(new Uint8Array(plaintext));
            paddedPlaintext[plaintext.byteLength] = 0x80;

            msg.ephemeralKey = toArrayBuffer(session.currentRatchet.ephemeralKeyPair.pubKey);
            var chain = session[getString(msg.ephemeralKey)];

            return fillMessageKeys(chain, chain.chainKey.counter + 1).then(function() {
                return HKDF(toArrayBuffer(chain.messageKeys[chain.chainKey.counter]), '', "WhisperMessageKeys").then(function(keys) {
                    delete chain.messageKeys[chain.chainKey.counter];
                    msg.counter = chain.chainKey.counter;
                    msg.previousCounter = session.currentRatchet.previousCounter;

                    return window.textsecure.crypto.encrypt(keys[0], paddedPlaintext.buffer, keys[2].slice(0, 16)).then(function(ciphertext) {
                        msg.ciphertext = ciphertext;
                        var encodedMsg = toArrayBuffer(msg.encode());

                        var macInput = new Uint8Array(encodedMsg.byteLength + 33*2 + 1);
                        macInput.set(new Uint8Array(toArrayBuffer(crypto_storage.getIdentityKey().pubKey)));
                        macInput.set(new Uint8Array(toArrayBuffer(session.indexInfo.remoteIdentityKey)), 33);
                        macInput[33*2] = (3 << 4) | 3;
                        macInput.set(new Uint8Array(encodedMsg), 33*2 + 1);

                        return textsecure.crypto.sign(keys[1], macInput.buffer).then(function(mac) {
                            var result = new Uint8Array(encodedMsg.byteLength + 9);
                            result[0] = (3 << 4) | 3;
                            result.set(new Uint8Array(encodedMsg), 1);
                            result.set(new Uint8Array(mac, 0, 8), encodedMsg.byteLength + 1);

                            try {
                                delete deviceObject['signedKey'];
                                delete deviceObject['signedKeyId'];
                                delete deviceObject['preKey'];
                                delete deviceObject['preKeyId'];
                            } catch(_) {}

                            removeOldChains(session);

                            crypto_storage.saveSessionAndDevice(deviceObject, session);
                            return result;
                        });
                    });
                });
            });
        }

        var preKeyMsg = new textsecure.protobuf.PreKeyWhisperMessage();
        preKeyMsg.identityKey = toArrayBuffer(crypto_storage.getIdentityKey().pubKey);
        preKeyMsg.registrationId = textsecure.storage.getUnencrypted("registrationId");

        if (session === undefined) {
            return textsecure.crypto.createKeyPair().then(function(baseKey) {
                preKeyMsg.preKeyId = deviceObject.preKeyId;
                preKeyMsg.signedPreKeyId = deviceObject.signedKeyId;
                preKeyMsg.baseKey = toArrayBuffer(baseKey.pubKey);
                return initSession(true, baseKey, undefined, deviceObject.encodedNumber,
                                    toArrayBuffer(deviceObject.identityKey), toArrayBuffer(deviceObject.preKey), toArrayBuffer(deviceObject.signedKey))
                            .then(function(new_session) {
                    session = new_session;
                    session.pendingPreKey = { preKeyId: deviceObject.preKeyId, signedKeyId: deviceObject.signedKeyId, baseKey: baseKey.pubKey };
                    return doEncryptPushMessageContent().then(function(message) {
                        preKeyMsg.message = message;
                        var result = String.fromCharCode((3 << 4) | 3) + getString(preKeyMsg.encode());
                        return {type: 3, body: result};
                    });
                });
            });
        } else
            return doEncryptPushMessageContent().then(function(message) {
                if (session.pendingPreKey !== undefined) {
                    preKeyMsg.baseKey = toArrayBuffer(session.pendingPreKey.baseKey);
                    preKeyMsg.preKeyId = session.pendingPreKey.preKeyId;
                    preKeyMsg.signedPreKeyId = session.pendingPreKey.signedKeyId;
                    preKeyMsg.message = message;

                    var result = String.fromCharCode((3 << 4) | 3) + getString(preKeyMsg.encode());
                    return {type: 3, body: result};
                } else
                    return {type: 1, body: getString(message)};
            });
    }

    var GENERATE_KEYS_KEYS_GENERATED = 100;
    self.generateKeys = function() {
        var identityKeyPair = crypto_storage.getIdentityKey();
        var identityKeyCalculated = function(identityKeyPair) {
            var firstPreKeyId = textsecure.storage.getEncrypted("maxPreKeyId", 0);
            textsecure.storage.putEncrypted("maxPreKeyId", firstPreKeyId + GENERATE_KEYS_KEYS_GENERATED);

            var signedKeyId = textsecure.storage.getEncrypted("signedKeyId", 0);
            textsecure.storage.putEncrypted("signedKeyId", signedKeyId + 1);

            var keys = {};
            keys.identityKey = identityKeyPair.pubKey;
            keys.preKeys = [];

            var generateKey = function(keyId) {
                return crypto_storage.getNewStoredKeyPair("preKey" + keyId, false).then(function(keyPair) {
                    keys.preKeys[keyId] = {keyId: keyId, publicKey: keyPair.pubKey};
                });
            };

            var promises = [];
            for (var i = firstPreKeyId; i < firstPreKeyId + GENERATE_KEYS_KEYS_GENERATED; i++)
                promises[i] = generateKey(i);

            promises[firstPreKeyId + GENERATE_KEYS_KEYS_GENERATED] = crypto_storage.getNewStoredKeyPair("signedKey" + signedKeyId).then(function(keyPair) {
                return textsecure.crypto.Ed25519Sign(identityKeyPair.privKey, keyPair.pubKey).then(function(sig) {
                    keys.signedPreKey = {keyId: signedKeyId, publicKey: keyPair.pubKey, signature: sig};
                });
            });

            //TODO: Process by date added and agressively call generateKeys when we get near maxPreKeyId in a message
            crypto_storage.removeStoredKeyPair("signedKey" + (signedKeyId - 2));

            return Promise.all(promises).then(function() {
                return keys;
            });
        }
        if (identityKeyPair === undefined)
            return crypto_storage.getNewStoredKeyPair("identityKey").then(function(keyPair) { return identityKeyCalculated(keyPair); });
        else
            return identityKeyCalculated(identityKeyPair);
    }

    //TODO: Dont always update prekeys here
    if (textsecure.storage.getEncrypted("lastSignedKeyUpdate", Date.now()) < Date.now() - MESSAGE_LOST_THRESHOLD_MS) {
        new Promise(function(resolve) { resolve(self.generateKeys()); });
    }


    self.prepareTempWebsocket = function() {
        var socketInfo = {};
        var keyPair;

        socketInfo.decryptAndHandleDeviceInit = function(deviceInit) {
            var masterEphemeral = toArrayBuffer(deviceInit.publicKey);
            var message = toArrayBuffer(deviceInit.body);

            return textsecure.crypto.ECDHE(masterEphemeral, keyPair.privKey).then(function(ecRes) {
                return HKDF(ecRes, '', "TextSecure Provisioning Message").then(function(keys) {
                    if (new Uint8Array(message)[0] != 1)
                        throw new Error("Bad version number on ProvisioningMessage");

                    var iv = message.slice(1, 16 + 1);
                    var mac = message.slice(message.byteLength - 32, message.byteLength);
                    var ivAndCiphertext = message.slice(0, message.byteLength - 32);
                    var ciphertext = message.slice(16 + 1, message.byteLength - 32);

                    return verifyMAC(ivAndCiphertext, keys[1], mac).then(function() {
                        return window.textsecure.crypto.decrypt(keys[0], ciphertext, iv).then(function(plaintext) {
                            var identityKeyMsg = textsecure.protobuf.ProvisionMessage.decode(plaintext);

                            return textsecure.crypto.createKeyPair(toArrayBuffer(identityKeyMsg.identityKeyPrivate)).then(function(identityKeyPair) {
                                crypto_storage.putKeyPair("identityKey", identityKeyPair);
                                identityKeyMsg.identityKeyPrivate = null;

                                return identityKeyMsg;
                            });
                        });
                    });
                });
            });
        }

        return textsecure.crypto.createKeyPair().then(function(newKeyPair) {
            keyPair = newKeyPair;
            socketInfo.pubKey = keyPair.pubKey;
            return socketInfo;
        });
    }

    return self;
}();

})();
