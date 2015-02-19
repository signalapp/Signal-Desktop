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
window.axolotl = window.axolotl || {};

window.axolotl.protocol = function() {
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
        axolotl.api.storage.put("25519Key" + keyName, keyPair);
    }

    crypto_storage.getNewStoredKeyPair = function(keyName) {
        return axolotl.crypto.createKeyPair().then(function(keyPair) {
            crypto_storage.putKeyPair(keyName, keyPair);
            return keyPair;
        });
    }

    crypto_storage.getStoredKeyPair = function(keyName) {
        var res = axolotl.api.storage.get("25519Key" + keyName);
        if (res === undefined)
            return undefined;
        return { pubKey: toArrayBuffer(res.pubKey), privKey: toArrayBuffer(res.privKey) };
    }

    crypto_storage.removeStoredKeyPair = function(keyName) {
        axolotl.api.storage.remove("25519Key" + keyName);
    }

    crypto_storage.getIdentityKey = function() {
        return this.getStoredKeyPair("identityKey");
    }

    crypto_storage.saveSession = function(encodedNumber, session, registrationId) {
        var record = axolotl.api.storage.sessions.get(encodedNumber);
        if (record === undefined) {
            if (registrationId === undefined)
                throw new Error("Tried to save a session for an existing device that didn't exist");
            else
                record = new axolotl.sessions.RecipientRecord(session.indexInfo.remoteIdentityKey, registrationId);
        }

        var sessions = record._sessions;

        if (record.identityKey === null)
            record.identityKey = session.indexInfo.remoteIdentityKey;
        if (getString(record.identityKey) !== getString(session.indexInfo.remoteIdentityKey))
            throw new Error("Identity key changed at session save time");

        var doDeleteSession = false;
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
        if (!openSessionRemaining) // Used as a flag to get new pre keys for the next session
            record.registrationId = null;
        else if (record.registrationId === null && registrationId !== undefined)
            record.registrationId = registrationId;
        else if (record.registrationId === null)
            throw new Error("Had open sessions on a record that had no registrationId set");

        var identityKey = axolotl.api.storage.identityKeys.get(encodedNumber);
        if (identityKey === undefined)
            axolotl.api.storage.identityKeys.put(encodedNumber, record.identityKey);
        else if (getString(identityKey) !== getString(record.identityKey))
            throw new Error("Tried to change identity key at save time");

        axolotl.api.storage.sessions.put(encodedNumber, record);
    }

    var getSessions = function(encodedNumber) {
        var record = axolotl.api.storage.sessions.get(encodedNumber);
        if (record === undefined)
            return undefined;
        return record._sessions;
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
        var record = axolotl.api.storage.sessions.get(encodedNumber);
        if (record === undefined) {
            var identityKey = axolotl.api.storage.identityKeys.get(encodedNumber);
            if (identityKey === undefined)
                return undefined;
            return { indexInfo: { remoteIdentityKey: identityKey } };
        }
        var sessions = record._sessions;

        var preferredSession = record._sessions[getString(baseKey)];
        if (preferredSession !== undefined)
            return preferredSession;

        if (record.identityKey !== undefined)
            return { indexInfo: { remoteIdentityKey: record.identityKey } };

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

        return axolotl.crypto.HKDF(input, salt, info);
    }

    var verifyMAC = function(data, key, mac) {
        return axolotl.crypto.sign(key, data).then(function(calculated_mac) {
            if (!isEqual(calculated_mac, mac, true))
                throw new Error("Bad MAC");
        });
    }

    /******************************
    *** Ratchet implementation ***
    ******************************/
    var calculateRatchet = function(session, remoteKey, sending) {
        var ratchet = session.currentRatchet;

        return axolotl.crypto.ECDHE(remoteKey, toArrayBuffer(ratchet.ephemeralKeyPair.privKey)).then(function(sharedSecret) {
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

        return axolotl.crypto.ECDHE(theirSignedPubKey, ourIdentityKey.privKey).then(function(ecRes1) {
            function finishInit() {
                return axolotl.crypto.ECDHE(theirSignedPubKey, ourSignedKey.privKey).then(function(ecRes) {
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
                            return axolotl.crypto.createKeyPair().then(function(ourSendingEphemeralKey) {
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
                promise = axolotl.crypto.ECDHE(theirEphemeralPubKey, ourEphemeralKey.privKey);
            return promise.then(function(ecRes4) {
                sharedSecret.set(new Uint8Array(ecRes4), 32 * 4);

                if (isInitiator)
                    return axolotl.crypto.ECDHE(theirIdentityPubKey, ourSignedKey.privKey).then(function(ecRes2) {
                        sharedSecret.set(new Uint8Array(ecRes1), 32);
                        sharedSecret.set(new Uint8Array(ecRes2), 32 * 2);
                    }).then(finishInit);
                else
                    return axolotl.crypto.ECDHE(theirIdentityPubKey, ourSignedKey.privKey).then(function(ecRes2) {
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

    var refreshPreKeys;
    var initSessionFromPreKeyWhisperMessage = function(encodedNumber, message) {
        var preKeyPair = crypto_storage.getStoredKeyPair("preKey" + message.preKeyId);
        var signedPreKeyPair = crypto_storage.getStoredKeyPair("signedKey" + message.signedPreKeyId);

        //TODO: Call refreshPreKeys when it looks like all our prekeys are used up?

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
                throw new Error('Unknown identity key');
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
        return axolotl.crypto.sign(key, byteArray.buffer).then(function(mac) {
            byteArray[0] = 2;
            return axolotl.crypto.sign(key, byteArray.buffer).then(function(key) {
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

                return axolotl.crypto.createKeyPair().then(function(keyPair) {
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

    var doDecryptWhisperMessage = function(encodedNumber, messageBytes, session, registrationId) {
        if (messageBytes[0] != String.fromCharCode((3 << 4) | 3))
            throw new Error("Bad version number on WhisperMessage");

        var messageProto = messageBytes.substring(1, messageBytes.length - 8);
        var mac = messageBytes.substring(messageBytes.length - 8, messageBytes.length);

        var message = axolotl.protobuf.WhisperMessage.decode(messageProto, 'binary');
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
                        return window.axolotl.crypto.decrypt(keys[0], toArrayBuffer(message.ciphertext), keys[2].slice(0, 16))
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
                            removeOldChains(session);
                            crypto_storage.saveSession(encodedNumber, session, registrationId);
                            return [plaintext, function() {
                                closeSession(session, true);
                                removeOldChains(session);
                                crypto_storage.saveSession(encodedNumber, session);
                            }];
                        });
                    });
                });
            });
        });
    }

    /*************************
    *** Public crypto API ***
    *************************/
    //TODO: SHARP EDGE HERE
    //XXX: Also, you MUST call the session close function before processing another message....except its a promise...so you literally cant!
    // returns decrypted plaintext and a function that must be called if the message indicates session close
    self.decryptWhisperMessage = function(encodedNumber, messageBytes, session) {
        return doDecryptWhisperMessage(encodedNumber, messageBytes, session);
    }

    // Inits a session (maybe) and then decrypts the message
    self.handlePreKeyWhisperMessage = function(from, encodedMessage) {
        var preKeyProto = axolotl.protobuf.PreKeyWhisperMessage.decode(encodedMessage, 'binary');
        return initSessionFromPreKeyWhisperMessage(from, preKeyProto).then(function(sessions) {
            return doDecryptWhisperMessage(from, getString(preKeyProto.message), sessions[0], preKeyProto.registrationId).then(function(result) {
                if (sessions[1] !== undefined)
                    sessions[1]();
                return result;
            });
        });
    }

    // return Promise(encoded [PreKey]WhisperMessage)
    self.encryptMessageFor = function(deviceObject, pushMessageContent) {
        var session = crypto_storage.getOpenSession(deviceObject.encodedNumber);
        var hadSession = session !== undefined;

        var doEncryptPushMessageContent = function() {
            var msg = new axolotl.protobuf.WhisperMessage();
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

                    return window.axolotl.crypto.encrypt(keys[0], paddedPlaintext.buffer, keys[2].slice(0, 16)).then(function(ciphertext) {
                        msg.ciphertext = ciphertext;
                        var encodedMsg = toArrayBuffer(msg.encode());

                        var macInput = new Uint8Array(encodedMsg.byteLength + 33*2 + 1);
                        macInput.set(new Uint8Array(toArrayBuffer(crypto_storage.getIdentityKey().pubKey)));
                        macInput.set(new Uint8Array(toArrayBuffer(session.indexInfo.remoteIdentityKey)), 33);
                        macInput[33*2] = (3 << 4) | 3;
                        macInput.set(new Uint8Array(encodedMsg), 33*2 + 1);

                        return axolotl.crypto.sign(keys[1], macInput.buffer).then(function(mac) {
                            var result = new Uint8Array(encodedMsg.byteLength + 9);
                            result[0] = (3 << 4) | 3;
                            result.set(new Uint8Array(encodedMsg), 1);
                            result.set(new Uint8Array(mac, 0, 8), encodedMsg.byteLength + 1);

                            removeOldChains(session);

                            crypto_storage.saveSession(deviceObject.encodedNumber, session, !hadSession ? deviceObject.registrationId : undefined);
                            return result;
                        });
                    });
                });
            });
        }

        var preKeyMsg = new axolotl.protobuf.PreKeyWhisperMessage();
        preKeyMsg.identityKey = toArrayBuffer(crypto_storage.getIdentityKey().pubKey);
        preKeyMsg.registrationId = axolotl.api.getMyRegistrationId();

        if (session === undefined) {
            var deviceIdentityKey = toArrayBuffer(deviceObject.identityKey);
            var deviceSignedKey = toArrayBuffer(deviceObject.signedKey);
            return axolotl.crypto.Ed25519Verify(deviceIdentityKey, deviceSignedKey, toArrayBuffer(deviceObject.signedKeySignature)).then(function() {
                return axolotl.crypto.createKeyPair().then(function(baseKey) {
                    preKeyMsg.preKeyId = deviceObject.preKeyId;
                    preKeyMsg.signedPreKeyId = deviceObject.signedKeyId;
                    preKeyMsg.baseKey = toArrayBuffer(baseKey.pubKey);
                    return initSession(true, baseKey, undefined, deviceObject.encodedNumber,
                                        deviceIdentityKey, toArrayBuffer(deviceObject.preKey), deviceSignedKey)
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
            var firstPreKeyId = axolotl.api.storage.get("maxPreKeyId", 0);
            axolotl.api.storage.put("maxPreKeyId", firstPreKeyId + GENERATE_KEYS_KEYS_GENERATED);

            var signedKeyId = axolotl.api.storage.get("signedKeyId", 0);
            axolotl.api.storage.put("signedKeyId", signedKeyId + 1);

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
                return axolotl.crypto.Ed25519Sign(identityKeyPair.privKey, keyPair.pubKey).then(function(sig) {
                    keys.signedPreKey = {keyId: signedKeyId, publicKey: keyPair.pubKey, signature: sig};
                });
            });

            //TODO: Process by date added and agressively call generateKeys when we get near maxPreKeyId in a message
            crypto_storage.removeStoredKeyPair("signedKey" + (signedKeyId - 2));

            return Promise.all(promises).then(function() {
                axolotl.api.storage.put("lastPreKeyUpdate", Date.now());
                return keys;
            });
        }
        if (identityKeyPair === undefined)
            return crypto_storage.getNewStoredKeyPair("identityKey").then(function(keyPair) { return identityKeyCalculated(keyPair); });
        else
            return identityKeyCalculated(identityKeyPair);
    }

    refreshPreKeys = function() {
        self.generateKeys().then(function(keys) {
            console.log("Pre Keys updated!");
            return axolotl.api.updateKeys(keys);
        }).catch(function(e) {
            //TODO: Notify the user somehow???
            console.error(e);
        });
    }

    window.setInterval(function() {
        // Note that this will not ever run until generateKeys has been called at least once
        if (axolotl.api.storage.get("lastPreKeyUpdate", Date.now()) < Date.now() - MESSAGE_LOST_THRESHOLD_MS)
            refreshPreKeys();
    }, 60 * 1000);

    self.createIdentityKeyRecvSocket = function() {
        var socketInfo = {};
        var keyPair;

        socketInfo.decryptAndHandleDeviceInit = function(deviceInit) {
            var masterEphemeral = toArrayBuffer(deviceInit.publicKey);
            var message = toArrayBuffer(deviceInit.body);

            return axolotl.crypto.ECDHE(masterEphemeral, keyPair.privKey).then(function(ecRes) {
                return HKDF(ecRes, '', "TextSecure Provisioning Message").then(function(keys) {
                    if (new Uint8Array(message)[0] != 1)
                        throw new Error("Bad version number on ProvisioningMessage");

                    var iv = message.slice(1, 16 + 1);
                    var mac = message.slice(message.byteLength - 32, message.byteLength);
                    var ivAndCiphertext = message.slice(0, message.byteLength - 32);
                    var ciphertext = message.slice(16 + 1, message.byteLength - 32);

                    return verifyMAC(ivAndCiphertext, keys[1], mac).then(function() {
                        return window.axolotl.crypto.decrypt(keys[0], ciphertext, iv).then(function(plaintext) {
                            var identityKeyMsg = axolotl.protobuf.ProvisionMessage.decode(plaintext);

                            return axolotl.crypto.createKeyPair(toArrayBuffer(identityKeyMsg.identityKeyPrivate)).then(function(identityKeyPair) {
                                if (crypto_storage.getStoredKeyPair("identityKey") !== undefined)
                                    throw new Error("Tried to overwrite identity key");

                                crypto_storage.putKeyPair("identityKey", identityKeyPair);
                                identityKeyMsg.identityKeyPrivate = null;

                                return identityKeyMsg;
                            });
                        });
                    });
                });
            });
        }

        return axolotl.crypto.createKeyPair().then(function(newKeyPair) {
            keyPair = newKeyPair;
            socketInfo.pubKey = keyPair.pubKey;
            return socketInfo;
        });
    }

    return self;
}();

})();
