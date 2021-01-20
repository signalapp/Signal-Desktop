/* global
  window,
  textsecure,
  libsignal,
  libloki,
  libsession,
  lokiFileServerAPI,
  mnemonic,
  btoa,
  getString,
  Event,
  dcodeIO,
  StringView,
  log,
  Event,
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
    registerSingleDevice(mnemonic, mnemonicLanguage, profileName) {
      const createAccount = this.createAccount.bind(this);
      const clearSessionsAndPreKeys = this.clearSessionsAndPreKeys.bind(this);
      const registrationDone = this.registrationDone.bind(this);
      let generateKeypair;
      if (mnemonic) {
        generateKeypair = () => {
          let seedHex = window.mnemonic.mn_decode(mnemonic, mnemonicLanguage);
          // handle shorter than 32 bytes seeds
          const privKeyHexLength = 32 * 2;
          if (seedHex.length !== privKeyHexLength) {
            seedHex = seedHex.concat('0'.repeat(32));
            seedHex = seedHex.substring(0, privKeyHexLength);
          }
          const seed = dcodeIO.ByteBuffer.wrap(seedHex, 'hex').toArrayBuffer();
          return window.sessionGenerateKeyPair(seed);
        };
      } else {
        generateKeypair = libsignal.KeyHelper.generateIdentityKeyPair;
      }
      return this.queueTask(() =>
        generateKeypair().then(async identityKeyPair =>
          createAccount(identityKeyPair)
            .then(() => this.saveRecoveryPhrase(mnemonic))
            .then(clearSessionsAndPreKeys)
            .then(() => {
              const pubKeyString = StringView.arrayBufferToHex(
                identityKeyPair.pubKey
              );
              registrationDone(pubKeyString, profileName);
            })
        )
      );
    },
    queueTask(task) {
      const taskWithTimeout = textsecure.createTaskWithTimeout(task);
      this.pending = this.pending.then(taskWithTimeout, taskWithTimeout);

      return this.pending;
    },
    async createAccount(identityKeyPair, userAgent, readReceipts) {
      const signalingKey = libsignal.crypto.getRandomBytes(32 + 20);
      let password = btoa(getString(libsignal.crypto.getRandomBytes(16)));
      password = password.substring(0, password.length - 2);

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
          nonblockingApproval: true,
        }
      );

      await textsecure.storage.put('identityKey', identityKeyPair);
      await textsecure.storage.put('password', password);
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

      window.log.info('clearing all sessions');
      await Promise.all([store.clearSessionStore()]);
      // During secondary device registration we need to keep our prekeys sent
      // to other pubkeys
      await Promise.all([
        store.clearPreKeyStore(),
        store.clearSignedPreKeysStore(),
      ]);
      
    },
    async generateMnemonic(language = 'english') {
      // Note: 4 bytes are converted into 3 seed words, so length 12 seed words
      // (13 - 1 checksum) are generated using 12 * 4 / 3 = 16 bytes.
      const seedSize = 16;
      const seed = window.Signal.Crypto.getRandomBytes(seedSize);
      const hex = StringView.arrayBufferToHex(seed);
      return mnemonic.mn_encode(hex, language);
    },
    getCurrentRecoveryPhrase() {
      return textsecure.storage.get('mnemonic');
    },
    saveRecoveryPhrase(mnemonic) {
      return textsecure.storage.put('mnemonic', mnemonic);
    },
    async registrationDone(number, displayName) {
      window.log.info('registration done');

      textsecure.storage.put('primaryDevicePubKey', number);
      
      // Ensure that we always have a conversation for ourself
      const conversation = await window
        .getConversationController()
        .getOrCreateAndWait(number, 'private');
      await conversation.setLokiProfile({ displayName });

      this.dispatchEvent(new Event('registration'));
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
