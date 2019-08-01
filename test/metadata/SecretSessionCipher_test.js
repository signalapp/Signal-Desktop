/* global libsignal, textsecure */

'use strict';

const {
  SecretSessionCipher,
  createCertificateValidator,
  _createSenderCertificateFromBuffer,
  _createServerCertificateFromBuffer,
} = window.Signal.Metadata;
const {
  bytesFromString,
  stringFromBytes,
  arrayBufferToBase64,
} = window.Signal.Crypto;

function InMemorySignalProtocolStore() {
  this.store = {};
}

function toString(thing) {
  if (typeof thing === 'string') {
    return thing;
  }
  return arrayBufferToBase64(thing);
}

InMemorySignalProtocolStore.prototype = {
  Direction: {
    SENDING: 1,
    RECEIVING: 2,
  },

  getIdentityKeyPair() {
    return Promise.resolve(this.get('identityKey'));
  },
  getLocalRegistrationId() {
    return Promise.resolve(this.get('registrationId'));
  },
  put(key, value) {
    if (
      key === undefined ||
      value === undefined ||
      key === null ||
      value === null
    ) {
      throw new Error('Tried to store undefined/null');
    }
    this.store[key] = value;
  },
  get(key, defaultValue) {
    if (key === null || key === undefined) {
      throw new Error('Tried to get value for undefined/null key');
    }
    if (key in this.store) {
      return this.store[key];
    }

    return defaultValue;
  },
  remove(key) {
    if (key === null || key === undefined) {
      throw new Error('Tried to remove value for undefined/null key');
    }
    delete this.store[key];
  },

  isTrustedIdentity(identifier, identityKey) {
    if (identifier === null || identifier === undefined) {
      throw new Error('tried to check identity key for undefined/null key');
    }
    if (!(identityKey instanceof ArrayBuffer)) {
      throw new Error('Expected identityKey to be an ArrayBuffer');
    }
    const trusted = this.get(`identityKey${identifier}`);
    if (trusted === undefined) {
      return Promise.resolve(true);
    }
    return Promise.resolve(toString(identityKey) === toString(trusted));
  },
  loadIdentityKey(identifier) {
    if (identifier === null || identifier === undefined) {
      throw new Error('Tried to get identity key for undefined/null key');
    }
    return Promise.resolve(this.get(`identityKey${identifier}`));
  },
  saveIdentity(identifier, identityKey) {
    if (identifier === null || identifier === undefined) {
      throw new Error('Tried to put identity key for undefined/null key');
    }
    const address = libsignal.SignalProtocolAddress.fromString(identifier);

    const existing = this.get(`identityKey${address.getName()}`);
    this.put(`identityKey${address.getName()}`, identityKey);

    if (existing && toString(identityKey) !== toString(existing)) {
      return Promise.resolve(true);
    }

    return Promise.resolve(false);
  },

  /* Returns a prekeypair object or undefined */
  loadPreKey(keyId) {
    let res = this.get(`25519KeypreKey${keyId}`);
    if (res !== undefined) {
      res = { pubKey: res.pubKey, privKey: res.privKey };
    }
    return Promise.resolve(res);
  },
  storePreKey(keyId, keyPair) {
    return Promise.resolve(this.put(`25519KeypreKey${keyId}`, keyPair));
  },
  removePreKey(keyId) {
    return Promise.resolve(this.remove(`25519KeypreKey${keyId}`));
  },

  /* Returns a signed keypair object or undefined */
  loadSignedPreKey(keyId) {
    let res = this.get(`25519KeysignedKey${keyId}`);
    if (res !== undefined) {
      res = { pubKey: res.pubKey, privKey: res.privKey };
    }
    return Promise.resolve(res);
  },
  storeSignedPreKey(keyId, keyPair) {
    return Promise.resolve(this.put(`25519KeysignedKey${keyId}`, keyPair));
  },
  removeSignedPreKey(keyId) {
    return Promise.resolve(this.remove(`25519KeysignedKey${keyId}`));
  },

  loadSession(identifier) {
    return Promise.resolve(this.get(`session${identifier}`));
  },
  storeSession(identifier, record) {
    return Promise.resolve(this.put(`session${identifier}`, record));
  },
  removeSession(identifier) {
    return Promise.resolve(this.remove(`session${identifier}`));
  },
  removeAllSessions(identifier) {
    // eslint-disable-next-line no-restricted-syntax
    for (const id in this.store) {
      if (id.startsWith(`session${identifier}`)) {
        delete this.store[id];
      }
    }
    return Promise.resolve();
  },
};

