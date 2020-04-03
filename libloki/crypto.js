/* global
  window,
  libsignal,
  textsecure,
  StringView,
  Multibase,
  TextEncoder,
  TextDecoder,
  crypto,
  dcodeIO
*/

// eslint-disable-next-line func-names
(function() {
  window.libloki = window.libloki || {};

  class FallBackDecryptionError extends Error {}

  const IV_LENGTH = 16;

  async function DHEncrypt(symmetricKey, plainText) {
    const iv = libsignal.crypto.getRandomBytes(IV_LENGTH);
    const ciphertext = await libsignal.crypto.encrypt(
      symmetricKey,
      plainText,
      iv
    );
    const ivAndCiphertext = new Uint8Array(
      iv.byteLength + ciphertext.byteLength
    );
    ivAndCiphertext.set(new Uint8Array(iv));
    ivAndCiphertext.set(new Uint8Array(ciphertext), iv.byteLength);
    return ivAndCiphertext;
  }

  async function DHDecrypt(symmetricKey, ivAndCiphertext) {
    const iv = ivAndCiphertext.slice(0, IV_LENGTH);
    const ciphertext = ivAndCiphertext.slice(IV_LENGTH);
    return libsignal.crypto.decrypt(symmetricKey, ciphertext, iv);
  }

  class FallBackSessionCipher {
    constructor(address) {
      this.identityKeyString = address.getName();
      this.pubKey = StringView.hexToArrayBuffer(address.getName());
    }

    // Should we use ephemeral key pairs here rather than long term keys on each side?
    async encrypt(plaintext) {
      const myKeyPair = await textsecure.storage.protocol.getIdentityKeyPair();
      if (!myKeyPair) {
        throw new Error('Failed to get keypair for encryption');
      }
      const myPrivateKey = myKeyPair.privKey;
      const symmetricKey = libsignal.Curve.calculateAgreement(
        this.pubKey,
        myPrivateKey
      );
      const ivAndCiphertext = await DHEncrypt(symmetricKey, plaintext);
      return {
        type: textsecure.protobuf.Envelope.Type.FRIEND_REQUEST,
        body: ivAndCiphertext,
        registrationId: null,
      };
    }

    async decrypt(ivAndCiphertext) {
      const myKeyPair = await textsecure.storage.protocol.getIdentityKeyPair();
      if (!myKeyPair) {
        throw new Error('Failed to get keypair for decryption');
      }
      const myPrivateKey = myKeyPair.privKey;
      const symmetricKey = libsignal.Curve.calculateAgreement(
        this.pubKey,
        myPrivateKey
      );
      try {
        return await DHDecrypt(symmetricKey, ivAndCiphertext);
      } catch (e) {
        throw new FallBackDecryptionError(
          `Could not decrypt message from ${
            this.identityKeyString
          } using FallBack encryption.`
        );
      }
    }
  }

  const base32zIndex = Multibase.names.indexOf('base32z');
  const base32zCode = Multibase.codes[base32zIndex];

  function bufferToArrayBuffer(buf) {
    const ab = new ArrayBuffer(buf.length);
    const view = new Uint8Array(ab);
    for (let i = 0; i < buf.length; i += 1) {
      view[i] = buf[i];
    }
    return ab;
  }

  function decodeSnodeAddressToPubKey(snodeAddress) {
    const snodeAddressClean = snodeAddress
      .replace('.snode', '')
      .replace('https://', '')
      .replace('http://', '');
    return Multibase.decode(`${base32zCode}${snodeAddressClean}`);
  }

  class LokiSnodeChannel {
    constructor() {
      this._ephemeralKeyPair = libsignal.Curve.generateKeyPair();
      // Signal protocol prepends with "0x05"
      this._ephemeralKeyPair.pubKey = this._ephemeralKeyPair.pubKey.slice(1);
      this._ephemeralPubKeyHex = StringView.arrayBufferToHex(
        this._ephemeralKeyPair.pubKey
      );
      this._cache = {};
    }

    async _getSymmetricKey(snodeAddress) {
      if (snodeAddress in this._cache) {
        return this._cache[snodeAddress];
      }
      const ed25519PubKey = decodeSnodeAddressToPubKey(snodeAddress);
      const sodium = await window.getSodium();
      const curve25519PubKey = sodium.crypto_sign_ed25519_pk_to_curve25519(
        ed25519PubKey
      );
      const snodePubKeyArrayBuffer = bufferToArrayBuffer(curve25519PubKey);
      const symmetricKey = libsignal.Curve.calculateAgreement(
        snodePubKeyArrayBuffer,
        this._ephemeralKeyPair.privKey
      );
      this._cache[snodeAddress] = symmetricKey;
      return symmetricKey;
    }

    getChannelPublicKeyHex() {
      return this._ephemeralPubKeyHex;
    }

    async decrypt(snodeAddress, ivAndCiphertextBase64) {
      const ivAndCiphertext = dcodeIO.ByteBuffer.wrap(
        ivAndCiphertextBase64,
        'base64'
      ).toArrayBuffer();
      const symmetricKey = await this._getSymmetricKey(snodeAddress);
      try {
        const decrypted = await DHDecrypt(symmetricKey, ivAndCiphertext);
        const decoder = new TextDecoder();
        return decoder.decode(decrypted);
      } catch (e) {
        return ivAndCiphertext;
      }
    }

    async encrypt(snodeAddress, plainText) {
      if (typeof plainText === 'string') {
        const textEncoder = new TextEncoder();
        // eslint-disable-next-line no-param-reassign
        plainText = textEncoder.encode(plainText);
      }
      const symmetricKey = await this._getSymmetricKey(snodeAddress);
      const ciphertext = await DHEncrypt(symmetricKey, plainText);
      return dcodeIO.ByteBuffer.wrap(ciphertext).toString('base64');
    }
  }

  async function generateSignatureForPairing(secondaryPubKey, type) {
    const pubKeyArrayBuffer = StringView.hexToArrayBuffer(secondaryPubKey);
    // Make sure the signature includes the pairing action (pairing or unpairing)
    const len = pubKeyArrayBuffer.byteLength;
    const data = new Uint8Array(len + 1);
    data.set(new Uint8Array(pubKeyArrayBuffer), 0);
    data[len] = type;

    const myKeyPair = await textsecure.storage.protocol.getIdentityKeyPair();
    if (!myKeyPair) {
      throw new Error('Failed to get keypair for pairing signature generation');
    }
    const signature = await libsignal.Curve.async.calculateSignature(
      myKeyPair.privKey,
      data.buffer
    );
    return signature;
  }

  async function verifyAuthorisation(authorisation) {
    const {
      primaryDevicePubKey,
      secondaryDevicePubKey,
      requestSignature,
      grantSignature,
    } = authorisation;
    const isGrant = !!grantSignature;
    if (!primaryDevicePubKey || !secondaryDevicePubKey) {
      window.log.warn(
        'Received a pairing request with missing pubkeys. Ignored.'
      );
      return false;
    } else if (!requestSignature) {
      window.log.warn(
        'Received a pairing request with missing request signature. Ignored.'
      );
      return false;
    }
    const verify = async (signature, signatureType) => {
      const encoding = typeof signature === 'string' ? 'base64' : undefined;
      await this.verifyPairingSignature(
        primaryDevicePubKey,
        secondaryDevicePubKey,
        dcodeIO.ByteBuffer.wrap(signature, encoding).toArrayBuffer(),
        signatureType
      );
    };
    try {
      await verify(requestSignature, PairingType.REQUEST);
    } catch (e) {
      window.log.warn(
        'Could not verify pairing request authorisation signature. Ignoring message.'
      );
      window.log.error(e);
      return false;
    }
    // can't have grant without requestSignature?
    if (isGrant) {
      try {
        await verify(grantSignature, PairingType.GRANT);
      } catch (e) {
        window.log.warn(
          'Could not verify pairing grant authorisation signature. Ignoring message.'
        );
        window.log.error(e);
        return false;
      }
    }
    return true;
  }

  // FIXME: rename to include the fact it's relative to YOUR device
  async function validateAuthorisation(authorisation) {
    const {
      primaryDevicePubKey,
      secondaryDevicePubKey,
      grantSignature,
    } = authorisation;
    const alreadySecondaryDevice = !!window.storage.get('isSecondaryDevice');
    const ourPubKey = textsecure.storage.user.getNumber();
    const isRequest = !grantSignature;
    if (isRequest && alreadySecondaryDevice) {
      window.log.warn(
        'Received a pairing request while being a secondary device. Ignored.'
      );
      return false;
    } else if (isRequest && primaryDevicePubKey !== ourPubKey) {
      window.log.warn(
        'Received a pairing request addressed to another pubkey. Ignored.'
      );
      return false;
    } else if (isRequest && secondaryDevicePubKey === ourPubKey) {
      window.log.warn('Received a pairing request from ourselves. Ignored.');
      return false;
    }
    return this.verifyAuthorisation(authorisation);
  }

  async function verifyPairingSignature(
    primaryDevicePubKey,
    secondaryPubKey,
    signature,
    type
  ) {
    const secondaryPubKeyArrayBuffer = StringView.hexToArrayBuffer(
      secondaryPubKey
    );
    const primaryDevicePubKeyArrayBuffer = StringView.hexToArrayBuffer(
      primaryDevicePubKey
    );
    const len = secondaryPubKeyArrayBuffer.byteLength;
    const data = new Uint8Array(len + 1);
    // For REQUEST type message, the secondary device signs the primary device pubkey
    // For GRANT type message, the primary device signs the secondary device pubkey
    let issuer;
    if (type === PairingType.GRANT) {
      data.set(new Uint8Array(secondaryPubKeyArrayBuffer));
      issuer = primaryDevicePubKeyArrayBuffer;
    } else if (type === PairingType.REQUEST) {
      data.set(new Uint8Array(primaryDevicePubKeyArrayBuffer));
      issuer = secondaryPubKeyArrayBuffer;
    }
    data[len] = type;
    // Throws for invalid signature
    await libsignal.Curve.async.verifySignature(issuer, data.buffer, signature);
  }
  async function decryptToken({ cipherText64, serverPubKey64 }) {
    const ivAndCiphertext = new Uint8Array(
      dcodeIO.ByteBuffer.fromBase64(cipherText64).toArrayBuffer()
    );

    const serverPubKey = new Uint8Array(
      dcodeIO.ByteBuffer.fromBase64(serverPubKey64).toArrayBuffer()
    );
    const keyPair = await textsecure.storage.protocol.getIdentityKeyPair();
    if (!keyPair) {
      throw new Error('Failed to get keypair for token decryption');
    }
    const { privKey } = keyPair;
    const symmetricKey = libsignal.Curve.calculateAgreement(
      serverPubKey,
      privKey
    );

    const token = await DHDecrypt(symmetricKey, ivAndCiphertext);

    const tokenString = dcodeIO.ByteBuffer.wrap(token).toString('utf8');
    return tokenString;
  }
  const snodeCipher = new LokiSnodeChannel();

  const sha512 = data => crypto.subtle.digest('SHA-512', data);

  const PairingType = Object.freeze({
    REQUEST: 1,
    GRANT: 2,
  });

  /**
   * A wrapper around Signal's SessionCipher.
   * This handles specific session reset logic that we need.
   */
  class LokiSessionCipher {
    constructor(storage, protocolAddress) {
      this.storage = storage;
      this.protocolAddress = protocolAddress;
      this.sessionCipher = new libsignal.SessionCipher(
        storage,
        protocolAddress
      );
      this.TYPE = Object.freeze({
        MESSAGE: 1,
        PREKEY: 2,
      });
    }

    decryptWhisperMessage(buffer, encoding) {
      return this._decryptMessage(this.TYPE.MESSAGE, buffer, encoding);
    }

    decryptPreKeyWhisperMessage(buffer, encoding) {
      return this._decryptMessage(this.TYPE.PREKEY, buffer, encoding);
    }

    async _decryptMessage(type, buffer, encoding) {
      // Capture active session
      const activeSessionBaseKey = await this._getCurrentSessionBaseKey();

      if (type === this.TYPE.PREKEY && !activeSessionBaseKey) {
        const wrapped = dcodeIO.ByteBuffer.wrap(buffer);
        await window.libloki.storage.verifyFriendRequestAcceptPreKey(
          this.protocolAddress.getName(),
          wrapped
        );
      }

      const decryptFunction =
        type === this.TYPE.PREKEY
          ? this.sessionCipher.decryptPreKeyWhisperMessage
          : this.sessionCipher.decryptWhisperMessage;
      const result = await decryptFunction(buffer, encoding);

      // Handle session reset
      // This needs to be done synchronously so that the next time we decrypt a message,
      // we have the correct session
      try {
        await this._handleSessionResetIfNeeded(activeSessionBaseKey);
      } catch (e) {
        window.log.info('Failed to handle session reset: ', e);
      }

      return result;
    }

    async _handleSessionResetIfNeeded(previousSessionBaseKey) {
      if (!previousSessionBaseKey) {
        return;
      }

      let conversation;
      try {
        conversation = await window.ConversationController.getOrCreateAndWait(
          this.protocolAddress.getName(),
          'private'
        );
      } catch (e) {
        window.log.info(
          'Error getting conversation: ',
          this.protocolAddress.getName()
        );
        return;
      }

      if (conversation.isSessionResetOngoing()) {
        const currentSessionBaseKey = await this._getCurrentSessionBaseKey();
        if (currentSessionBaseKey !== previousSessionBaseKey) {
          if (conversation.isSessionResetReceived()) {
            // The other user used an old session to contact us; wait for them to switch to a new one.
            await this._restoreSession(previousSessionBaseKey);
          } else {
            // Our session reset was successful; we initiated one and got a new session back from the other user.
            await this._deleteAllSessionExcept(currentSessionBaseKey);
            await conversation.onNewSessionAdopted();
          }
        } else if (conversation.isSessionResetReceived()) {
          // Our session reset was successful; we received a message with the same session from the other user.
          await this._deleteAllSessionExcept(previousSessionBaseKey);
          await conversation.onNewSessionAdopted();
        }
      }
    }

    async _getCurrentSessionBaseKey() {
      const record = await this.sessionCipher.getRecord(
        this.protocolAddress.toString()
      );
      if (!record) {
        return null;
      }
      const openSession = record.getOpenSession();
      if (!openSession) {
        return null;
      }
      const { baseKey } = openSession.indexInfo;
      return baseKey;
    }

    async _restoreSession(sessionBaseKey) {
      const record = await this.sessionCipher.getRecord(
        this.protocolAddress.toString()
      );
      if (!record) {
        return;
      }
      record.archiveCurrentState();

      const sessionToRestore = record.sessions[sessionBaseKey];
      if (!sessionToRestore) {
        throw new Error(`Cannot find session with base key ${sessionBaseKey}`);
      }

      record.promoteState(sessionToRestore);
      record.updateSessionState(sessionToRestore);
      await this.storage.storeSession(
        this.protocolAddress.toString(),
        record.serialize()
      );
    }

    async _deleteAllSessionExcept(sessionBaseKey) {
      const record = await this.sessionCipher.getRecord(
        this.protocolAddress.toString()
      );
      if (!record) {
        return;
      }
      const sessionToKeep = record.sessions[sessionBaseKey];
      record.sessions = {};
      record.updateSessionState(sessionToKeep);
      await this.storage.storeSession(
        this.protocolAddress.toString(),
        record.serialize()
      );
    }
  }

  window.libloki.crypto = {
    DHEncrypt,
    DHDecrypt,
    FallBackSessionCipher,
    FallBackDecryptionError,
    snodeCipher,
    decryptToken,
    generateSignatureForPairing,
    verifyPairingSignature,
    verifyAuthorisation,
    validateAuthorisation,
    PairingType,
    LokiSessionCipher,
    // for testing
    _LokiSnodeChannel: LokiSnodeChannel,
    _decodeSnodeAddressToPubKey: decodeSnodeAddressToPubKey,
    sha512,
  };
})();
