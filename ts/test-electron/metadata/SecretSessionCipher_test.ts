// Copyright 2018-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable @typescript-eslint/no-explicit-any */

import { assert } from 'chai';

import {
  ExplodedSenderCertificateType,
  SecretSessionCipher,
  createCertificateValidator,
  _createSenderCertificateFromBuffer,
  _createServerCertificateFromBuffer,
} from '../../metadata/SecretSessionCipher';
import {
  bytesFromString,
  stringFromBytes,
  arrayBufferToBase64,
} from '../../Crypto';
import { KeyPairType } from '../../libsignal.d';

function toString(thing: string | ArrayBuffer): string {
  if (typeof thing === 'string') {
    return thing;
  }
  return arrayBufferToBase64(thing);
}

class InMemorySignalProtocolStore {
  store: Record<string, any> = {};

  Direction = {
    SENDING: 1,
    RECEIVING: 2,
  };

  getIdentityKeyPair(): Promise<{ privKey: ArrayBuffer; pubKey: ArrayBuffer }> {
    return Promise.resolve(this.get('identityKey'));
  }

  getLocalRegistrationId(): Promise<string> {
    return Promise.resolve(this.get('registrationId'));
  }

  put(key: string, value: any): void {
    if (
      key === undefined ||
      value === undefined ||
      key === null ||
      value === null
    ) {
      throw new Error('Tried to store undefined/null');
    }
    this.store[key] = value;
  }

  get(key: string, defaultValue?: any): any {
    if (key === null || key === undefined) {
      throw new Error('Tried to get value for undefined/null key');
    }
    if (key in this.store) {
      return this.store[key];
    }

    return defaultValue;
  }

  remove(key: string): void {
    if (key === null || key === undefined) {
      throw new Error('Tried to remove value for undefined/null key');
    }
    delete this.store[key];
  }

  isTrustedIdentity(
    identifier: string,
    identityKey: ArrayBuffer
  ): Promise<boolean> {
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
  }

  loadIdentityKey(identifier: string): any {
    if (identifier === null || identifier === undefined) {
      throw new Error('Tried to get identity key for undefined/null key');
    }
    return Promise.resolve(this.get(`identityKey${identifier}`));
  }

  saveIdentity(identifier: string, identityKey: ArrayBuffer): any {
    if (identifier === null || identifier === undefined) {
      throw new Error('Tried to put identity key for undefined/null key');
    }
    const address = window.libsignal.SignalProtocolAddress.fromString(
      identifier
    );

    const existing = this.get(`identityKey${address.getName()}`);
    this.put(`identityKey${address.getName()}`, identityKey);

    if (existing && toString(identityKey) !== toString(existing)) {
      return Promise.resolve(true);
    }

    return Promise.resolve(false);
  }

  /* Returns a prekeypair object or undefined */
  loadPreKey(keyId: number): any {
    let res = this.get(`25519KeypreKey${keyId}`);
    if (res !== undefined) {
      res = { pubKey: res.pubKey, privKey: res.privKey };
    }
    return Promise.resolve(res);
  }

  storePreKey(keyId: number, keyPair: any): Promise<void> {
    return Promise.resolve(this.put(`25519KeypreKey${keyId}`, keyPair));
  }

  removePreKey(keyId: number): Promise<void> {
    return Promise.resolve(this.remove(`25519KeypreKey${keyId}`));
  }

  /* Returns a signed keypair object or undefined */
  loadSignedPreKey(keyId: number): any {
    let res = this.get(`25519KeysignedKey${keyId}`);
    if (res !== undefined) {
      res = { pubKey: res.pubKey, privKey: res.privKey };
    }
    return Promise.resolve(res);
  }

  storeSignedPreKey(keyId: number, keyPair: any): Promise<void> {
    return Promise.resolve(this.put(`25519KeysignedKey${keyId}`, keyPair));
  }

  removeSignedPreKey(keyId: number): Promise<void> {
    return Promise.resolve(this.remove(`25519KeysignedKey${keyId}`));
  }

