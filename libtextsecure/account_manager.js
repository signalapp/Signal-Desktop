(function() {
  'use strict';
  window.textsecure = window.textsecure || {};

  var ARCHIVE_AGE = 7 * 24 * 60 * 60 * 1000;

  function AccountManager(url, username, password) {
    this.server = window.WebAPI.connect({ username, password });
    this.pending = Promise.resolve();
  }

  function getNumber(numberId) {
    if (!numberId || !numberId.length) {
      return numberId;
    }

    var parts = numberId.split('.');
    if (!parts.length) {
      return numberId;
    }

    return parts[0];
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
      var clearSessionsAndPreKeys = this.clearSessionsAndPreKeys.bind(this);
      var generateKeys = this.generateKeys.bind(this, 100);
      var confirmKeys = this.confirmKeys.bind(this);
      var registrationDone = this.registrationDone.bind(this);
      return this.queueTask(function() {
        return libsignal.KeyHelper.generateIdentityKeyPair().then(function(
          identityKeyPair
        ) {
          var profileKey = textsecure.crypto.getRandomBytes(32);
          return createAccount(
            number,
            verificationCode,
            identityKeyPair,
            profileKey
          )
            .then(clearSessionsAndPreKeys)
            .then(generateKeys)
            .then(function(keys) {
              return registerKeys(keys).then(function() {
                return confirmKeys(keys);
              });
            })
            .then(registrationDone);
        });
      });
    },
    registerSecondDevice: function(
      setProvisioningUrl,
      confirmNumber,
      progressCallback
    ) {
      var createAccount = this.createAccount.bind(this);
      var clearSessionsAndPreKeys = this.clearSessionsAndPreKeys.bind(this);
      var generateKeys = this.generateKeys.bind(this, 100, progressCallback);
      var confirmKeys = this.confirmKeys.bind(this);
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
              if (request.path === '/v1/address' && request.verb === 'PUT') {
                var proto = textsecure.protobuf.ProvisioningUuid.decode(
                  request.body
                );
                setProvisioningUrl(
                  [
                    'tsdevice:/?uuid=',
                    proto.uuid,
                    '&pub_key=',
                    encodeURIComponent(btoa(getString(pubKey))),
                  ].join('')
                );
                request.respond(200, 'OK');
              } else if (
                request.path === '/v1/message' &&
                request.verb === 'PUT'
              ) {
                var envelope = textsecure.protobuf.ProvisionEnvelope.decode(
                  request.body,
                  'binary'
                );
                request.respond(200, 'OK');
                gotProvisionEnvelope = true;
                wsr.close();
                resolve(
                  provisioningCipher
                    .decrypt(envelope)
                    .then(function(provisionMessage) {
                      return queueTask(function() {
                        return confirmNumber(provisionMessage.number).then(
                          function(deviceName) {
                            if (
                              typeof deviceName !== 'string' ||
                              deviceName.length === 0
                            ) {
                              throw new Error('Invalid device name');
                            }
                            return createAccount(
                              provisionMessage.number,
                              provisionMessage.provisioningCode,
                              provisionMessage.identityKeyPair,
                              provisionMessage.profileKey,
                              deviceName,
                              provisionMessage.userAgent,
                              provisionMessage.readReceipts
                            )
                              .then(clearSessionsAndPreKeys)
                              .then(generateKeys)
                              .then(function(keys) {
                                return registerKeys(keys).then(function() {
                                  return confirmKeys(keys);
                                });
                              })
                              .then(registrationDone);
                          }
                        );
                      });
                    })
                );
              } else {
                console.log('Unknown websocket message', request.path);
              }
            },
          });
        });
      });
    },
    refreshPreKeys: function() {
      var generateKeys = this.generateKeys.bind(this, 100);
      var registerKeys = this.server.registerKeys.bind(this.server);

      return this.queueTask(
        function() {
          return this.server.getMyKeys().then(function(preKeyCount) {
            console.log('prekey count ' + preKeyCount);
            if (preKeyCount < 10) {
              return generateKeys().then(registerKeys);
            }
          });
        }.bind(this)
      );
    },
    rotateSignedPreKey: function() {
      return this.queueTask(
        function() {
          var signedKeyId = textsecure.storage.get('signedKeyId', 1);
          if (typeof signedKeyId != 'number') {
            throw new Error('Invalid signedKeyId');
          }

          var store = textsecure.storage.protocol;
          var server = this.server;
          var cleanSignedPreKeys = this.cleanSignedPreKeys;

          // TODO: harden this against missing identity key? Otherwise, we get
          //   retries every five seconds.
          return store
            .getIdentityKeyPair()
            .then(
              function(identityKey) {
                return libsignal.KeyHelper.generateSignedPreKey(
                  identityKey,
                  signedKeyId
                );
              },
              function(error) {
                console.log(
                  'Failed to get identity key. Canceling key rotation.'
                );
              }
            )
            .then(function(res) {
              if (!res) {
                return;
              }
              console.log('Saving new signed prekey', res.keyId);
              return Promise.all([
                textsecure.storage.put('signedKeyId', signedKeyId + 1),
                store.storeSignedPreKey(res.keyId, res.keyPair),
                server.setSignedPreKey({
                  keyId: res.keyId,
                  publicKey: res.keyPair.pubKey,
                  signature: res.signature,
                }),
              ])
                .then(function() {
                  var confirmed = true;
                  console.log('Confirming new signed prekey', res.keyId);
                  return Promise.all([
                    textsecure.storage.remove('signedKeyRotationRejected'),
                    store.storeSignedPreKey(res.keyId, res.keyPair, confirmed),
                  ]);
                })
                .then(function() {
                  return cleanSignedPreKeys();
                });
            })
            .catch(function(e) {
              console.log(
                'rotateSignedPrekey error:',
                e && e.stack ? e.stack : e
              );

              if (
                e instanceof Error &&
                e.name == 'HTTPError' &&
                e.code >= 400 &&
                e.code <= 599
              ) {
                var rejections =
                  1 + textsecure.storage.get('signedKeyRotationRejected', 0);
                textsecure.storage.put('signedKeyRotationRejected', rejections);
                console.log('Signed key rotation rejected count:', rejections);
              } else {
                throw e;
              }
            });
        }.bind(this)
      );
    },
    queueTask: function(task) {
      var taskWithTimeout = textsecure.createTaskWithTimeout(task);
      return (this.pending = this.pending.then(
        taskWithTimeout,
        taskWithTimeout
      ));
    },
    cleanSignedPreKeys: function() {
      var MINIMUM_KEYS = 3;
      var store = textsecure.storage.protocol;
      return store.loadSignedPreKeys().then(function(allKeys) {
        allKeys.sort(function(a, b) {
          return (a.created_at || 0) - (b.created_at || 0);
        });
        allKeys.reverse(); // we want the most recent first
        var confirmed = allKeys.filter(function(key) {
          return key.confirmed;
        });
        var unconfirmed = allKeys.filter(function(key) {
          return !key.confirmed;
        });

        var recent = allKeys[0] ? allKeys[0].keyId : 'none';
        var recentConfirmed = confirmed[0] ? confirmed[0].keyId : 'none';
        console.log('Most recent signed key: ' + recent);
        console.log('Most recent confirmed signed key: ' + recentConfirmed);
        console.log(
          'Total signed key count:',
          allKeys.length,
          '-',
          confirmed.length,
          'confirmed'
        );

        var confirmedCount = confirmed.length;

        // Keep MINIMUM_KEYS confirmed keys, then drop if older than a week
        confirmed = confirmed.forEach(function(key, index) {
          if (index < MINIMUM_KEYS) {
            return;
          }
          var created_at = key.created_at || 0;
          var age = Date.now() - created_at;
          if (age > ARCHIVE_AGE) {
            console.log(
              'Removing confirmed signed prekey:',
              key.keyId,
              'with timestamp:',
              created_at
            );
            store.removeSignedPreKey(key.keyId);
            confirmedCount--;
          }
        });

        var stillNeeded = MINIMUM_KEYS - confirmedCount;

        // If we still don't have enough total keys, we keep as many unconfirmed
        // keys as necessary. If not necessary, and over a week old, we drop.
        unconfirmed.forEach(function(key, index) {
          if (index < stillNeeded) {
            return;
          }

          var created_at = key.created_at || 0;
          var age = Date.now() - created_at;
          if (age > ARCHIVE_AGE) {
            console.log(
              'Removing unconfirmed signed prekey:',
              key.keyId,
              'with timestamp:',
              created_at
            );
            store.removeSignedPreKey(key.keyId);
          }
        });
      });
    },
    createAccount: function(
      number,
      verificationCode,
      identityKeyPair,
      profileKey,
      deviceName,
      userAgent,
      readReceipts
    ) {
      var signalingKey = libsignal.crypto.getRandomBytes(32 + 20);
      var password = btoa(getString(libsignal.crypto.getRandomBytes(16)));
      password = password.substring(0, password.length - 2);
      var registrationId = libsignal.KeyHelper.generateRegistrationId();

      var previousNumber = getNumber(textsecure.storage.get('number_id'));

      return this.server
        .confirmCode(
          number,
          verificationCode,
          password,
          signalingKey,
          registrationId,
          deviceName
        )
        .then(function(response) {
          if (previousNumber && previousNumber !== number) {
            console.log(
              'New number is different from old number; deleting all previous data'
            );

            return textsecure.storage.protocol.removeAllData().then(
              function() {
                console.log('Successfully deleted previous data');
                return response;
              },
              function(error) {
                console.log(
                  'Something went wrong deleting data from previous number',
                  error && error.stack ? error.stack : error
                );

                return response;
              }
            );
          }

          return response;
        })
        .then(
          function(response) {
            textsecure.storage.remove('identityKey');
            textsecure.storage.remove('signaling_key');
            textsecure.storage.remove('password');
            textsecure.storage.remove('registrationId');
            textsecure.storage.remove('number_id');
            textsecure.storage.remove('device_name');
            textsecure.storage.remove('regionCode');
            textsecure.storage.remove('userAgent');
            textsecure.storage.remove('profileKey');
            textsecure.storage.remove('read-receipts-setting');

            // update our own identity key, which may have changed
            // if we're relinking after a reinstall on the master device
            textsecure.storage.protocol.saveIdentityWithAttributes(number, {
              id: number,
              publicKey: identityKeyPair.pubKey,
              firstUse: true,
              timestamp: Date.now(),
              verified: textsecure.storage.protocol.VerifiedStatus.VERIFIED,
              nonblockingApproval: true,
            });

            textsecure.storage.put('identityKey', identityKeyPair);
            textsecure.storage.put('signaling_key', signalingKey);
            textsecure.storage.put('password', password);
            textsecure.storage.put('registrationId', registrationId);
            if (profileKey) {
              textsecure.storage.put('profileKey', profileKey);
            }
            if (userAgent) {
              textsecure.storage.put('userAgent', userAgent);
            }
            if (readReceipts) {
              textsecure.storage.put('read-receipt-setting', true);
            } else {
              textsecure.storage.put('read-receipt-setting', false);
            }

            textsecure.storage.user.setNumberAndDeviceId(
              number,
              response.deviceId || 1,
              deviceName
            );
            textsecure.storage.put(
              'regionCode',
              libphonenumber.util.getRegionCodeForNumber(number)
            );
          }.bind(this)
        );
    },
    clearSessionsAndPreKeys: function() {
      var store = textsecure.storage.protocol;

      console.log('clearing all sessions, prekeys, and signed prekeys');
      return Promise.all([
        store.clearPreKeyStore(),
        store.clearSignedPreKeysStore(),
        store.clearSessionStore(),
      ]);
    },
    // Takes the same object returned by generateKeys
    confirmKeys: function(keys) {
      var store = textsecure.storage.protocol;
      var key = keys.signedPreKey;
      var confirmed = true;

      console.log('confirmKeys: confirming key', key.keyId);
      return store.storeSignedPreKey(key.keyId, key.keyPair, confirmed);
    },
    generateKeys: function(count, progressCallback) {
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
      return store.getIdentityKeyPair().then(
        function(identityKey) {
          var result = { preKeys: [], identityKey: identityKey.pubKey };
          var promises = [];

          for (var keyId = startId; keyId < startId + count; ++keyId) {
            promises.push(
              libsignal.KeyHelper.generatePreKey(keyId).then(function(res) {
                store.storePreKey(res.keyId, res.keyPair);
                result.preKeys.push({
                  keyId: res.keyId,
                  publicKey: res.keyPair.pubKey,
                });
                if (progressCallback) {
                  progressCallback();
                }
              })
            );
          }

          promises.push(
            libsignal.KeyHelper.generateSignedPreKey(
              identityKey,
              signedKeyId
            ).then(function(res) {
              store.storeSignedPreKey(res.keyId, res.keyPair);
              result.signedPreKey = {
                keyId: res.keyId,
                publicKey: res.keyPair.pubKey,
                signature: res.signature,
                // server.registerKeys doesn't use keyPair, confirmKeys does
                keyPair: res.keyPair,
              };
            })
          );

          textsecure.storage.put('maxPreKeyId', startId + count);
          textsecure.storage.put('signedKeyId', signedKeyId + 1);
          return Promise.all(promises).then(
            function() {
              // This is primarily for the signed prekey summary it logs out
              return this.cleanSignedPreKeys().then(function() {
                return result;
              });
            }.bind(this)
          );
        }.bind(this)
      );
    },
    registrationDone: function() {
      console.log('registration done');
      this.dispatchEvent(new Event('registration'));
    },
  });
  textsecure.AccountManager = AccountManager;
})();
