/* global
  window,
  textsecure,
  libsignal,
  libloki,
  lokiFileServerAPI,
  mnemonic,
  btoa,
  Signal,
  getString,
  Event,
  dcodeIO,
  StringView,
  log,
  Event,
  ConversationController,
  Whisper
*/

/* eslint-disable more/no-then */
/* eslint-disable no-unused-vars */
/* eslint-disable no-await-in-loop */

// eslint-disable-next-line func-names
(function() {
  window.textsecure = window.textsecure || {};

  const ARCHIVE_AGE = 7 * 24 * 60 * 60 * 1000;

  function AccountManager(username, password) {
    // this.server = window.WebAPI.connect({ username, password });
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
      // return this.server.requestVerificationVoice(number);
    },
    requestSMSVerification(number) {
      // return this.server.requestVerificationSMS(number);
    },
    async encryptDeviceName(name, providedIdentityKey) {
      if (!name) {
        return null;
      }
      const identityKey =
        providedIdentityKey ||
        (await textsecure.storage.protocol.getIdentityKeyPair());
      if (!identityKey) {
        throw new Error(
          'Identity key was not provided and is not in database!'
        );
      }
      const encrypted = await Signal.Crypto.encryptDeviceName(
        name,
        identityKey.pubKey
      );

      const proto = new textsecure.protobuf.DeviceName();
      proto.ephemeralPublic = encrypted.ephemeralPublic;
      proto.syntheticIv = encrypted.syntheticIv;
      proto.ciphertext = encrypted.ciphertext;

      const arrayBuffer = proto.encode().toArrayBuffer();
      return Signal.Crypto.arrayBufferToBase64(arrayBuffer);
    },
    async decryptDeviceName(base64) {
      const identityKey = await textsecure.storage.protocol.getIdentityKeyPair();

      const arrayBuffer = Signal.Crypto.base64ToArrayBuffer(base64);
      const proto = textsecure.protobuf.DeviceName.decode(arrayBuffer);
      const encrypted = {
        ephemeralPublic: proto.ephemeralPublic.toArrayBuffer(),
        syntheticIv: proto.syntheticIv.toArrayBuffer(),
        ciphertext: proto.ciphertext.toArrayBuffer(),
      };

      const name = await Signal.Crypto.decryptDeviceName(
        encrypted,
        identityKey.privKey
      );

      return name;
    },
    async maybeUpdateDeviceName() {
      const isNameEncrypted = textsecure.storage.user.getDeviceNameEncrypted();
      if (isNameEncrypted) {
        return;
      }
      const deviceName = await textsecure.storage.user.getDeviceName();
      const base64 = await this.encryptDeviceName(deviceName);

      await this.server.updateDeviceName(base64);
    },
    async deviceNameIsEncrypted() {
      await textsecure.storage.user.setDeviceNameEncrypted();
    },
    async maybeDeleteSignalingKey() {
      const key = await textsecure.storage.user.getSignalingKey();
      if (key) {
        await this.server.removeSignalingKey();
      }
    },
    registerSingleDevice(mnemonic, mnemonicLanguage, profileName) {
      const createAccount = this.createAccount.bind(this);
      const clearSessionsAndPreKeys = this.clearSessionsAndPreKeys.bind(this);
      const generateKeys = this.generateKeys.bind(this, 0);
      const confirmKeys = this.confirmKeys.bind(this);
      const registrationDone = this.registrationDone.bind(this);
      let generateKeypair;
      if (mnemonic) {
        generateKeypair = () => {
          let seedHex = window.mnemonic.mn_decode(mnemonic, mnemonicLanguage);
          // handle shorter than 32 bytes seeds
          const privKeyHexLength = 32 * 2;
          if (seedHex.length !== privKeyHexLength) {
            seedHex = seedHex.concat(seedHex);
            seedHex = seedHex.substring(0, privKeyHexLength);
          }
          const privKeyHex = window.mnemonic.sc_reduce32(seedHex);
          const privKey = dcodeIO.ByteBuffer.wrap(
            privKeyHex,
            'hex'
          ).toArrayBuffer();
          return libsignal.Curve.async.createKeyPair(privKey);
        };
      } else {
        generateKeypair = libsignal.KeyHelper.generateIdentityKeyPair;
      }
      return this.queueTask(() =>
        generateKeypair().then(async identityKeyPair =>
          createAccount(identityKeyPair)
            .then(() => this.saveMnemonic(mnemonic))
            .then(clearSessionsAndPreKeys)
            .then(generateKeys)
            .then(confirmKeys)
            .then(() => {
              const pubKeyString = StringView.arrayBufferToHex(
                identityKeyPair.pubKey
              );
              registrationDone(pubKeyString, profileName);
            })
        )
      );
    },
    async addMockContact(doSave) {
      if (doSave === undefined) {
        // eslint-disable-next-line no-param-reassign
        doSave = true;
      }
      const keyPair = await libsignal.KeyHelper.generateIdentityKeyPair();
      const pubKey = StringView.arrayBufferToHex(keyPair.pubKey);
      const privKey = StringView.arrayBufferToHex(keyPair.privKey);
      log.info(`contact pubkey ${pubKey}`);
      log.info(`contact privkey ${privKey}`);
      const signedKeyId = Math.floor(Math.random() * 1000 + 1);

      const signedPreKey = await libsignal.KeyHelper.generateSignedPreKey(
        keyPair,
        signedKeyId
      );
      const contactSignedPreKey = {
        publicKey: signedPreKey.keyPair.pubKey,
        signature: signedPreKey.signature,
        keyId: signedPreKey.keyId,
      };
      if (doSave) {
        await textsecure.storage.protocol.storeContactSignedPreKey(
          pubKey,
          contactSignedPreKey
        );
      } else {
        log.info(
          `signed prekey:
          ${StringView.arrayBufferToHex(contactSignedPreKey.publicKey)}`
        );
        log.info(
          `signature:
          ${StringView.arrayBufferToHex(contactSignedPreKey.signature)}`
        );
      }

      for (let keyId = 0; keyId < 10; keyId += 1) {
        const preKey = await libsignal.KeyHelper.generatePreKey(keyId);
        if (doSave) {
          await textsecure.storage.protocol.storeContactPreKey(pubKey, {
            publicKey: preKey.keyPair.pubKey,
            keyId,
          });
        } else {
          log.info(
            `signed prekey:
            ${StringView.arrayBufferToHex(preKey.keyPair.pubKey)}`
          );
        }
      }
      log.info('Added mock contact');
    },
    registerSecondDevice(setProvisioningUrl, confirmNumber, progressCallback) {
      throw new Error(
        'account_manager: registerSecondDevice has not been implemented!'
      );
    },
    refreshPreKeys() {
      // const generateKeys = this.generateKeys.bind(this, 0);
      // const registerKeys = this.server.registerKeys.bind(this.server);
      // return this.queueTask(() =>
      //   this.server.getMyKeys().then(preKeyCount => {
      //     window.log.info(`prekey count ${preKeyCount}`);
      //     if (preKeyCount < 10) {
      //       return generateKeys().then(registerKeys);
      //     }
      //     return null;
      //   })
      // );
    },
    rotateSignedPreKey() {
      return this.queueTask(() => {
        const signedKeyId = textsecure.storage.get('signedKeyId', 1);
        if (typeof signedKeyId !== 'number') {
          throw new Error('Invalid signedKeyId');
        }

        const store = textsecure.storage.protocol;
        const { cleanSignedPreKeys } = this;

        return store
          .getIdentityKeyPair()
          .then(
            identityKey =>
              libsignal.KeyHelper.generateSignedPreKey(
                identityKey,
                signedKeyId
              ),
            () => {
              // We swallow any error here, because we don't want to get into
              //   a loop of repeated retries.
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
              store.storeSignedPreKey(
                res.keyId,
                res.keyPair,
                undefined,
                res.signature
              ),
            ])
              .then(() => {
                const confirmed = true;
                window.log.info('Confirming new signed prekey', res.keyId);
                return Promise.all([
                  textsecure.storage.remove('signedKeyRotationRejected'),
                  store.storeSignedPreKey(
                    res.keyId,
                    res.keyPair,
                    confirmed,
                    res.signature
                  ),
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
    async createAccount(identityKeyPair, userAgent, readReceipts) {
      const signalingKey = libsignal.crypto.getRandomBytes(32 + 20);
      let password = btoa(getString(libsignal.crypto.getRandomBytes(16)));
      password = password.substring(0, password.length - 2);
      const registrationId = libsignal.KeyHelper.generateRegistrationId();

      await Promise.all([
        textsecure.storage.remove('identityKey'),
        textsecure.storage.remove('signaling_key'),
        textsecure.storage.remove('password'),
        textsecure.storage.remove('registrationId'),
        textsecure.storage.remove('number_id'),
        textsecure.storage.remove('device_name'),
        textsecure.storage.remove('userAgent'),
        textsecure.storage.remove('read-receipt-setting'),
        textsecure.storage.remove('typing-indicators-setting'),
        textsecure.storage.remove('regionCode'),
      ]);

      // update our own identity key, which may have changed
      // if we're relinking after a reinstall on the master device
      const pubKeyString = StringView.arrayBufferToHex(identityKeyPair.pubKey);
      await textsecure.storage.protocol.saveIdentityWithAttributes(
        pubKeyString,
        {
          id: pubKeyString,
          publicKey: identityKeyPair.pubKey,
          firstUse: true,
          timestamp: Date.now(),
          verified: textsecure.storage.protocol.VerifiedStatus.VERIFIED,
          nonblockingApproval: true,
        }
      );

      await textsecure.storage.put('identityKey', identityKeyPair);
      await textsecure.storage.put('signaling_key', signalingKey);
      await textsecure.storage.put('password', password);
      await textsecure.storage.put('registrationId', registrationId);
      if (userAgent) {
        await textsecure.storage.put('userAgent', userAgent);
      }

      await textsecure.storage.put(
        'read-receipt-setting',
        Boolean(readReceipts)
      );

      // Enable typing indicators by default
      await textsecure.storage.put('typing-indicators-setting', Boolean(true));

      await textsecure.storage.user.setNumberAndDeviceId(pubKeyString, 1);
      await textsecure.storage.put('regionCode', null);
    },
    async clearSessionsAndPreKeys() {
      const store = textsecure.storage.protocol;

      window.log.info('clearing all sessions, prekeys, and signed prekeys');
      await Promise.all([
        store.clearContactPreKeysStore(),
        store.clearContactSignedPreKeysStore(),
        store.clearSessionStore(),
      ]);
      // During secondary device registration we need to keep our prekeys sent
      // to other pubkeys
      if (textsecure.storage.get('secondaryDeviceStatus') !== 'ongoing') {
        await Promise.all([
          store.clearPreKeyStore(),
          store.clearSignedPreKeysStore(),
        ]);
      }
    },
    // Takes the same object returned by generateKeys
    async confirmKeys(keys) {
      const store = textsecure.storage.protocol;
      const key = keys.signedPreKey;
      const confirmed = true;

      window.log.info('confirmKeys: confirming key', key.keyId);
      await store.storeSignedPreKey(
        key.keyId,
        key.keyPair,
        confirmed,
        key.signature
      );
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
            store.storeSignedPreKey(
              res.keyId,
              res.keyPair,
              undefined,
              res.signature
            );
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
    async generateMnemonic(language = 'english') {
      // Note: 4 bytes are converted into 3 seed words, so length 12 seed words
      // (13 - 1 checksum) are generated using 12 * 4 / 3 = 16 bytes.
      const seedSize = 16;
      const seed = window.Signal.Crypto.getRandomBytes(seedSize);
      const hex = StringView.arrayBufferToHex(seed);
      return mnemonic.mn_encode(hex, language);
    },
    getCurrentMnemonic() {
      return textsecure.storage.get('mnemonic');
    },
    saveMnemonic(mnemonic) {
      return textsecure.storage.put('mnemonic', mnemonic);
    },
    async registrationDone(number, displayName) {
      window.log.info('registration done');

      if (!textsecure.storage.get('secondaryDeviceStatus')) {
        // We have registered as a primary device
        textsecure.storage.put('primaryDevicePubKey', number);
      }
      // Ensure that we always have a conversation for ourself
      const conversation = await ConversationController.getOrCreateAndWait(
        number,
        'private'
      );
      await conversation.setLokiProfile({ displayName });

      this.dispatchEvent(new Event('registration'));
    },
    async requestPairing(primaryDevicePubKey) {
      // throws if invalid
      this.validatePubKeyHex(primaryDevicePubKey);
      // we need a conversation for sending a message
      await ConversationController.getOrCreateAndWait(
        primaryDevicePubKey,
        'private'
      );
      const ourPubKey = textsecure.storage.user.getNumber();
      if (primaryDevicePubKey === ourPubKey) {
        throw new Error('Cannot request to pair with ourselves');
      }
      const requestSignature = await libloki.crypto.generateSignatureForPairing(
        primaryDevicePubKey,
        libloki.crypto.PairingType.REQUEST
      );
      const authorisation = {
        primaryDevicePubKey,
        secondaryDevicePubKey: ourPubKey,
        requestSignature,
      };
      await libloki.api.sendPairingAuthorisation(
        authorisation,
        primaryDevicePubKey
      );
    },
    async authoriseSecondaryDevice(secondaryDevicePubKey) {
      const ourPubKey = textsecure.storage.user.getNumber();
      if (secondaryDevicePubKey === ourPubKey) {
        throw new Error(
          'Cannot register primary device pubkey as secondary device'
        );
      }

      // throws if invalid
      this.validatePubKeyHex(secondaryDevicePubKey);
      // we need a conversation for sending a message
      const secondaryConversation = await ConversationController.getOrCreateAndWait(
        secondaryDevicePubKey,
        'private'
      );
      const grantSignature = await libloki.crypto.generateSignatureForPairing(
        secondaryDevicePubKey,
        libloki.crypto.PairingType.GRANT
      );
      const existingAuthorisation = await libloki.storage.getAuthorisationForSecondaryPubKey(
        secondaryDevicePubKey
      );
      if (!existingAuthorisation) {
        throw new Error(
          'authoriseSecondaryDevice: request signature missing from database!'
        );
      }
      const { requestSignature } = existingAuthorisation;
      const authorisation = {
        primaryDevicePubKey: ourPubKey,
        secondaryDevicePubKey,
        requestSignature,
        grantSignature,
      };
      // Update authorisation in database with the new grant signature
      await libloki.storage.savePairingAuthorisation(authorisation);
      await lokiFileServerAPI.updateOurDeviceMapping();
      await libloki.api.sendPairingAuthorisation(
        authorisation,
        secondaryDevicePubKey
      );
      // Always be friends with secondary devices
      await secondaryConversation.setFriendRequestStatus(
        window.friends.friendRequestStatusEnum.friends,
        {
          blockSync: true,
        }
      );
      // Send sync messages
      const conversations = window.getConversations().models;
      textsecure.messaging.sendContactSyncMessage(conversations);
      textsecure.messaging.sendGroupSyncMessage(conversations);
      textsecure.messaging.sendOpenGroupsSyncMessage(conversations);
    },
    validatePubKeyHex(pubKey) {
      const c = new Whisper.Conversation({
        id: pubKey,
        type: 'private',
      });
      const validationError = c.validateNumber();
      if (validationError) {
        throw new Error(validationError);
      }
    },
  });
  textsecure.AccountManager = AccountManager;
})();