  loadSession(identifier: string): Promise<any> {
    return Promise.resolve(this.get(`session${identifier}`));
  }

  storeSession(identifier: string, record: any): Promise<void> {
    return Promise.resolve(this.put(`session${identifier}`, record));
  }

  removeSession(identifier: string): Promise<void> {
    return Promise.resolve(this.remove(`session${identifier}`));
  }

  removeAllSessions(identifier: string): Promise<void> {
    // eslint-disable-next-line no-restricted-syntax
    for (const id in this.store) {
      if (id.startsWith(`session${identifier}`)) {
        delete this.store[id];
      }
    }
    return Promise.resolve();
  }
}

describe('SecretSessionCipher', () => {
  it('successfully roundtrips', async function thisNeeded() {
    this.timeout(4000);

    const aliceStore = new InMemorySignalProtocolStore();
    const bobStore = new InMemorySignalProtocolStore();

    await _initializeSessions(aliceStore, bobStore);

    const aliceIdentityKey = await aliceStore.getIdentityKeyPair();

    const trustRoot = await window.libsignal.Curve.async.generateKeyPair();
    const senderCertificate = await _createSenderCertificateFor(
      trustRoot,
      '+14151111111',
      1,
      aliceIdentityKey.pubKey,
      31337
    );
    const aliceCipher = new SecretSessionCipher(aliceStore as any);

    const ciphertext = await aliceCipher.encrypt(
      new window.libsignal.SignalProtocolAddress('+14152222222', 1),
      { serialized: senderCertificate.serialized },
      bytesFromString('smert za smert')
    );

    const bobCipher = new SecretSessionCipher(bobStore as any);

    const decryptResult = await bobCipher.decrypt(
      createCertificateValidator(trustRoot.pubKey),
      ciphertext,
      31335
    );

    if (!decryptResult.content) {
      throw new Error('decryptResult.content is null!');
    }
    if (!decryptResult.sender) {
      throw new Error('decryptResult.sender is null!');
    }

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

    const trustRoot = await window.libsignal.Curve.async.generateKeyPair();
    const falseTrustRoot = await window.libsignal.Curve.async.generateKeyPair();
    const senderCertificate = await _createSenderCertificateFor(
      falseTrustRoot,
      '+14151111111',
      1,
      aliceIdentityKey.pubKey,
      31337
    );
    const aliceCipher = new SecretSessionCipher(aliceStore as any);

    const ciphertext = await aliceCipher.encrypt(
      new window.libsignal.SignalProtocolAddress('+14152222222', 1),
      { serialized: senderCertificate.serialized },
      bytesFromString('и вот я')
    );

    const bobCipher = new SecretSessionCipher(bobStore as any);

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

    const trustRoot = await window.libsignal.Curve.async.generateKeyPair();
    const senderCertificate = await _createSenderCertificateFor(
      trustRoot,
      '+14151111111',
      1,
      aliceIdentityKey.pubKey,
      31337
    );
    const aliceCipher = new SecretSessionCipher(aliceStore as any);

    const ciphertext = await aliceCipher.encrypt(
      new window.libsignal.SignalProtocolAddress('+14152222222', 1),
      { serialized: senderCertificate.serialized },
      bytesFromString('и вот я')
    );

    const bobCipher = new SecretSessionCipher(bobStore as any);

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

    const trustRoot = await window.libsignal.Curve.async.generateKeyPair();
    const randomKeyPair = await window.libsignal.Curve.async.generateKeyPair();
    const senderCertificate = await _createSenderCertificateFor(
      trustRoot,
      '+14151111111',
      1,
      randomKeyPair.pubKey,
      31337
    );
    const aliceCipher = new SecretSessionCipher(aliceStore as any);

    const ciphertext = await aliceCipher.encrypt(
      new window.libsignal.SignalProtocolAddress('+14152222222', 1),
      { serialized: senderCertificate.serialized },
      bytesFromString('smert za smert')
    );

    const bobCipher = new SecretSessionCipher(bobStore as any);

    try {
      await bobCipher.decrypt(
        createCertificateValidator(trustRoot.pubKey),
        ciphertext,
        31335
      );
      throw new Error('It did not fail!');
    } catch (error) {
      assert.strictEqual(
        error.message,
        "Sender's certificate key does not match key used in message"
      );
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
    trustRoot: KeyPairType,
    sender: string,
    deviceId: number,
    identityKey: ArrayBuffer,
    expires: number
  ): Promise<ExplodedSenderCertificateType> {
    const serverKey = await window.libsignal.Curve.async.generateKeyPair();

    const serverCertificateCertificateProto = new window.textsecure.protobuf.ServerCertificate.Certificate();
    serverCertificateCertificateProto.id = 1;
    serverCertificateCertificateProto.key = serverKey.pubKey;
    const serverCertificateCertificateBytes = serverCertificateCertificateProto.toArrayBuffer();

    const serverCertificateSignature = await window.libsignal.Curve.async.calculateSignature(
      trustRoot.privKey,
      serverCertificateCertificateBytes
    );

    const serverCertificateProto = new window.textsecure.protobuf.ServerCertificate();
    serverCertificateProto.certificate = serverCertificateCertificateBytes;
    serverCertificateProto.signature = serverCertificateSignature;
    const serverCertificate = _createServerCertificateFromBuffer(
      serverCertificateProto.toArrayBuffer()
    );

    const senderCertificateCertificateProto = new window.textsecure.protobuf.SenderCertificate.Certificate();
    senderCertificateCertificateProto.sender = sender;
    senderCertificateCertificateProto.senderDevice = deviceId;
    senderCertificateCertificateProto.identityKey = identityKey;
    senderCertificateCertificateProto.expires = expires;
    senderCertificateCertificateProto.signer = window.textsecure.protobuf.ServerCertificate.decode(
      serverCertificate.serialized
    );
    const senderCertificateBytes = senderCertificateCertificateProto.toArrayBuffer();

    const senderCertificateSignature = await window.libsignal.Curve.async.calculateSignature(
      serverKey.privKey,
      senderCertificateBytes
    );

    const senderCertificateProto = new window.textsecure.protobuf.SenderCertificate();
    senderCertificateProto.certificate = senderCertificateBytes;
    senderCertificateProto.signature = senderCertificateSignature;
    return _createSenderCertificateFromBuffer(
      senderCertificateProto.toArrayBuffer()
    );
  }

  // private void _initializeSessions(
  //   SignalProtocolStore aliceStore, SignalProtocolStore bobStore)
  async function _initializeSessions(
    aliceStore: InMemorySignalProtocolStore,
    bobStore: InMemorySignalProtocolStore
  ): Promise<void> {
    const aliceAddress = new window.libsignal.SignalProtocolAddress(
      '+14152222222',
      1
    );
    await aliceStore.put(
      'identityKey',
      await window.libsignal.Curve.generateKeyPair()
    );
    await bobStore.put(
      'identityKey',
      await window.libsignal.Curve.generateKeyPair()
    );

    await aliceStore.put('registrationId', 57);
    await bobStore.put('registrationId', 58);

    const bobPreKey = await window.libsignal.Curve.async.generateKeyPair();
    const bobIdentityKey = await bobStore.getIdentityKeyPair();
    const bobSignedPreKey = await window.libsignal.KeyHelper.generateSignedPreKey(
      bobIdentityKey,
      2
    );

    const bobBundle = {
      deviceId: 3,
      identityKey: bobIdentityKey.pubKey,
      registrationId: 1,
      signedPreKey: {
        keyId: 2,
        publicKey: bobSignedPreKey.keyPair.pubKey,
        signature: bobSignedPreKey.signature,
      },
      preKey: {
        keyId: 1,
        publicKey: bobPreKey.pubKey,
      },
    };
    const aliceSessionBuilder = new window.libsignal.SessionBuilder(
      aliceStore as any,
      aliceAddress
    );
    await aliceSessionBuilder.processPreKey(bobBundle);

    await bobStore.storeSignedPreKey(2, bobSignedPreKey.keyPair);
    await bobStore.storePreKey(1, bobPreKey);
  }
});
