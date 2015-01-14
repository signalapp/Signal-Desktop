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

    describe('Unencrypted PushMessageProto "decrypt"', function() {
        //exclusive
        it('works', function(done) {
            localStorage.clear();

            var text_message = new textsecure.protobuf.PushMessageContent();
            text_message.body = "Hi Mom";
            var server_message = {
                type: 4, // unencrypted
                source: "+19999999999",
                timestamp: 42,
                message: text_message.encode()
            };

            return textsecure.protocol.handleIncomingPushMessageProto(server_message).
                then(function(message) {
                    assert.equal(message.body, text_message.body);
                    assert.equal(message.attachments.length, text_message.attachments.length);
                    assert.equal(text_message.attachments.length, 0);
                }).then(done).catch(done);
        });
    });


    describe("Identity and Pre Key Creation", function() {
        this.timeout(200000);
        before(function() { localStorage.clear(); });
        after(function()  { localStorage.clear(); });
        it ('works', function(done) {
            localStorage.clear();
            return textsecure.protocol.generateKeys().then(function() {
                assert.isDefined(textsecure.storage.getEncrypted("25519KeyidentityKey"));
                assert.isDefined(textsecure.storage.getEncrypted("25519KeysignedKey0"));
                for (var i = 0; i < 100; i++) {
                    assert.isDefined(textsecure.storage.getEncrypted("25519KeypreKey" + i));
                }
                var origIdentityKey = getString(textsecure.storage.getEncrypted("25519KeyidentityKey").privKey);
                return textsecure.protocol.generateKeys().then(function() {
                    assert.isDefined(textsecure.storage.getEncrypted("25519KeyidentityKey"));
                    assert.equal(getString(textsecure.storage.getEncrypted("25519KeyidentityKey").privKey), origIdentityKey);

                    assert.isDefined(textsecure.storage.getEncrypted("25519KeysignedKey0"));
                    assert.isDefined(textsecure.storage.getEncrypted("25519KeysignedKey1"));

                    for (var i = 0; i < 200; i++) {
                        assert.isDefined(textsecure.storage.getEncrypted("25519KeypreKey" + i));
                    }

                    return textsecure.protocol.generateKeys().then(function() {
                        assert.isDefined(textsecure.storage.getEncrypted("25519KeyidentityKey"));
                        assert.equal(getString(textsecure.storage.getEncrypted("25519KeyidentityKey").privKey), origIdentityKey);

                        assert.isUndefined(textsecure.storage.getEncrypted("25519KeysignedKey0"));
                        assert.isDefined(textsecure.storage.getEncrypted("25519KeysignedKey1"));
                        assert.isDefined(textsecure.storage.getEncrypted("25519KeysignedKey2"));

                        for (var i = 0; i < 300; i++) {
                            assert.isDefined(textsecure.storage.getEncrypted("25519KeypreKey" + i));
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
                if (!res || privKeyQueue.length != 0 || Object.keys(getKeysForNumberMap).length != 0 || Object.keys(messagesSentMap).length != 0) {
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

            var step = 0;
            var doStep = function() {
                var data = v[step][1];

                switch(v[step++][0]) {
                case "receiveMessage":
                    var postLocalKeySetup = function() {
                        if (data.newEphemeralKey !== undefined)
                            privKeyQueue.push(data.newEphemeralKey);

                        var message = new textsecure.protobuf.IncomingPushMessageSignal();
                        message.type = data.type;
                        message.source = "SNOWDEN";
                        message.message = data.message;
                        message.sourceDevice = 1;
                        try {
                            var proto = textsecure.protobuf.IncomingPushMessageSignal.decode(message.encode());
                            return textsecure.protocol.handleIncomingPushMessageProto(proto).then(function(res) {
                                if (data.expectTerminateSession)
                                    return res.flags == textsecure.protobuf.PushMessageContent.Flags.END_SESSION;
                                return res.body == data.expectedSmsText;
                            }).catch(function(e) {
                                if (data.expectException)
                                    return true;
                                throw e;
                            });
                        } catch(e) {
                            if (data.expectException)
                                return Promise.resolve(true);
                            throw e;
                        }
                    }

                    if (data.ourIdentityKey !== undefined)
                        return axolotl.crypto.createKeyPair(data.ourIdentityKey).then(function(keyPair) {
                            textsecure.storage.putEncrypted("25519KeyidentityKey", keyPair);
                            return axolotl.crypto.createKeyPair(data.ourSignedPreKey).then(function(keyPair) {
                                textsecure.storage.putEncrypted("25519KeysignedKey" + data.signedPreKeyId, keyPair);

                                if (data.ourPreKey !== undefined)
                                    return axolotl.crypto.createKeyPair(data.ourPreKey).then(function(keyPair) {
                                        textsecure.storage.putEncrypted("25519KeypreKey" + data.preKeyId, keyPair);
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
                            textsecure.storage.putUnencrypted("registrationId", data.registrationId);

                        if (data.getKeys !== undefined)
                            getKeysForNumberMap["SNOWDEN"] = data.getKeys;

                        var checkMessage = function() {
                            var msg = messagesSentMap["SNOWDEN.1"];
                            delete messagesSentMap["SNOWDEN.1"];
                            //XXX: This should be all we do: isEqual(data.expectedCiphertext, msg.body, false);
                            if (msg.type == 1) {
                                var expected = getString(data.expectedCiphertext);
                                var decoded = textsecure.protobuf.WhisperMessage.decode(expected.substring(1, expected.length - 8), 'binary');
                                var result = getString(msg.body);
                                return getString(decoded.encode()) == result.substring(1, result.length - 8);
                            } else {
                                var decoded = textsecure.protobuf.PreKeyWhisperMessage.decode(getString(data.expectedCiphertext).substr(1), 'binary');
                                var result = getString(msg.body).substring(1);
                                return getString(decoded.encode()) == result;
                            }
                        }

                        if (data.endSession)
                            return textsecure.messaging.closeSession("SNOWDEN").then(checkMessage);
                        else
                            return textsecure.messaging.sendMessageToNumber("SNOWDEN", data.smsText, [], Date.now()).then(checkMessage);
                    }

                    if (data.ourBaseKey !== undefined)
                        privKeyQueue.push(data.ourBaseKey);
                    if (data.ourEphemeralKey !== undefined)
                        privKeyQueue.push(data.ourEphemeralKey);

                    if (data.ourIdentityKey !== undefined)
                        return axolotl.crypto.createKeyPair(data.ourIdentityKey).then(function(keyPair) {
                            textsecure.storage.putEncrypted("25519KeyidentityKey", keyPair);
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
            for (var i in axolotlTestVectors) {
                it(axolotlTestVectors[i].name, function(done) {
                    localStorage.clear();
                    return runAxolotlTest(axolotlTestVectors[i].vectors).then(function(res) {
                        assert(res);
                    }).then(done).catch(done);
                });
            }
        });
    });
});
