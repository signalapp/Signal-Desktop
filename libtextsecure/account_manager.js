/* global
  window,
  textsecure,
  libsignal,
  WebSocketResource,
  btoa,
  getString,
  libphonenumber,
  Event
*/

/* eslint-disable more/no-then */

// eslint-disable-next-line func-names
(function() {
  window.textsecure = window.textsecure || {};

  const ARCHIVE_AGE = 7 * 24 * 60 * 60 * 1000;

  function AccountManager(username, password) {
    this.server = window.WebAPI.connect({ username, password });
    this.pending = Promise.resolve();
  }

  function getNumber(numberId) {
    if (!numberId || !numberId.length) {
      return numberId;
    }

    const parts = numberId.split('.');
    if (!parts.length) {
      return numberId;
    }

    return parts[0];
  }

  AccountManager.prototype = new textsecure.EventTarget();
  AccountManager.prototype.extend({
    constructor: AccountManager,
    requestVoiceVerification(number) {
      return this.server.requestVerificationVoice(number);
    },
    requestSMSVerification(number) {
      return this.server.requestVerificationSMS(number);
    },
    registerSingleDevice() {
      const createAccount = this.createAccount.bind(this);
      const clearSessionsAndPreKeys = this.clearSessionsAndPreKeys.bind(this);
      const generateKeys = this.generateKeys.bind(this, 100);
      const confirmKeys = this.confirmKeys.bind(this);
      const registrationDone = this.registrationDone.bind(this);
      return this.queueTask(() =>
        libsignal.KeyHelper.generateIdentityKeyPair().then(identityKeyPair => {
          return createAccount(
            identityKeyPair,
          )
            .then(clearSessionsAndPreKeys)
            .then(generateKeys)
            .then(keys => confirmKeys(keys))
            .then(registrationDone);
        })
      );
    },
    registerSecondDevice(setProvisioningUrl, confirmNumber, progressCallback) {
      const createAccount = this.createAccount.bind(this);
      const clearSessionsAndPreKeys = this.clearSessionsAndPreKeys.bind(this);
      const generateKeys = this.generateKeys.bind(this, 100, progressCallback);
      const confirmKeys = this.confirmKeys.bind(this);
      const registrationDone = this.registrationDone.bind(this);
      const registerKeys = this.server.registerKeys.bind(this.server);
      const getSocket = this.server.getProvisioningSocket.bind(this.server);
      const queueTask = this.queueTask.bind(this);
      const provisioningCipher = new libsignal.ProvisioningCipher();
      let gotProvisionEnvelope = false;
      return provisioningCipher.getPublicKey().then(
        pubKey =>
          new Promise((resolve, reject) => {
            const socket = getSocket();
            socket.onclose = event => {
              window.log.info('provisioning socket closed. Code:', event.code);
              if (!gotProvisionEnvelope) {
                reject(new Error('websocket closed'));
              }
            };
            socket.onopen = () => {
              window.log.info('provisioning socket open');
            };
            const wsr = new WebSocketResource(socket, {
              keepalive: { path: '/v1/keepalive/provisioning' },
              handleRequest(request) {
                if (request.path === '/v1/address' && request.verb === 'PUT') {
                  const proto = textsecure.protobuf.ProvisioningUuid.decode(
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
                  const envelope = textsecure.protobuf.ProvisionEnvelope.decode(
                    request.body,
                    'binary'
                  );
                  request.respond(200, 'OK');
                  gotProvisionEnvelope = true;
                  wsr.close();
                  resolve(
                    provisioningCipher
                      .decrypt(envelope)
                      .then(provisionMessage =>
                        queueTask(() =>
                          confirmNumber(provisionMessage.number).then(
                            deviceName => {
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
                                .then(keys =>
                                  registerKeys(keys).then(() =>
                                    confirmKeys(keys)
                                  )
                                )
                                .then(registrationDone);
                            }
                          )
                        )
                      )
                  );
                } else {
                  window.log.error('Unknown websocket message', request.path);
                }
              },
            });
          })
      );
    },
    refreshPreKeys() {
      const generateKeys = this.generateKeys.bind(this, 100);
      const registerKeys = this.server.registerKeys.bind(this.server);

      return this.queueTask(() =>
        this.server.getMyKeys().then(preKeyCount => {
          window.log.info(`prekey count ${preKeyCount}`);
          if (preKeyCount < 10) {
            return generateKeys().then(registerKeys);
          }
          return null;
        })
      );
    },
    rotateSignedPreKey() {
      return this.queueTask(() => {
        const signedKeyId = textsecure.storage.get('signedKeyId', 1);
        if (typeof signedKeyId !== 'number') {
          throw new Error('Invalid signedKeyId');
        }

        const store = textsecure.storage.protocol;
        const { server, cleanSignedPreKeys } = this;

        // TODO: harden this against missing identity key? Otherwise, we get
        //   retries every five seconds.
        return store
          .getIdentityKeyPair()
          .then(
            identityKey =>
              libsignal.KeyHelper.generateSignedPreKey(
                identityKey,
                signedKeyId
              ),
            () => {
              window.log.error(
                'Failed to get identity key. Canceling key rotation.'
              );
            }
          )
          .then(res => {
            if (!res) {
              return null;
            }
            window.log.info('Saving new signed prekey', res.keyId);
            return Promise.all([
              textsecure.storage.put('signedKeyId', signedKeyId + 1),
              store.storeSignedPreKey(res.keyId, res.keyPair),
            ])
              .then(() => {
                const confirmed = true;
                window.log.info('Confirming new signed prekey', res.keyId);
                return Promise.all([
                  textsecure.storage.remove('signedKeyRotationRejected'),
                  store.storeSignedPreKey(res.keyId, res.keyPair, confirmed),
                ]);
              })
              .then(() => cleanSignedPreKeys());
          })
          .catch(e => {
            window.log.error(
              'rotateSignedPrekey error:',
              e && e.stack ? e.stack : e
            );

            if (
              e instanceof Error &&
              e.name === 'HTTPError' &&
              e.code >= 400 &&
              e.code <= 599
            ) {
              const rejections =
                1 + textsecure.storage.get('signedKeyRotationRejected', 0);
              textsecure.storage.put('signedKeyRotationRejected', rejections);
              window.log.error(
                'Signed key rotation rejected count:',
                rejections
              );
            } else {
              throw e;
            }
          });
      });
    },
    queueTask(task) {
      const taskWithTimeout = textsecure.createTaskWithTimeout(task);
      this.pending = this.pending.then(taskWithTimeout, taskWithTimeout);

      return this.pending;
    },
    cleanSignedPreKeys() {
      const MINIMUM_KEYS = 3;
      const store = textsecure.storage.protocol;
      return store.loadSignedPreKeys().then(allKeys => {
        allKeys.sort((a, b) => (a.created_at || 0) - (b.created_at || 0));
        allKeys.reverse(); // we want the most recent first
        let confirmed = allKeys.filter(key => key.confirmed);
        const unconfirmed = allKeys.filter(key => !key.confirmed);

        const recent = allKeys[0] ? allKeys[0].keyId : 'none';
        const recentConfirmed = confirmed[0] ? confirmed[0].keyId : 'none';
        window.log.info(`Most recent signed key: ${recent}`);
        window.log.info(`Most recent confirmed signed key: ${recentConfirmed}`);
        window.log.info(
          'Total signed key count:',
          allKeys.length,
          '-',
          confirmed.length,
          'confirmed'
        );

        let confirmedCount = confirmed.length;

        // Keep MINIMUM_KEYS confirmed keys, then drop if older than a week
        confirmed = confirmed.forEach((key, index) => {
          if (index < MINIMUM_KEYS) {
            return;
          }
          const createdAt = key.created_at || 0;
          const age = Date.now() - createdAt;

          if (age > ARCHIVE_AGE) {
            window.log.info(
              'Removing confirmed signed prekey:',
              key.keyId,
              'with timestamp:',
              createdAt
            );
            store.removeSignedPreKey(key.keyId);
            confirmedCount -= 1;
          }
        });

        const stillNeeded = MINIMUM_KEYS - confirmedCount;

        // If we still don't have enough total keys, we keep as many unconfirmed
        // keys as necessary. If not necessary, and over a week old, we drop.
        unconfirmed.forEach((key, index) => {
          if (index < stillNeeded) {
            return;
          }

          const createdAt = key.created_at || 0;
          const age = Date.now() - createdAt;
          if (age > ARCHIVE_AGE) {
            window.log.info(
              'Removing unconfirmed signed prekey:',
              key.keyId,
              'with timestamp:',
              createdAt
            );
            store.removeSignedPreKey(key.keyId);
          }
        });
      });
    },
    createAccount(
      identityKeyPair,
      userAgent,
      readReceipts
    ) {
      return Promise.resolve()
        .then(response => {
          textsecure.storage.remove('identityKey');
          textsecure.storage.remove('number_id');
          textsecure.storage.remove('device_name');
          textsecure.storage.remove('userAgent');
          textsecure.storage.remove('read-receipts-setting');

          // update our own identity key, which may have changed
          // if we're relinking after a reinstall on the master device
          const pubKeyString = textsecure.MessageReceiver.arrayBufferToStringBase64(identityKeyPair.pubKey);

          textsecure.storage.protocol.saveIdentityWithAttributes(pubKeyString, {
            id: pubKeyString,
            publicKey: identityKeyPair.pubKey,
            firstUse: true,
            timestamp: Date.now(),
            verified: textsecure.storage.protocol.VerifiedStatus.VERIFIED,
            nonblockingApproval: true,
          });

          textsecure.storage.put('identityKey', identityKeyPair);
          if (userAgent) {
            textsecure.storage.put('userAgent', userAgent);
          }
          if (readReceipts) {
            textsecure.storage.put('read-receipt-setting', true);
          } else {
            textsecure.storage.put('read-receipt-setting', false);
          }

          textsecure.storage.user.setNumberAndDeviceId(
           pubKeyString,
           1,
          );
        });
    },
    clearSessionsAndPreKeys() {
      const store = textsecure.storage.protocol;

      window.log.info('clearing all sessions, prekeys, and signed prekeys');
      return Promise.all([
        store.clearPreKeyStore(),
        store.clearSignedPreKeysStore(),
        store.clearSessionStore(),
      ]);
    },
    // Takes the same object returned by generateKeys
    confirmKeys(keys) {
      const store = textsecure.storage.protocol;
      const key = keys.signedPreKey;
      const confirmed = true;

      window.log.info('confirmKeys: confirming key', key.keyId);
      return store.storeSignedPreKey(key.keyId, key.keyPair, confirmed);
    },
    generateKeys(count, providedProgressCallback) {
      const progressCallback =
        typeof providedProgressCallback === 'function'
          ? providedProgressCallback
          : null;
      const startId = textsecure.storage.get('maxPreKeyId', 1);
      const signedKeyId = textsecure.storage.get('signedKeyId', 1);

      if (typeof startId !== 'number') {
        throw new Error('Invalid maxPreKeyId');
      }
      if (typeof signedKeyId !== 'number') {
        throw new Error('Invalid signedKeyId');
      }

      const store = textsecure.storage.protocol;
      return store.getIdentityKeyPair().then(identityKey => {
        const result = { preKeys: [], identityKey: identityKey.pubKey };
        const promises = [];

        for (let keyId = startId; keyId < startId + count; keyId += 1) {
          promises.push(
            libsignal.KeyHelper.generatePreKey(keyId).then(res => {
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
          ).then(res => {
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
        return Promise.all(promises).then(() =>
          // This is primarily for the signed prekey summary it logs out
          this.cleanSignedPreKeys().then(() => result)
        );
      });
    },
    registrationDone() {
      window.log.info('registration done');
      this.dispatchEvent(new Event('registration'));
    },
  });
  textsecure.AccountManager = AccountManager;
})();
