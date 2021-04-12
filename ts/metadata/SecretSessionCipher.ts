// Copyright 2018-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable class-methods-use-this */

import * as CiphertextMessage from './CiphertextMessage';
import {
  bytesFromString,
  concatenateBytes,
  constantTimeEqual,
  decryptAesCtr,
  encryptAesCtr,
  fromEncodedBinaryToArrayBuffer,
  getViewOfArrayBuffer,
  getZeroes,
  highBitsToInt,
  hmacSha256,
  intsToByteHighAndLow,
  splitBytes,
  trimBytes,
} from '../Crypto';

import { SignalProtocolAddressClass } from '../libsignal.d';

const REVOKED_CERTIFICATES: Array<number> = [];
const CIPHERTEXT_VERSION = 1;
const UNIDENTIFIED_DELIVERY_PREFIX = 'UnidentifiedDelivery';

type MeType = {
  number?: string;
  uuid?: string;
  deviceId: number;
};

type ValidatorType = {
  validate(
    certificate: SenderCertificateType,
    validationTime: number
  ): Promise<void>;
};

export const enum SenderCertificateMode {
  WithE164,
  WithoutE164,
}

export type SerializedCertificateType = {
  serialized: ArrayBuffer;
};

type ServerCertificateType = {
  id: number;
  key: ArrayBuffer;
};

type ServerCertificateWrapperType = {
  certificate: ArrayBuffer;
  signature: ArrayBuffer;
};

type SenderCertificateType = {
  sender?: string;
  senderUuid?: string;
  senderDevice: number;
  expires: number;
  identityKey: ArrayBuffer;
  signer: ServerCertificateType;
};

type SenderCertificateWrapperType = {
  certificate: ArrayBuffer;
  signature: ArrayBuffer;
};

type MessageType = {
  ephemeralPublic: ArrayBuffer;
  encryptedStatic: ArrayBuffer;
  encryptedMessage: ArrayBuffer;
};

type InnerMessageType = {
  type: number;
  senderCertificate: SenderCertificateWrapperType;
  content: ArrayBuffer;
};

export type ExplodedServerCertificateType = ServerCertificateType &
  ServerCertificateWrapperType &
  SerializedCertificateType;

export type ExplodedSenderCertificateType = SenderCertificateType &
  SenderCertificateWrapperType &
  SerializedCertificateType & {
    signer: ExplodedServerCertificateType;
  };

type ExplodedMessageType = MessageType &
  SerializedCertificateType & { version: number };

type ExplodedInnerMessageType = InnerMessageType &
  SerializedCertificateType & {
    senderCertificate: ExplodedSenderCertificateType;
  };

// public CertificateValidator(ECPublicKey trustRoot)
export function createCertificateValidator(
  trustRoot: ArrayBuffer
): ValidatorType {
  return {
    // public void validate(SenderCertificate certificate, long validationTime)
    async validate(
      certificate: ExplodedSenderCertificateType,
      validationTime: number
    ): Promise<void> {
      const serverCertificate = certificate.signer;

      await window.libsignal.Curve.async.verifySignature(
        trustRoot,
        serverCertificate.certificate,
        serverCertificate.signature
      );

      const serverCertId = serverCertificate.id;
      if (REVOKED_CERTIFICATES.includes(serverCertId)) {
        throw new Error(
          `Server certificate id ${serverCertId} has been revoked`
        );
      }

      await window.libsignal.Curve.async.verifySignature(
        serverCertificate.key,
        certificate.certificate,
        certificate.signature
      );

      if (validationTime > certificate.expires) {
        throw new Error('Certificate is expired');
      }
    },
  };
}

function _decodePoint(serialized: ArrayBuffer, offset = 0): ArrayBuffer {
  const view =
    offset > 0
      ? getViewOfArrayBuffer(serialized, offset, serialized.byteLength)
      : serialized;

  return window.libsignal.Curve.validatePubKeyFormat(view);
}

