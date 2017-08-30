/*
 * vim: ts=4:sw=4:expandtab
 */


;(function () {
    'use strict';
    window.textsecure = window.textsecure || {};

    var ARCHIVE_AGE = 7 * 24 * 60 * 60 * 1000;

    function AccountManager(url, username, password) {
        this.server = new TextSecureServer(url, username, password);
        this.pending = Promise.resolve();
    }

    AccountManager.prototype = new textsecure.EventTarget();
    AccountManager.prototype.extend({
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
            var registrationDone = this.registrationDone.bind(this);
            return this.queueTask(function() {
                return libsignal.KeyHelper.generateIdentityKeyPair().then(function(identityKeyPair) {
                    var profileKey = textsecure.crypto.getRandomBytes(32);
                    return createAccount(number, verificationCode, identityKeyPair, profileKey).
                        then(generateKeys).
                        then(registerKeys).
                        then(registrationDone);
                });
            });
        },
        registerSecondDevice: function(setProvisioningUrl, confirmNumber, progressCallback) {
            var createAccount = this.createAccount.bind(this);
            var generateKeys = this.generateKeys.bind(this, 100, progressCallback);
            var registrationDone = this.registrationDone.bind(this);
            var registerKeys = this.server.registerKeys.bind(this.server);
            var getSocket = this.server.getProvisioningSocket.bind(this.server);
            var queueTask = this.queueTask.bind(this);
            var provisioningCipher = new libsignal.ProvisioningCipher();
            var gotProvisionEnvelope = false;
            return provisioningCipher.getPublicKey().then(function(pubKey) {
                return new Promise(function(resolve, reject) {
                    var socket = getSocket();
                    socket.onclose = function(e) {
                        console.log('provisioning socket closed', e.code);
                        if (!gotProvisionEnvelope) {
                            reject(new Error('websocket closed'));
                        }
                    };
                    socket.onopen = function(e) {
                        console.log('provisioning socket open');
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
                                gotProvisionEnvelope = true;
                                wsr.close();
                                resolve(provisioningCipher.decrypt(envelope).then(function(provisionMessage) {
                                    return queueTask(function() {
                                        return confirmNumber(provisionMessage.number).then(function(deviceName) {
                                            if (typeof deviceName !== 'string' || deviceName.length === 0) {
                                                throw new Error('Invalid device name');
                                            }
                                            return createAccount(
                                                provisionMessage.number,
                                                provisionMessage.provisioningCode,
                                                provisionMessage.identityKeyPair,
                                                provisionMessage.profileKey,
                                                deviceName,
                                                provisionMessage.userAgent
                                            ).then(generateKeys).
                                              then(registerKeys).
                                              then(registrationDone);
                                        });
                                    });
                                }));
                            } else {
                                console.log('Unknown websocket message', request.path);
                            }
                        }
                    });
                });
            });
        },
        refreshPreKeys: function() {
            var generateKeys = this.generateKeys.bind(this, 100);
            var registerKeys = this.server.registerKeys.bind(this.server);

            return this.queueTask(function() {
                return this.server.getMyKeys().then(function(preKeyCount) {
                    console.log('prekey count ' + preKeyCount);
                    if (preKeyCount < 10) {
                        return generateKeys().then(registerKeys);
                    }
                });
            }.bind(this));
        },
        rotateSignedPreKey: function() {
            return this.queueTask(function() {
                var signedKeyId = textsecure.storage.get('signedKeyId', 1);

                if (typeof signedKeyId != 'number') {
                    throw new Error('Invalid signedKeyId');
                }
                var store = textsecure.storage.protocol;
                var server = this.server;
                var cleanSignedPreKeys = this.cleanSignedPreKeys;
                return store.getIdentityKeyPair().then(function(identityKey) {
                    return libsignal.KeyHelper.generateSignedPreKey(identityKey, signedKeyId);
                }).then(function(res) {
                    return server.setSignedPreKey({
                        keyId     : res.keyId,
                        publicKey : res.keyPair.pubKey,
                        signature : res.signature
                    }).then(function() {
                        textsecure.storage.put('signedKeyId', signedKeyId + 1);
                        textsecure.storage.remove('signedKeyRotationRejected');
                        return store.storeSignedPreKey(res.keyId, res.keyPair).then(function() {
                            return cleanSignedPreKeys();
                        });
                    }).catch(function(e) {
                        if (e instanceof Error && e.name == 'HTTPError' && e.code >= 400 && e.code <= 599) {
                            var rejections = 1 + textsecure.storage.get('signedKeyRotationRejected', 0);
                            textsecure.storage.put('signedKeyRotationRejected', rejections);
                            console.log('Signed key rotation rejected count:', rejections);
                        }
                    });
                });
            }.bind(this));
        },
        queueTask: function(task) {
            var taskWithTimeout = textsecure.createTaskWithTimeout(task);
            return this.pending = this.pending.then(taskWithTimeout, taskWithTimeout);
        },
        cleanSignedPreKeys: function() {
            var nextSignedKeyId = textsecure.storage.get('signedKeyId');
            if (typeof nextSignedKeyId != 'number') {
                return Promise.resolve();
            }
            var activeSignedPreKeyId = nextSignedKeyId - 1;

            var store = textsecure.storage.protocol;
            return store.loadSignedPreKeys().then(function(allRecords) {
                var oldRecords = allRecords.filter(function(record) {
                    return record.keyId !== activeSignedPreKeyId;
                });
                oldRecords.sort(function(a, b) {
                    return (a.created_at || 0) - (b.created_at || 0);
                });

                console.log("Active signed prekey: " + activeSignedPreKeyId);
                console.log("Old signed prekey record count: " + oldRecords.length);

                oldRecords.forEach(function(oldRecord) {
                    if ( oldRecord.keyId > activeSignedPreKeyId - 3 ) {
                        // keep at least the last 3 signed keys
                        return;
                    }
                    var created_at = oldRecord.created_at || 0;
                    var archiveDuration = Date.now() - created_at;
                    if (archiveDuration > ARCHIVE_AGE) {
                        console.log("Removing signed prekey record:",
                          oldRecord.keyId, "with timestamp:", created_at);
                        store.removeSignedPreKey(oldRecord.keyId);
                    }
                });
            });
        },
        createAccount: function(number, verificationCode, identityKeyPair, profileKey, deviceName, userAgent) {
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
                    textsecure.storage.remove('userAgent');
                    textsecure.storage.remove('profileKey');

                    // update our own identity key, which may have changed
                    // if we're relinking after a reinstall on the master device
                    textsecure.storage.protocol.saveIdentityWithAttributes(number, {
                        id                  : number,
                        publicKey           : identityKeyPair.pubKey,
                        firstUse            : true,
                        timestamp           : Date.now(),
                        verified            : textsecure.storage.protocol.VerifiedStatus.VERIFIED,
                        nonblockingApproval : true
                    });

                    textsecure.storage.put('identityKey', identityKeyPair);
                    textsecure.storage.put('signaling_key', signalingKey);
                    textsecure.storage.put('password', password);
                    textsecure.storage.put('registrationId', registrationId);
                    textsecure.storage.put('profileKey', profileKey);
                    if (userAgent) {
                        textsecure.storage.put('userAgent', userAgent);
                    }

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

                textsecure.storage.put('maxPreKeyId', startId + count);
                textsecure.storage.put('signedKeyId', signedKeyId + 1);
                return Promise.all(promises).then(function() {
                    return this.cleanSignedPreKeys().then(function() {
                        return result;
                    });
                }.bind(this));
            }.bind(this));
        },
        registrationDone: function() {
            console.log('registration done');
            this.dispatchEvent(new Event('registration'));
        }
    });
    textsecure.AccountManager = AccountManager;

}());
