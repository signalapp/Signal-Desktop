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
      await textsecure.storage.put('signaling_key', signalingKey);
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
      if (textsecure.storage.get('secondaryDeviceStatus') !== 'ongoing') {
        await Promise.all([
          store.clearPreKeyStore(),
          store.clearSignedPreKeysStore(),
        ]);
      }
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

      if (!textsecure.storage.get('secondaryDeviceStatus')) {
        // We have registered as a primary device
        textsecure.storage.put('primaryDevicePubKey', number);
      }
      // Ensure that we always have a conversation for ourself
      const conversation = await window
        .getConversationController()
        .getOrCreateAndWait(number, 'private');
      await conversation.setLokiProfile({ displayName });

      this.dispatchEvent(new Event('registration'));
    },
    async requestPairing(primaryDevicePubKey) {
      // throws if invalid
      this.validatePubKeyHex(primaryDevicePubKey);
      // we need a conversation for sending a message
      await window
        .getConversationController()
        .getOrCreateAndWait(primaryDevicePubKey, 'private');
      const ourPubKey = textsecure.storage.user.getNumber();
      if (primaryDevicePubKey === ourPubKey) {
        throw new Error('Cannot request to pair with ourselves');
      }
      const requestSignature = await libloki.crypto.generateSignatureForPairing(
        primaryDevicePubKey,
        libloki.crypto.PairingType.REQUEST
      );

      const primaryDevice = new libsession.Types.PubKey(primaryDevicePubKey);

      const requestPairingMessage = new window.libsession.Messages.Outgoing.DeviceLinkRequestMessage(
        {
          timestamp: Date.now(),
          primaryDevicePubKey,
          secondaryDevicePubKey: ourPubKey,
          requestSignature: new Uint8Array(requestSignature),
        }
      );
      await window.libsession
        .getMessageQueue()
        .send(primaryDevice, requestPairingMessage);
    },
    async authoriseSecondaryDevice(secondaryDeviceStr) {
      const ourPubKey = textsecure.storage.user.getNumber();
      if (secondaryDeviceStr === ourPubKey) {
        throw new Error(
          'Cannot register primary device pubkey as secondary device'
        );
      }
      const secondaryDevicePubKey = libsession.Types.PubKey.from(
        secondaryDeviceStr
      );

      if (!secondaryDevicePubKey) {
        window.log.error(
          'Invalid secondary pubkey on authoriseSecondaryDevice'
        );

        return;
      }
      const grantSignature = await libloki.crypto.generateSignatureForPairing(
        secondaryDeviceStr,
        libloki.crypto.PairingType.GRANT
      );
      const authorisations = await libsession.Protocols.MultiDeviceProtocol.getPairingAuthorisations(
        secondaryDeviceStr
      );
      const existingAuthorisation = authorisations.find(
        pairing => pairing.secondaryDevicePubKey === secondaryDeviceStr
      );
      if (!existingAuthorisation) {
        throw new Error(
          'authoriseSecondaryDevice: request signature missing from database!'
        );
      }
      const { requestSignature } = existingAuthorisation;
      const authorisation = {
        primaryDevicePubKey: ourPubKey,
        secondaryDevicePubKey: secondaryDeviceStr,
        requestSignature,
        grantSignature,
      };

      // Update authorisation in database with the new grant signature
      await libsession.Protocols.MultiDeviceProtocol.savePairingAuthorisation(
        authorisation
      );
      const ourConversation = await window
        .getConversationController()
        .getOrCreateAndWait(ourPubKey, 'private');

      // We need to send the our profile to the secondary device
      const lokiProfile = ourConversation.getOurProfile();

      // Try to upload to the file server and then send a message
      try {
        await lokiFileServerAPI.updateOurDeviceMapping();
        const requestPairingMessage = new libsession.Messages.Outgoing.DeviceLinkGrantMessage(
          {
            timestamp: Date.now(),
            primaryDevicePubKey: ourPubKey,
            secondaryDevicePubKey: secondaryDeviceStr,
            requestSignature: new Uint8Array(requestSignature),
            grantSignature: new Uint8Array(grantSignature),
            lokiProfile,
          }
        );
        await libsession
          .getMessageQueue()
          .send(secondaryDevicePubKey, requestPairingMessage);
      } catch (e) {
        log.error(
          'Failed to authorise secondary device: ',
          e && e.stack ? e.stack : e
        );
        // File server upload failed or message sending failed, we should rollback changes
        await libsession.Protocols.MultiDeviceProtocol.removePairingAuthorisations(
          secondaryDeviceStr
        );
        await lokiFileServerAPI.updateOurDeviceMapping();
        throw e;
      }

      // Send sync messages
      // bad hack to send sync messages when secondary device is ready to process them
      setTimeout(async () => {
        const conversations = window
          .getConversationController()
          .getConversations();
        await libsession.Utils.SyncMessageUtils.sendGroupSyncMessage(
          conversations
        );
        await libsession.Utils.SyncMessageUtils.sendOpenGroupsSyncMessage(
          conversations
        );
        await libsession.Utils.SyncMessageUtils.sendContactSyncMessage();
      }, 5000);
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