// public ServerCertificate(byte[] serialized)
export function _createServerCertificateFromBuffer(
  serialized: ArrayBuffer
): ExplodedServerCertificateType {
  const wrapper = window.textsecure.protobuf.ServerCertificate.decode(
    serialized
  );

  if (!wrapper.certificate || !wrapper.signature) {
    throw new Error('Missing fields');
  }

  const certificate = window.textsecure.protobuf.ServerCertificate.Certificate.decode(
    wrapper.certificate.toArrayBuffer()
  );

  if (!certificate.id || !certificate.key) {
    throw new Error('Missing fields');
  }

  return {
    id: certificate.id,
    key: certificate.key.toArrayBuffer(),
    serialized,
    certificate: wrapper.certificate.toArrayBuffer(),

    signature: wrapper.signature.toArrayBuffer(),
  };
}

// public SenderCertificate(byte[] serialized)
export function _createSenderCertificateFromBuffer(
  serialized: ArrayBuffer
): ExplodedSenderCertificateType {
  const wrapper = window.textsecure.protobuf.SenderCertificate.decode(
    serialized
  );

  const { signature, certificate } = wrapper;

  if (!signature || !certificate) {
    throw new Error('Missing fields');
  }

  const senderCertificate = window.textsecure.protobuf.SenderCertificate.Certificate.decode(
    wrapper.certificate.toArrayBuffer()
  );

  const {
    signer,
    identityKey,
    senderDevice,
    expires,
    sender,
    senderUuid,
  } = senderCertificate;

  if (
    !signer ||
    !identityKey ||
    !senderDevice ||
    !expires ||
    !(sender || senderUuid)
  ) {
    throw new Error('Missing fields');
  }

  return {
    sender,
    senderUuid,
    senderDevice,
    expires: expires.toNumber(),
    identityKey: identityKey.toArrayBuffer(),
    signer: _createServerCertificateFromBuffer(signer.toArrayBuffer()),

    certificate: certificate.toArrayBuffer(),
    signature: signature.toArrayBuffer(),

    serialized,
  };
}

// public UnidentifiedSenderMessage(byte[] serialized)
function _createUnidentifiedSenderMessageFromBuffer(
  serialized: ArrayBuffer
): ExplodedMessageType {
  const uintArray = new Uint8Array(serialized);
  const version = highBitsToInt(uintArray[0]);

  if (version > CIPHERTEXT_VERSION) {
    throw new Error(`Unknown version: ${version}`);
  }

  const view = getViewOfArrayBuffer(serialized, 1, serialized.byteLength);
  const unidentifiedSenderMessage = window.textsecure.protobuf.UnidentifiedSenderMessage.decode(
    view
  );

  if (
    !unidentifiedSenderMessage.ephemeralPublic ||
    !unidentifiedSenderMessage.encryptedStatic ||
    !unidentifiedSenderMessage.encryptedMessage
  ) {
    throw new Error('Missing fields');
  }

  return {
    version,

    ephemeralPublic: unidentifiedSenderMessage.ephemeralPublic.toArrayBuffer(),
    encryptedStatic: unidentifiedSenderMessage.encryptedStatic.toArrayBuffer(),
    encryptedMessage: unidentifiedSenderMessage.encryptedMessage.toArrayBuffer(),

    serialized,
  };
}

// public UnidentifiedSenderMessage(
//   ECPublicKey ephemeral, byte[] encryptedStatic, byte[] encryptedMessage) {
function _createUnidentifiedSenderMessage(
  ephemeralPublic: ArrayBuffer,
  encryptedStatic: ArrayBuffer,
  encryptedMessage: ArrayBuffer
): ExplodedMessageType {
  const versionBytes = new Uint8Array([
    intsToByteHighAndLow(CIPHERTEXT_VERSION, CIPHERTEXT_VERSION),
  ]);
  const unidentifiedSenderMessage = new window.textsecure.protobuf.UnidentifiedSenderMessage();

  unidentifiedSenderMessage.encryptedMessage = encryptedMessage;
  unidentifiedSenderMessage.encryptedStatic = encryptedStatic;
  unidentifiedSenderMessage.ephemeralPublic = ephemeralPublic;

  const messageBytes = unidentifiedSenderMessage.toArrayBuffer();

  return {
    version: CIPHERTEXT_VERSION,

    ephemeralPublic,
    encryptedStatic,
    encryptedMessage,

    serialized: concatenateBytes(versionBytes, messageBytes),
  };
}

