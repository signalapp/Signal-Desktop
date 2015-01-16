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
describe('Protocol', function() {

    describe("Identity and Pre Key Creation", function() {
        this.timeout(200000);
        before(function() { localStorage.clear(); });
        after(function()  { localStorage.clear(); });
        it ('works', function(done) {
            localStorage.clear();
            return axolotl.protocol.generateKeys().then(function() {
                assert.isDefined(axolotl.api.storage.get("25519KeyidentityKey"));
                assert.isDefined(axolotl.api.storage.get("25519KeysignedKey0"));
                for (var i = 0; i < 100; i++) {
                    assert.isDefined(axolotl.api.storage.get("25519KeypreKey" + i));
                }
                var origIdentityKey = getString(axolotl.api.storage.get("25519KeyidentityKey").privKey);
                return axolotl.protocol.generateKeys().then(function() {
                    assert.isDefined(axolotl.api.storage.get("25519KeyidentityKey"));
                    assert.equal(getString(axolotl.api.storage.get("25519KeyidentityKey").privKey), origIdentityKey);

                    assert.isDefined(axolotl.api.storage.get("25519KeysignedKey0"));
                    assert.isDefined(axolotl.api.storage.get("25519KeysignedKey1"));

                    for (var i = 0; i < 200; i++) {
                        assert.isDefined(axolotl.api.storage.get("25519KeypreKey" + i));
                    }

                    return axolotl.protocol.generateKeys().then(function() {
                        assert.isDefined(axolotl.api.storage.get("25519KeyidentityKey"));
                        assert.equal(getString(axolotl.api.storage.get("25519KeyidentityKey").privKey), origIdentityKey);

                        assert.isUndefined(axolotl.api.storage.get("25519KeysignedKey0"));
                        assert.isDefined(axolotl.api.storage.get("25519KeysignedKey1"));
                        assert.isDefined(axolotl.api.storage.get("25519KeysignedKey2"));

                        for (var i = 0; i < 300; i++) {
                            assert.isDefined(axolotl.api.storage.get("25519KeypreKey" + i));
                        }
                    });
                });
            }).then(done).catch(done);
        });
    });

    describe("Axolotl", function() {
        var runAxolotlTest = function(v) {
            var origCreateKeyPair = axolotl.crypto.createKeyPair;
            var doStep;
            var stepDone;

            stepDone = function(res) {
                if (!res || privKeyQueue.length != 0) {
                    axolotl.crypto.createKeyPair = origCreateKeyPair;
                    return false;
                } else if (step == v.length) {
                    axolotl.crypto.createKeyPair = origCreateKeyPair;
                    return true;
                } else
                    return doStep().then(stepDone);
            }

            var privKeyQueue = [];
            axolotl.crypto.createKeyPair = function(privKey) {
                if (privKey !== undefined)
                    return origCreateKeyPair(privKey);
                if (privKeyQueue.length == 0)
                    throw new Error('Out of private keys');
                else {
                    var privKey = privKeyQueue.shift();
                    return axolotl.crypto.createKeyPair(privKey).then(function(keyPair) {
                        var a = btoa(getString(keyPair.privKey)); var b = btoa(getString(privKey));
                        if (getString(keyPair.privKey) != getString(privKey))
                            throw new Error('Failed to rederive private key!');
                        else
                            return keyPair;
                    });
                }
            }

            var deviceObject = {encodedNumber: "SNOWDEN.1"};

            var step = 0;
            var doStep = function() {
                var data = v[step][1];

                switch(v[step++][0]) {
                case "receiveMessage":
                    var postLocalKeySetup = function() {
                        if (data.newEphemeralKey !== undefined)
                            privKeyQueue.push(data.newEphemeralKey);

                        try {
                            var checkResult = function(res) {
                                res = textsecure.protobuf.PushMessageContent.decode(res[0]);
                                //TODO: Handle END_SESSION here (just like libtextsecure.protocol_wrapper
                                if (data.expectTerminateSession)
                                    return res.flags == textsecure.protobuf.PushMessageContent.Flags.END_SESSION;
                                return res.body == data.expectedSmsText;
                            }
                            var checkException = function(e) {
                                if (data.expectException)
                                    return true;
                                throw e;
                            }

                            if (data.type == textsecure.protobuf.IncomingPushMessageSignal.Type.CIPHERTEXT)
                                return axolotl.protocol.decryptWhisperMessage("SNOWDEN.1", getString(data.message)).then(checkResult).catch(checkException);
                            else if (data.type == textsecure.protobuf.IncomingPushMessageSignal.Type.PREKEY_BUNDLE) {
                                if (getString(data.message).charCodeAt(0) != ((3 << 4) | 3))
                                    throw new Error("Bad version byte");
                                return axolotl.protocol.handlePreKeyWhisperMessage("SNOWDEN.1", getString(data.message).substring(1)).then(checkResult).catch(checkException);
                            } else
                                return Promise.reject(new Error("Unknown data type in test vector"));
                        } catch(e) {
                            if (data.expectException)
                                return Promise.resolve(true);
                            throw e;
                        }
                    }

                    if (data.ourIdentityKey !== undefined)
                        return axolotl.crypto.createKeyPair(data.ourIdentityKey).then(function(keyPair) {
                            axolotl.api.storage.put("25519KeyidentityKey", keyPair);
                            return axolotl.crypto.createKeyPair(data.ourSignedPreKey).then(function(keyPair) {
                                axolotl.api.storage.put("25519KeysignedKey" + data.signedPreKeyId, keyPair);

                                if (data.ourPreKey !== undefined)
                                    return axolotl.crypto.createKeyPair(data.ourPreKey).then(function(keyPair) {
                                        axolotl.api.storage.put("25519KeypreKey" + data.preKeyId, keyPair);
                                        return postLocalKeySetup();
                                    });
                                else
                                    return postLocalKeySetup();
                            });
                        });
                    else
                        return postLocalKeySetup();

                case "sendMessage":
                    var postLocalKeySetup = function() {
                        if (data.registrationId !== undefined)
                            window.myRegistrationId = data.registrationId;

                        if (data.getKeys !== undefined) {
                            deviceObject = {encodedNumber: "SNOWDEN.1",
                                            identityKey: data.getKeys.identityKey,
                                            preKey:   data.getKeys.devices[0].preKey.publicKey,
                                            preKeyId: data.getKeys.devices[0].preKey.keyId,
                                            signedKey:   data.getKeys.devices[0].signedPreKey.publicKey,
                                            signedKeyId: data.getKeys.devices[0].signedPreKey.keyId,
                                            signedKeySignature: data.getKeys.devices[0].signedPreKey.signature,
                                            registrationId: data.getKeys.devices[0].signedPreKey.keyId
                                           };
                        }

                        var checkMessage = function(msg) {
                            //XXX: This should be all we do: isEqual(data.expectedCiphertext, encryptedMsg, false);
                            var encryptedMsg = msg.body;
                            if (msg.type == 1) {
                                var expected = getString(data.expectedCiphertext);
                                var decoded = axolotl.protobuf.WhisperMessage.decode(expected.substring(1, expected.length - 8), 'binary');
                                var result = getString(encryptedMsg);
                                return getString(decoded.encode()) == result.substring(1, result.length - 8);
                            } else {
                                var decoded = axolotl.protobuf.PreKeyWhisperMessage.decode(getString(data.expectedCiphertext).substr(1), 'binary');
                                var result = getString(encryptedMsg).substring(1);
                                return getString(decoded.encode()) == result;
                            }
                        }

                        var proto = new textsecure.protobuf.PushMessageContent();
                        if (data.endSession) {
                            proto.flags = textsecure.protobuf.PushMessageContent.Flags.END_SESSION;
                            proto.body = "TERMINATE";
                        } else
                            proto.body = data.smsText;

                        return axolotl.protocol.encryptMessageFor(deviceObject, proto).then(checkMessage)
                            .then(function(res) {
                                if (data.endSession)
                                    axolotl.protocol.closeOpenSessionForDevice("SNOWDEN.1");
                                return res;
                            });
                    }

                    if (data.ourBaseKey !== undefined)
                        privKeyQueue.push(data.ourBaseKey);
                    if (data.ourEphemeralKey !== undefined)
                        privKeyQueue.push(data.ourEphemeralKey);

                    if (data.ourIdentityKey !== undefined)
                        return axolotl.crypto.createKeyPair(data.ourIdentityKey).then(function(keyPair) {
                            axolotl.api.storage.put("25519KeyidentityKey", keyPair);
                            return postLocalKeySetup();
                        });
                    else
                        return postLocalKeySetup();

                default:
                    return Promise.resolve(false);
                }
            }
            return doStep().then(stepDone);
        };

        describe("test vectors", function() {
            function defineTest(i) {
                it(axolotlTestVectors[i].name, function(done) {
                    localStorage.clear();
                    testSessionMap = {};
                    return runAxolotlTest(axolotlTestVectors[i].vectors).then(function(res) {
                        assert(res);
                    }).then(done).catch(done);
                });
            }
            for (var i in axolotlTestVectors)
                defineTest(i);
        });
    });
});
