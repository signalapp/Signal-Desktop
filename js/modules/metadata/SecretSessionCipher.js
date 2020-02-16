/* global libsignal, textsecure, dcodeIO, libloki */

/* eslint-disable no-bitwise */

const CiphertextMessage = require('./CiphertextMessage');
const {
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
} = require('../crypto');

const REVOKED_CERTIFICATES = [];

function SecretSessionCipher(storage) {
  this.storage = storage;

  // We do this on construction because libsignal won't be available when this file loads
  const { SessionCipher } = libsignal;
  this.SessionCipher = SessionCipher;
}

const CIPHERTEXT_VERSION = 1;
const UNIDENTIFIED_DELIVERY_PREFIX = 'UnidentifiedDelivery';

// public CertificateValidator(ECPublicKey trustRoot)
function createCertificateValidator(trustRoot) {
  return {
    // public void validate(SenderCertificate certificate, long validationTime)
    async validate(certificate, validationTime) {
      const serverCertificate = certificate.signer;

      await libsignal.Curve.async.verifySignature(
        trustRoot,
        serverCertificate.certificate,
        serverCertificate.signature
      );

      const serverCertId = serverCertificate.certificate.id;
      if (REVOKED_CERTIFICATES.includes(serverCertId)) {
        throw new Error(
          `Server certificate id ${serverCertId} has been revoked`
        );
      }

      await libsignal.Curve.async.verifySignature(
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

function _decodePoint(serialized, offset = 0) {
  const view =
    offset > 0
      ? getViewOfArrayBuffer(serialized, offset, serialized.byteLength)
      : serialized;

  return libsignal.Curve.validatePubKeyFormat(view);
}

// public ServerCertificate(byte[] serialized)
function _createServerCertificateFromBuffer(serialized) {
  const wrapper = textsecure.protobuf.ServerCertificate.decode(serialized);

  if (!wrapper.certificate || !wrapper.signature) {
    throw new Error('Missing fields');
  }

  const certificate = textsecure.protobuf.ServerCertificate.Certificate.decode(
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
function _createSenderCertificateFromBuffer(serialized) {
  const cert = textsecure.protobuf.SenderCertificate.decode(serialized);

  if (!cert.senderDevice || !cert.sender) {
    throw new Error('Missing fields');
  }

  return {
    sender: cert.sender,
    senderDevice: cert.senderDevice,

    certificate: cert.toArrayBuffer(),

    serialized,
  };
}

// public UnidentifiedSenderMessage(byte[] serialized)
function _createUnidentifiedSenderMessageFromBuffer(serialized) {
  const version = highBitsToInt(serialized[0]);

  if (version > CIPHERTEXT_VERSION) {
    throw new Error(`Unknown version: ${this.version}`);
  }

  const view = getViewOfArrayBuffer(serialized, 1, serialized.byteLength);
  const unidentifiedSenderMessage = textsecure.protobuf.UnidentifiedSenderMessage.decode(
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
  ephemeralPublic,
  encryptedStatic,
  encryptedMessage
) {
  const versionBytes = new Uint8Array([
    intsToByteHighAndLow(CIPHERTEXT_VERSION, CIPHERTEXT_VERSION),
  ]);
  const unidentifiedSenderMessage = new textsecure.protobuf.UnidentifiedSenderMessage();

  unidentifiedSenderMessage.encryptedMessage = encryptedMessage;
  unidentifiedSenderMessage.encryptedStatic = encryptedStatic;
  unidentifiedSenderMessage.ephemeralPublic = ephemeralPublic;

  const messageBytes = unidentifiedSenderMessage.encode().toArrayBuffer();

  return {
    version: CIPHERTEXT_VERSION,

    ephemeralPublic,
    encryptedStatic,
    encryptedMessage,

    serialized: concatenateBytes(versionBytes, messageBytes),
  };
}

// public UnidentifiedSenderMessageContent(byte[] serialized)
function _createUnidentifiedSenderMessageContentFromBuffer(serialized) {
  const TypeEnum = textsecure.protobuf.UnidentifiedSenderMessage.Message.Type;

  const message = textsecure.protobuf.UnidentifiedSenderMessage.Message.decode(
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
    case TypeEnum.LOKI_FRIEND_REQUEST:
      type = CiphertextMessage.LOKI_FRIEND_REQUEST;
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
function _getProtoMessageType(type) {
  const TypeEnum = textsecure.protobuf.UnidentifiedSenderMessage.Message.Type;

  switch (type) {
    case CiphertextMessage.WHISPER_TYPE:
      return TypeEnum.MESSAGE;
    case CiphertextMessage.PREKEY_TYPE:
      return TypeEnum.PREKEY_MESSAGE;
    case CiphertextMessage.LOKI_FRIEND_REQUEST:
      return TypeEnum.LOKI_FRIEND_REQUEST;
    default:
      throw new Error(`_getProtoMessageType: type '${type}' does not exist`);
  }
}

// public UnidentifiedSenderMessageContent(
//   int type, SenderCertificate senderCertificate, byte[] content)
function _createUnidentifiedSenderMessageContent(
  type,
  senderCertificate,
  content
) {
  const innerMessage = new textsecure.protobuf.UnidentifiedSenderMessage.Message();
  innerMessage.type = _getProtoMessageType(type);
  innerMessage.senderCertificate = senderCertificate;
  innerMessage.content = content;

  return {
    type,
    senderCertificate,
    content,

    serialized: innerMessage.encode().toArrayBuffer(),
  };
}

SecretSessionCipher.prototype = {
  // public byte[] encrypt(
  //   SignalProtocolAddress destinationAddress,
  //   SenderCertificate senderCertificate,
  //   byte[] paddedPlaintext
  // )
  async encrypt(
    destinationAddress,
    senderCertificate,
    paddedPlaintext,
    cipher
  ) {
    // Capture this.xxx variables to replicate Java's implicit this syntax
    const signalProtocolStore = this.storage;
    const _calculateEphemeralKeys = this._calculateEphemeralKeys.bind(this);
    const _encryptWithSecretKeys = this._encryptWithSecretKeys.bind(this);
    const _calculateStaticKeys = this._calculateStaticKeys.bind(this);

    const message = await cipher.encrypt(paddedPlaintext);
    const ourIdentity = await signalProtocolStore.getIdentityKeyPair();
    const theirIdentity = dcodeIO.ByteBuffer.wrap(
      destinationAddress.getName(),
      'hex'
    ).toArrayBuffer();

    const ephemeral = await libsignal.Curve.async.generateKeyPair();
    const ephemeralSalt = concatenateBytes(
      bytesFromString(UNIDENTIFIED_DELIVERY_PREFIX),
      theirIdentity,
      ephemeral.pubKey
    );
    const ephemeralKeys = await _calculateEphemeralKeys(
      theirIdentity,
      ephemeral.privKey,
      ephemeralSalt
    );
    const staticKeyCiphertext = await _encryptWithSecretKeys(
      ephemeralKeys.cipherKey,
      ephemeralKeys.macKey,
      ourIdentity.pubKey
    );

    const staticSalt = concatenateBytes(
      ephemeralKeys.chainKey,
      staticKeyCiphertext
    );
    const staticKeys = await _calculateStaticKeys(
      theirIdentity,
      ourIdentity.privKey,
      staticSalt
    );
    const content = _createUnidentifiedSenderMessageContent(
      message.type,
      senderCertificate,
      fromEncodedBinaryToArrayBuffer(message.body)
    );
    const messageBytes = await _encryptWithSecretKeys(
      staticKeys.cipherKey,
      staticKeys.macKey,
      content.serialized
    );

    const unidentifiedSenderMessage = _createUnidentifiedSenderMessage(
      ephemeral.pubKey,
      staticKeyCiphertext,
      messageBytes
    );

    return unidentifiedSenderMessage.serialized;
  },

  // public Pair<SignalProtocolAddress, byte[]> decrypt(
  //   CertificateValidator validator, byte[] ciphertext, long timestamp)
  async decrypt(ciphertext, me) {
    // Capture this.xxx variables to replicate Java's implicit this syntax
    const signalProtocolStore = this.storage;
    const _calculateEphemeralKeys = this._calculateEphemeralKeys.bind(this);
    const _calculateStaticKeys = this._calculateStaticKeys.bind(this);
    const _decryptWithUnidentifiedSenderMessage = this._decryptWithUnidentifiedSenderMessage.bind(
      this
    );
    const _decryptWithSecretKeys = this._decryptWithSecretKeys.bind(this);

    const ourIdentity = await signalProtocolStore.getIdentityKeyPair();
    const wrapper = _createUnidentifiedSenderMessageFromBuffer(ciphertext);
    const ephemeralSalt = concatenateBytes(
      bytesFromString(UNIDENTIFIED_DELIVERY_PREFIX),
      ourIdentity.pubKey,
      wrapper.ephemeralPublic
    );
    const ephemeralKeys = await _calculateEphemeralKeys(
      wrapper.ephemeralPublic,
      ourIdentity.privKey,
      ephemeralSalt
    );
    const staticKeyBytes = await _decryptWithSecretKeys(
      ephemeralKeys.cipherKey,
      ephemeralKeys.macKey,
      wrapper.encryptedStatic
    );

    const staticKey = _decodePoint(staticKeyBytes, 0);
    const staticSalt = concatenateBytes(
      ephemeralKeys.chainKey,
      wrapper.encryptedStatic
    );
    const staticKeys = await _calculateStaticKeys(
      staticKey,
      ourIdentity.privKey,
      staticSalt
    );
    const messageBytes = await _decryptWithSecretKeys(
      staticKeys.cipherKey,
      staticKeys.macKey,
      wrapper.encryptedMessage
    );

    const content = _createUnidentifiedSenderMessageContentFromBuffer(
      messageBytes
    );

    const { sender, senderDevice } = content.senderCertificate;
    const { number, deviceId } = me || {};
    if (sender === number && senderDevice === deviceId) {
      return {
        isMe: true,
      };
    }
    const address = new libsignal.SignalProtocolAddress(sender, senderDevice);

    try {
      return {
        sender: address,
        content: await _decryptWithUnidentifiedSenderMessage(content),
        type: content.type,
      };
    } catch (error) {
      if (!error) {
        // eslint-disable-next-line no-ex-assign
        error = new Error('Decryption error was falsey!');
      }

      error.sender = address;

      throw error;
    }
  },

  // public int getSessionVersion(SignalProtocolAddress remoteAddress) {
  getSessionVersion(remoteAddress) {
    const { SessionCipher } = this;
    const signalProtocolStore = this.storage;

    const cipher = new SessionCipher(signalProtocolStore, remoteAddress);

    return cipher.getSessionVersion();
  },

  // public int getRemoteRegistrationId(SignalProtocolAddress remoteAddress) {
  getRemoteRegistrationId(remoteAddress) {
    const { SessionCipher } = this;
    const signalProtocolStore = this.storage;

    const cipher = new SessionCipher(signalProtocolStore, remoteAddress);

    return cipher.getRemoteRegistrationId();
  },

  // Used by outgoing_message.js
  closeOpenSessionForDevice(remoteAddress) {
    const { SessionCipher } = this;
    const signalProtocolStore = this.storage;

    const cipher = new SessionCipher(signalProtocolStore, remoteAddress);

    return cipher.closeOpenSessionForDevice();
  },

  // private EphemeralKeys calculateEphemeralKeys(
  //   ECPublicKey ephemeralPublic, ECPrivateKey ephemeralPrivate, byte[] salt)
  async _calculateEphemeralKeys(ephemeralPublic, ephemeralPrivate, salt) {
    const ephemeralSecret = await libsignal.Curve.async.calculateAgreement(
      ephemeralPublic,
      ephemeralPrivate
    );
    const ephemeralDerivedParts = await libsignal.HKDF.deriveSecrets(
      ephemeralSecret,
      salt,
      new ArrayBuffer()
    );

    // private EphemeralKeys(byte[] chainKey, byte[] cipherKey, byte[] macKey)
    return {
      chainKey: ephemeralDerivedParts[0],
      cipherKey: ephemeralDerivedParts[1],
      macKey: ephemeralDerivedParts[2],
    };
  },

  // private StaticKeys calculateStaticKeys(
  //   ECPublicKey staticPublic, ECPrivateKey staticPrivate, byte[] salt)
  async _calculateStaticKeys(staticPublic, staticPrivate, salt) {
    const staticSecret = await libsignal.Curve.async.calculateAgreement(
      staticPublic,
      staticPrivate
    );
    const staticDerivedParts = await libsignal.HKDF.deriveSecrets(
      staticSecret,
      salt,
      new ArrayBuffer()
    );

    // private StaticKeys(byte[] cipherKey, byte[] macKey)
    return {
      cipherKey: staticDerivedParts[1],
      macKey: staticDerivedParts[2],
    };
  },

  // private byte[] decrypt(UnidentifiedSenderMessageContent message)
  _decryptWithUnidentifiedSenderMessage(message) {
    const signalProtocolStore = this.storage;

    const sender = new libsignal.SignalProtocolAddress(
      message.senderCertificate.sender,
      message.senderCertificate.senderDevice
    );

    switch (message.type) {
      case CiphertextMessage.WHISPER_TYPE:
        return new libloki.crypto.LokiSessionCipher(
          signalProtocolStore,
          sender
        ).decryptWhisperMessage(message.content);
      case CiphertextMessage.PREKEY_TYPE:
        return new libloki.crypto.LokiSessionCipher(
          signalProtocolStore,
          sender
        ).decryptPreKeyWhisperMessage(message.content);
      case CiphertextMessage.LOKI_FRIEND_REQUEST:
        return new libloki.crypto.FallBackSessionCipher(sender).decrypt(
          message.content
        );
      default:
        throw new Error(`Unknown type: ${message.type}`);
    }
  },

  // private byte[] encrypt(
  //   SecretKeySpec cipherKey, SecretKeySpec macKey, byte[] plaintext)
  async _encryptWithSecretKeys(cipherKey, macKey, plaintext) {
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
  },

  // private byte[] decrypt(
  //   SecretKeySpec cipherKey, SecretKeySpec macKey, byte[] ciphertext)
  async _decryptWithSecretKeys(cipherKey, macKey, ciphertext) {
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
      throw new Error('Bad mac!');
    }

    // Cipher const cipher = Cipher.getInstance('AES/CTR/NoPadding');
    // cipher.init(Cipher.DECRYPT_MODE, cipherKey, new IvParameterSpec(new byte[16]));

    // return cipher.doFinal(ciphertextParts[0]);
    return decryptAesCtr(cipherKey, ciphertextParts[0], getZeroes(16));
  },
};

module.exports = {
  SecretSessionCipher,
  createCertificateValidator,
  _createServerCertificateFromBuffer,
  _createSenderCertificateFromBuffer,
};