// public UnidentifiedSenderMessageContent(byte[] serialized)
function _createUnidentifiedSenderMessageContentFromBuffer(
  serialized: ArrayBuffer
): ExplodedInnerMessageType {
  const TypeEnum =
    window.textsecure.protobuf.UnidentifiedSenderMessage.Message.Type;

  const message = window.textsecure.protobuf.UnidentifiedSenderMessage.Message.decode(
    serialized
  );

  if (!message.type || !message.senderCertificate || !message.content) {
    throw new Error('Missing fields');
  }

  let type;
  switch (message.type) {
    case TypeEnum.MESSAGE:
      type = CiphertextMessage.WHISPER_TYPE;
      break;
    case TypeEnum.PREKEY_MESSAGE:
      type = CiphertextMessage.PREKEY_TYPE;
      break;
    default:
      throw new Error(`Unknown type: ${message.type}`);
  }

  return {
    type,
    senderCertificate: _createSenderCertificateFromBuffer(
      message.senderCertificate.toArrayBuffer()
    ),
    content: message.content.toArrayBuffer(),

    serialized,
  };
}

// private int getProtoType(int type)
function _getProtoMessageType(type: number): number {
  const TypeEnum =
    window.textsecure.protobuf.UnidentifiedSenderMessage.Message.Type;

  switch (type) {
    case CiphertextMessage.WHISPER_TYPE:
      return TypeEnum.MESSAGE;
    case CiphertextMessage.PREKEY_TYPE:
      return TypeEnum.PREKEY_MESSAGE;
    default:
      throw new Error(`_getProtoMessageType: type '${type}' does not exist`);
  }
}

// public UnidentifiedSenderMessageContent(
//   int type, SenderCertificate senderCertificate, byte[] content)
function _createUnidentifiedSenderMessageContent(
  type: number,
  senderCertificate: SerializedCertificateType,
  content: ArrayBuffer
): ArrayBuffer {
  const innerMessage = new window.textsecure.protobuf.UnidentifiedSenderMessage.Message();
  innerMessage.type = _getProtoMessageType(type);
  innerMessage.senderCertificate = window.textsecure.protobuf.SenderCertificate.decode(
    senderCertificate.serialized
  );
  innerMessage.content = content;

  return innerMessage.toArrayBuffer();
}

export class SecretSessionCipher {
  storage: typeof window.textsecure.storage.protocol;

  options: { messageKeysLimit?: number | boolean };

  SessionCipher: typeof window.libsignal.SessionCipher;

  constructor(
    storage: typeof window.textsecure.storage.protocol,
    options?: { messageKeysLimit?: number | boolean }
  ) {
    this.storage = storage;

    // Do this on construction because libsignal won't be available when this file loads
    const { SessionCipher } = window.libsignal;
    this.SessionCipher = SessionCipher;

    this.options = options || {};
  }