describe('SecretSessionCipher', () => {
  it('successfully roundtrips', async function thisNeeded() {
    this.timeout(4000);

    const aliceStore = new InMemorySignalProtocolStore();
    const bobStore = new InMemorySignalProtocolStore();

    await _initializeSessions(aliceStore, bobStore);

    const aliceIdentityKey = await aliceStore.getIdentityKeyPair();

    const trustRoot = await libsignal.Curve.async.generateKeyPair();
    const senderCertificate = await _createSenderCertificateFor(
      trustRoot,
      '+14151111111',
      1,
      aliceIdentityKey.pubKey,
      31337
    );
    const aliceCipher = new SecretSessionCipher(aliceStore);

    const ciphertext = await aliceCipher.encrypt(
      new libsignal.SignalProtocolAddress('+14152222222', 1),
      senderCertificate,
      bytesFromString('smert za smert')
    );

    const bobCipher = new SecretSessionCipher(bobStore);

    const decryptResult = await bobCipher.decrypt(
      createCertificateValidator(trustRoot.pubKey),
      ciphertext,
      31335
    );

    assert.strictEqual(
      stringFromBytes(decryptResult.content),
      'smert za smert'
    );
    assert.strictEqual(decryptResult.sender.toString(), '+14151111111.1');
  });

  it('fails when untrusted', async function thisNeeded() {
    this.timeout(4000);

    const aliceStore = new InMemorySignalProtocolStore();
    const bobStore = new InMemorySignalProtocolStore();

    await _initializeSessions(aliceStore, bobStore);

    const aliceIdentityKey = await aliceStore.getIdentityKeyPair();

    const trustRoot = await libsignal.Curve.async.generateKeyPair();
    const falseTrustRoot = await libsignal.Curve.async.generateKeyPair();
    const senderCertificate = await _createSenderCertificateFor(
      falseTrustRoot,
      '+14151111111',
      1,
      aliceIdentityKey.pubKey,
      31337
    );
    const aliceCipher = new SecretSessionCipher(aliceStore);

    const ciphertext = await aliceCipher.encrypt(
      new libsignal.SignalProtocolAddress('+14152222222', 1),
      senderCertificate,
      bytesFromString('и вот я')
    );

    const bobCipher = new SecretSessionCipher(bobStore);

    try {
      await bobCipher.decrypt(
        createCertificateValidator(trustRoot.pubKey),
        ciphertext,
        31335
      );
      throw new Error('It did not fail!');
    } catch (error) {
      assert.strictEqual(error.message, 'Invalid signature');
    }
  });

  it('fails when expired', async function thisNeeded() {
    this.timeout(4000);

    const aliceStore = new InMemorySignalProtocolStore();
    const bobStore = new InMemorySignalProtocolStore();

    await _initializeSessions(aliceStore, bobStore);

    const aliceIdentityKey = await aliceStore.getIdentityKeyPair();

    const trustRoot = await libsignal.Curve.async.generateKeyPair();
    const senderCertificate = await _createSenderCertificateFor(
      trustRoot,
      '+14151111111',
      1,
      aliceIdentityKey.pubKey,
      31337
    );
    const aliceCipher = new SecretSessionCipher(aliceStore);

    const ciphertext = await aliceCipher.encrypt(
      new libsignal.SignalProtocolAddress('+14152222222', 1),
      senderCertificate,
      bytesFromString('и вот я')
    );

    const bobCipher = new SecretSessionCipher(bobStore);

    try {
      await bobCipher.decrypt(
        createCertificateValidator(trustRoot.pubKey),
        ciphertext,
        31338
      );
      throw new Error('It did not fail!');
    } catch (error) {
      assert.strictEqual(error.message, 'Certificate is expired');
    }
  });

  it('fails when wrong identity', async function thisNeeded() {
    this.timeout(4000);

    const aliceStore = new InMemorySignalProtocolStore();
    const bobStore = new InMemorySignalProtocolStore();

    await _initializeSessions(aliceStore, bobStore);

    const trustRoot = await libsignal.Curve.async.generateKeyPair();
    const randomKeyPair = await libsignal.Curve.async.generateKeyPair();
    const senderCertificate = await _createSenderCertificateFor(
      trustRoot,
      '+14151111111',
      1,
      randomKeyPair.pubKey,
      31337
    );
    const aliceCipher = new SecretSessionCipher(aliceStore);

    const ciphertext = await aliceCipher.encrypt(
      new libsignal.SignalProtocolAddress('+14152222222', 1),
      senderCertificate,
      bytesFromString('smert za smert')
    );

    const bobCipher = new SecretSessionCipher(bobStore);

    try {
      await bobCipher.decrypt(
        createCertificateValidator(trustRoot.puKey),
        ciphertext,
        31335
      );
      throw new Error('It did not fail!');
    } catch (error) {
      assert.strictEqual(error.message, 'Invalid public key');
    }
  });

  // private SenderCertificate _createCertificateFor(
  //   ECKeyPair trustRoot
  //   String sender
  //   int deviceId
  //   ECPublicKey identityKey
  //   long expires
  // )
  async function _createSenderCertificateFor(
    trustRoot,
    sender,
    deviceId,
    identityKey,
    expires
  ) {
    const serverKey = await libsignal.Curve.async.generateKeyPair();

    const serverCertificateCertificateProto = new textsecure.protobuf.ServerCertificate.Certificate();
    serverCertificateCertificateProto.id = 1;
    serverCertificateCertificateProto.key = serverKey.pubKey;
    const serverCertificateCertificateBytes = serverCertificateCertificateProto
      .encode()
      .toArrayBuffer();

    const serverCertificateSignature = await libsignal.Curve.async.calculateSignature(
      trustRoot.privKey,
      serverCertificateCertificateBytes
    );

    const serverCertificateProto = new textsecure.protobuf.ServerCertificate();
    serverCertificateProto.certificate = serverCertificateCertificateBytes;
    serverCertificateProto.signature = serverCertificateSignature;
    const serverCertificate = _createServerCertificateFromBuffer(
      serverCertificateProto.encode().toArrayBuffer()
    );

    const senderCertificateCertificateProto = new textsecure.protobuf.SenderCertificate.Certificate();
    senderCertificateCertificateProto.sender = sender;
    senderCertificateCertificateProto.senderDevice = deviceId;
    senderCertificateCertificateProto.identityKey = identityKey;
    senderCertificateCertificateProto.expires = expires;
    senderCertificateCertificateProto.signer = textsecure.protobuf.ServerCertificate.decode(
      serverCertificate.serialized
    );
    const senderCertificateBytes = senderCertificateCertificateProto
      .encode()
      .toArrayBuffer();

    const senderCertificateSignature = await libsignal.Curve.async.calculateSignature(
      serverKey.privKey,
      senderCertificateBytes
    );

    const senderCertificateProto = new textsecure.protobuf.SenderCertificate();
    senderCertificateProto.certificate = senderCertificateBytes;
    senderCertificateProto.signature = senderCertificateSignature;
    return _createSenderCertificateFromBuffer(
      senderCertificateProto.encode().toArrayBuffer()
    );
  }

  // private void _initializeSessions(
  //   SignalProtocolStore aliceStore, SignalProtocolStore bobStore)
  async function _initializeSessions(aliceStore, bobStore) {
    const aliceAddress = new libsignal.SignalProtocolAddress('+14152222222', 1);
    await aliceStore.put(
      'identityKey',
      await libsignal.Curve.generateKeyPair()
    );
    await bobStore.put('identityKey', await libsignal.Curve.generateKeyPair());

    await aliceStore.put('registrationId', 57);
    await bobStore.put('registrationId', 58);

    const bobPreKey = await libsignal.Curve.async.generateKeyPair();
    const bobIdentityKey = await bobStore.getIdentityKeyPair();
    const bobSignedPreKey = await libsignal.KeyHelper.generateSignedPreKey(
      bobIdentityKey,
      2
    );

    const bobBundle = {
      identityKey: bobIdentityKey.pubKey,
      registrationId: 1,
      preKey: {
        keyId: 1,
        publicKey: bobPreKey.pubKey,
      },
      signedPreKey: {
        keyId: 2,
        publicKey: bobSignedPreKey.keyPair.pubKey,
        signature: bobSignedPreKey.signature,
      },
    };
    const aliceSessionBuilder = new libsignal.SessionBuilder(
      aliceStore,
      aliceAddress
    );
    await aliceSessionBuilder.processPreKey(bobBundle);

    await bobStore.storeSignedPreKey(2, bobSignedPreKey.keyPair);
    await bobStore.storePreKey(1, bobPreKey);
  }
});
