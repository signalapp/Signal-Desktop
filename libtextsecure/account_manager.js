/*
 * vim: ts=4:sw=4:expandtab
 */


;(function () {
    'use strict';
    window.textsecure = window.textsecure || {};

    function AccountManager(url, ports, username, password) {
        this.server = new TextSecureServer(url, ports, username, password);
    }

    AccountManager.prototype = {
        constructor: AccountManager,
        requestVoiceVerification: function(number) {
            return this.server.requestVerificationVoice(number);
        },
        requestSMSVerification: function(number) {
            return this.server.requestVerificationSMS(number);
        },
        registerSingleDevice: function(number, verificationCode) {
            var registerKeys = this.server.registerKeys.bind(this.server);
            var createAccount = this.createAccount.bind(this);
            var generateKeys = this.generateKeys.bind(this, 100);
            return libsignal.KeyHelper.generateIdentityKeyPair().then(function(identityKeyPair) {
                return createAccount(number, verificationCode, identityKeyPair).
                    then(generateKeys).
                    then(registerKeys).
                    then(textsecure.registration.done);
            }.bind(this));
        },
        registerSecondDevice: function(setProvisioningUrl, confirmNumber, progressCallback) {
            var createAccount = this.createAccount.bind(this);
            var generateKeys = this.generateKeys.bind(this, 100, progressCallback);
            var registerKeys = this.server.registerKeys.bind(this.server);
            var getSocket = this.server.getProvisioningSocket.bind(this.server);
            var provisioningCipher = new libsignal.ProvisioningCipher();
            return provisioningCipher.getPublicKey().then(function(pubKey) {
                return new Promise(function(resolve, reject) {
                    var socket = getSocket();
                    socket.onclose = function(e) {
                        console.log('websocket closed', e.code);
                        reject(new Error('websocket closed'));
                    };
                    var wsr = new WebSocketResource(socket, {
                        keepalive: { path: '/v1/keepalive/provisioning' },
                        handleRequest: function(request) {
                            if (request.path === "/v1/address" && request.verb === "PUT") {
                                var proto = textsecure.protobuf.ProvisioningUuid.decode(request.body);
                                setProvisioningUrl([
                                    'tsdevice:/?uuid=', proto.uuid, '&pub_key=',
                                    encodeURIComponent(btoa(getString(pubKey)))
                                ].join(''));
                                request.respond(200, 'OK');
                            } else if (request.path === "/v1/message" && request.verb === "PUT") {
                                var envelope = textsecure.protobuf.ProvisionEnvelope.decode(request.body, 'binary');
                                request.respond(200, 'OK');
                                wsr.close();
                                resolve(provisioningCipher.decrypt(envelope).then(function(provisionMessage) {
                                    return confirmNumber(provisionMessage.number).then(function(deviceName) {
                                        if (typeof deviceName !== 'string' || deviceName.length === 0) {
                                            throw new Error('Invalid device name');
                                        }
                                        return createAccount(
                                            provisionMessage.number,
                                            provisionMessage.provisioningCode,
                                            provisionMessage.identityKeyPair,
                                            deviceName
                                        );
                                    });
                                }));
                            } else {
                                console.log('Unknown websocket message', request.path);
                            }
                        }
                    });
                });
            }).then(generateKeys).
               then(registerKeys).
               then(textsecure.registration.done);
        },
        refreshPreKeys: function() {
            var generateKeys = this.generateKeys.bind(this, 100);
            var registerKeys = this.server.registerKeys.bind(this.server);
            return this.server.getMyKeys().then(function(preKeyCount) {
                console.log('prekey count ' + preKeyCount);
                if (preKeyCount < 10) {
                    return generateKeys().then(registerKeys);
                }
            }.bind(this));
        },
        createAccount: function(number, verificationCode, identityKeyPair, deviceName) {
            var signalingKey = libsignal.crypto.getRandomBytes(32 + 20);
            var password = btoa(getString(libsignal.crypto.getRandomBytes(16)));
            password = password.substring(0, password.length - 2);
            var registrationId = libsignal.KeyHelper.generateRegistrationId();

            return this.server.confirmCode(
                number, verificationCode, password, signalingKey, registrationId, deviceName
            ).then(function(response) {
                return textsecure.storage.protocol.clearSessionStore().then(function() {
                    textsecure.storage.remove('identityKey');
                    textsecure.storage.remove('signaling_key');
                    textsecure.storage.remove('password');
                    textsecure.storage.remove('registrationId');
                    textsecure.storage.remove('number_id');
                    textsecure.storage.remove('device_name');
                    textsecure.storage.remove('regionCode');

                    // update our own identity key, which may have changed
                    // if we're relinking after a reinstall on the master device
                    var putIdentity = textsecure.storage.protocol.saveIdentity.bind(
                        null, number, identityKeyPair.pubKey
                    );
                    textsecure.storage.protocol.removeIdentityKey(number).then(putIdentity, putIdentity);

                    textsecure.storage.put('identityKey', identityKeyPair);
                    textsecure.storage.put('signaling_key', signalingKey);
                    textsecure.storage.put('password', password);
                    textsecure.storage.put('registrationId', registrationId);

                    textsecure.storage.user.setNumberAndDeviceId(number, response.deviceId || 1, deviceName);
                    textsecure.storage.put('regionCode', libphonenumber.util.getRegionCodeForNumber(number));
                    this.server.username = textsecure.storage.get('number_id');
                }.bind(this));
            }.bind(this));
        },
        generateKeys: function (count, progressCallback) {
            if (typeof progressCallback !== 'function') {
                progressCallback = undefined;
            }
            var startId = textsecure.storage.get('maxPreKeyId', 1);
            var signedKeyId = textsecure.storage.get('signedKeyId', 1);

            if (typeof startId != 'number') {
                throw new Error('Invalid maxPreKeyId');
            }
            if (typeof signedKeyId != 'number') {
                throw new Error('Invalid signedKeyId');
            }


            var store = textsecure.storage.protocol;
            return store.getIdentityKeyPair().then(function(identityKey) {
                var result = { preKeys: [], identityKey: identityKey.pubKey };
                var promises = [];

                for (var keyId = startId; keyId < startId+count; ++keyId) {
                    promises.push(
                        libsignal.KeyHelper.generatePreKey(keyId).then(function(res) {
                            store.storePreKey(res.keyId, res.keyPair);
                            result.preKeys.push({
                                keyId     : res.keyId,
                                publicKey : res.keyPair.pubKey
                            });
                            if (progressCallback) { progressCallback(); }
                        })
                    );
                }

                promises.push(
                    libsignal.KeyHelper.generateSignedPreKey(identityKey, signedKeyId).then(function(res) {
                        store.storeSignedPreKey(res.keyId, res.keyPair);
                        result.signedPreKey = {
                            keyId     : res.keyId,
                            publicKey : res.keyPair.pubKey,
                            signature : res.signature
                        };
                    })
                );

                store.removeSignedPreKey(signedKeyId - 2);
                textsecure.storage.put('maxPreKeyId', startId + count);
                textsecure.storage.put('signedKeyId', signedKeyId + 1);
                return Promise.all(promises).then(function() {
                    return result;
                });
            });
        }
    };
    textsecure.AccountManager = AccountManager;

}());