  // public byte[] encrypt(
  //   SignalProtocolAddress destinationAddress,
  //   SenderCertificate senderCertificate,
  //   byte[] paddedPlaintext
  // )
  async encrypt(
    destinationAddress: SignalProtocolAddressClass,
    senderCertificate: SerializedCertificateType,
    paddedPlaintext: ArrayBuffer
  ): Promise<ArrayBuffer> {
    // Capture this.xxx variables to replicate Java's implicit this syntax
    const { SessionCipher } = this;
    const signalProtocolStore = this.storage;

    const sessionCipher = new SessionCipher(
      signalProtocolStore,
      destinationAddress,
      this.options
    );

    const message = await sessionCipher.encrypt(paddedPlaintext);
    const ourIdentity = await signalProtocolStore.getIdentityKeyPair();
    const theirIdentityData = await signalProtocolStore.loadIdentityKey(
      destinationAddress.getName()
    );
    if (!theirIdentityData) {
      throw new Error(
        'SecretSessionCipher.encrypt: No identity data for recipient!'
      );
    }
    const theirIdentity =
      typeof theirIdentityData === 'string'
        ? fromEncodedBinaryToArrayBuffer(theirIdentityData)
        : theirIdentityData;

    const ephemeral = await window.libsignal.Curve.async.generateKeyPair();
    const ephemeralSalt = concatenateBytes(
      bytesFromString(UNIDENTIFIED_DELIVERY_PREFIX),
      theirIdentity,
      ephemeral.pubKey
    );
    const ephemeralKeys = await this._calculateEphemeralKeys(
      theirIdentity,
      ephemeral.privKey,
      ephemeralSalt
    );
    const staticKeyCiphertext = await this._encryptWithSecretKeys(
      ephemeralKeys.cipherKey,
      ephemeralKeys.macKey,
      ourIdentity.pubKey
    );

    const staticSalt = concatenateBytes(
      ephemeralKeys.chainKey,
      staticKeyCiphertext
    );
    const staticKeys = await this._calculateStaticKeys(
      theirIdentity,
      ourIdentity.privKey,
      staticSalt
    );
    const serializedMessage = _createUnidentifiedSenderMessageContent(
      message.type,
      senderCertificate,
      fromEncodedBinaryToArrayBuffer(message.body)
    );
    const messageBytes = await this._encryptWithSecretKeys(
      staticKeys.cipherKey,
      staticKeys.macKey,
      serializedMessage
    );

    const unidentifiedSenderMessage = _createUnidentifiedSenderMessage(
      ephemeral.pubKey,
      staticKeyCiphertext,
      messageBytes
    );

    return unidentifiedSenderMessage.serialized;
  }

  // public Pair<SignalProtocolAddress, byte[]> decrypt(
  //   CertificateValidator validator, byte[] ciphertext, long timestamp)
  async decrypt(
    validator: ValidatorType,
    ciphertext: ArrayBuffer,
    timestamp: number,
    me?: MeType
  ): Promise<{
    isMe?: boolean;
    sender?: SignalProtocolAddressClass;
    senderUuid?: SignalProtocolAddressClass;
    content?: ArrayBuffer;
  }> {
    const signalProtocolStore = this.storage;
    const ourIdentity = await signalProtocolStore.getIdentityKeyPair();
    const wrapper = _createUnidentifiedSenderMessageFromBuffer(ciphertext);
    const ephemeralSalt = concatenateBytes(
      bytesFromString(UNIDENTIFIED_DELIVERY_PREFIX),
      ourIdentity.pubKey,
      wrapper.ephemeralPublic
    );
    const ephemeralKeys = await this._calculateEphemeralKeys(
      wrapper.ephemeralPublic,
      ourIdentity.privKey,
      ephemeralSalt
    );
    const staticKeyBytes = await this._decryptWithSecretKeys(
      ephemeralKeys.cipherKey,
      ephemeralKeys.macKey,
      wrapper.encryptedStatic
    );

    const staticKey = _decodePoint(staticKeyBytes, 0);
    const staticSalt = concatenateBytes(
      ephemeralKeys.chainKey,
      wrapper.encryptedStatic
    );
    const staticKeys = await this._calculateStaticKeys(
      staticKey,
      ourIdentity.privKey,
      staticSalt
    );
    const messageBytes = await this._decryptWithSecretKeys(
      staticKeys.cipherKey,
      staticKeys.macKey,
      wrapper.encryptedMessage
    );

    const content = _createUnidentifiedSenderMessageContentFromBuffer(
      messageBytes
    );

    await validator.validate(content.senderCertificate, timestamp);
    if (
      !constantTimeEqual(content.senderCertificate.identityKey, staticKeyBytes)
    ) {
      throw new Error(
        "Sender's certificate key does not match key used in message"
      );
    }

    const { sender, senderUuid, senderDevice } = content.senderCertificate;
    if (
      me &&
      ((sender && me.number && sender === me.number) ||
        (senderUuid && me.uuid && senderUuid === me.uuid)) &&
      senderDevice === me.deviceId
    ) {
      return {
        isMe: true,
      };
    }
    const addressE164 = sender
      ? new window.libsignal.SignalProtocolAddress(sender, senderDevice)
      : undefined;
    const addressUuid = senderUuid
      ? new window.libsignal.SignalProtocolAddress(
          senderUuid.toLowerCase(),
          senderDevice
        )
      : undefined;

    try {
      return {
        sender: addressE164,
        senderUuid: addressUuid,
        content: await this._decryptWithUnidentifiedSenderMessage(content),
      };
    } catch (error) {
      if (!error) {
        // eslint-disable-next-line no-ex-assign
        error = new Error('Decryption error was falsey!');
      }

      error.sender = addressE164;
      error.senderUuid = addressUuid;

      throw error;
    }
  }

  // public int getSessionVersion(SignalProtocolAddress remoteAddress) {
  getSessionVersion(
    remoteAddress: SignalProtocolAddressClass
  ): Promise<number> {
    const { SessionCipher } = this;
    const signalProtocolStore = this.storage;

    const cipher = new SessionCipher(
      signalProtocolStore,
      remoteAddress,
      this.options
    );

    return cipher.getSessionVersion();
  }

  // public int getRemoteRegistrationId(SignalProtocolAddress remoteAddress) {
  getRemoteRegistrationId(
    remoteAddress: SignalProtocolAddressClass
  ): Promise<number> {
    const { SessionCipher } = this;
    const signalProtocolStore = this.storage;

    const cipher = new SessionCipher(
      signalProtocolStore,
      remoteAddress,
      this.options
    );

    return cipher.getRemoteRegistrationId();
  }

  // Used by outgoing_message.js
  closeOpenSessionForDevice(
    remoteAddress: SignalProtocolAddressClass
  ): Promise<void> {
    const { SessionCipher } = this;
    const signalProtocolStore = this.storage;

    const cipher = new SessionCipher(
      signalProtocolStore,
      remoteAddress,
      this.options
    );

    return cipher.closeOpenSessionForDevice();
  }

  // private EphemeralKeys calculateEphemeralKeys(
  //   ECPublicKey ephemeralPublic, ECPrivateKey ephemeralPrivate, byte[] salt)
  private async _calculateEphemeralKeys(
    ephemeralPublic: ArrayBuffer,
    ephemeralPrivate: ArrayBuffer,
    salt: ArrayBuffer
  ): Promise<{
    chainKey: ArrayBuffer;
    cipherKey: ArrayBuffer;
    macKey: ArrayBuffer;
  }> {
    const ephemeralSecret = await window.libsignal.Curve.async.calculateAgreement(
      ephemeralPublic,
      ephemeralPrivate
    );
    const ephemeralDerivedParts = await window.libsignal.HKDF.deriveSecrets(
      ephemeralSecret,
      salt,
      new ArrayBuffer(0)
    );

    // private EphemeralKeys(byte[] chainKey, byte[] cipherKey, byte[] macKey)
    return {
      chainKey: ephemeralDerivedParts[0],
      cipherKey: ephemeralDerivedParts[1],
      macKey: ephemeralDerivedParts[2],
    };
  }

  // private StaticKeys calculateStaticKeys(
  //   ECPublicKey staticPublic, ECPrivateKey staticPrivate, byte[] salt)
  private async _calculateStaticKeys(
    staticPublic: ArrayBuffer,
    staticPrivate: ArrayBuffer,
    salt: ArrayBuffer
  ): Promise<{ cipherKey: ArrayBuffer; macKey: ArrayBuffer }> {
    const staticSecret = await window.libsignal.Curve.async.calculateAgreement(
      staticPublic,
      staticPrivate
    );
    const staticDerivedParts = await window.libsignal.HKDF.deriveSecrets(
      staticSecret,
      salt,
      new ArrayBuffer(0)
    );

    // private StaticKeys(byte[] cipherKey, byte[] macKey)
    return {
      cipherKey: staticDerivedParts[1],
      macKey: staticDerivedParts[2],
    };
  }

  // private byte[] decrypt(UnidentifiedSenderMessageContent message)
  private _decryptWithUnidentifiedSenderMessage(
    message: ExplodedInnerMessageType
  ): Promise<ArrayBuffer> {
    const { SessionCipher } = this;
    const signalProtocolStore = this.storage;

    if (!message.senderCertificate) {
      throw new Error(
        '_decryptWithUnidentifiedSenderMessage: Message had no senderCertificate'
      );
    }

    const { senderUuid, sender, senderDevice } = message.senderCertificate;
    const target = senderUuid || sender;
    if (!senderDevice || !target) {
      throw new Error(
        '_decryptWithUnidentifiedSenderMessage: Missing sender information in senderCertificate'
      );
    }

    const address = new window.libsignal.SignalProtocolAddress(
      target,
      senderDevice
    );

    switch (message.type) {
      case CiphertextMessage.WHISPER_TYPE:
        return new SessionCipher(
          signalProtocolStore,
          address,
          this.options
        ).decryptWhisperMessage(message.content);
      case CiphertextMessage.PREKEY_TYPE:
        return new SessionCipher(
          signalProtocolStore,
          address,
          this.options
        ).decryptPreKeyWhisperMessage(message.content);
      default:
        throw new Error(`Unknown type: ${message.type}`);
    }
  }

  // private byte[] encrypt(
  //   SecretKeySpec cipherKey, SecretKeySpec macKey, byte[] plaintext)
  private async _encryptWithSecretKeys(
    cipherKey: ArrayBuffer,
    macKey: ArrayBuffer,
    plaintext: ArrayBuffer
  ): Promise<ArrayBuffer> {
    // Cipher const cipher = Cipher.getInstance('AES/CTR/NoPadding');
    // cipher.init(Cipher.ENCRYPT_MODE, cipherKey, new IvParameterSpec(new byte[16]));

    // Mac const mac = Mac.getInstance('HmacSHA256');
    // mac.init(macKey);

    // byte[] const ciphertext = cipher.doFinal(plaintext);
    const ciphertext = await encryptAesCtr(cipherKey, plaintext, getZeroes(16));

    // byte[] const ourFullMac = mac.doFinal(ciphertext);
    const ourFullMac = await hmacSha256(macKey, ciphertext);
    const ourMac = trimBytes(ourFullMac, 10);

    return concatenateBytes(ciphertext, ourMac);
  }

  // private byte[] decrypt(
  //   SecretKeySpec cipherKey, SecretKeySpec macKey, byte[] ciphertext)
  private async _decryptWithSecretKeys(
    cipherKey: ArrayBuffer,
    macKey: ArrayBuffer,
    ciphertext: ArrayBuffer
  ): Promise<ArrayBuffer> {
    if (ciphertext.byteLength < 10) {
      throw new Error('Ciphertext not long enough for MAC!');
    }

    const ciphertextParts = splitBytes(
      ciphertext,
      ciphertext.byteLength - 10,
      10
    );

    // Mac const mac = Mac.getInstance('HmacSHA256');
    // mac.init(macKey);

    // byte[] const digest   = mac.doFinal(ciphertextParts[0]);
    const digest = await hmacSha256(macKey, ciphertextParts[0]);
    const ourMac = trimBytes(digest, 10);
    const theirMac = ciphertextParts[1];

    if (!constantTimeEqual(ourMac, theirMac)) {
      throw new Error('SecretSessionCipher/_decryptWithSecretKeys: Bad MAC!');
    }

    // Cipher const cipher = Cipher.getInstance('AES/CTR/NoPadding');
    // cipher.init(Cipher.DECRYPT_MODE, cipherKey, new IvParameterSpec(new byte[16]));

    // return cipher.doFinal(ciphertextParts[0]);
    return decryptAesCtr(cipherKey, ciphertextParts[0], getZeroes(16));
  }
}
