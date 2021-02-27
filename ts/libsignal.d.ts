// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export type LibSignalType = {
  externalCurve?: CurveType;
  crypto: {
    encrypt: (
      key: ArrayBuffer,
      data: ArrayBuffer,
      iv: ArrayBuffer
    ) => Promise<ArrayBuffer>;
    decrypt: (
      key: ArrayBuffer,
      data: ArrayBuffer,
      iv: ArrayBuffer
    ) => Promise<ArrayBuffer>;
    calculateMAC: (key: ArrayBuffer, data: ArrayBuffer) => Promise<ArrayBuffer>;
    verifyMAC: (
      data: ArrayBuffer,
      key: ArrayBuffer,
      mac: ArrayBuffer,
      length: number
    ) => Promise<void>;
    getRandomBytes: (size: number) => ArrayBuffer;
  };
  externalCurveAsync: {
    calculateAgreement: (
      pubKey: ArrayBuffer,
      privKey: ArrayBuffer
    ) => Promise<ArrayBuffer>;
    generateKeyPair: () => Promise<{
      privKey: ArrayBuffer;
      pubKey: ArrayBuffer;
    }>;
  };
  KeyHelper: {
    generateIdentityKeyPair: () => Promise<{
      privKey: ArrayBuffer;
      pubKey: ArrayBuffer;
    }>;
    generateRegistrationId: () => number;
    generateSignedPreKey: (
      identityKeyPair: KeyPairType,
      signedKeyId: number
    ) => Promise<SignedPreKeyType>;
    generatePreKey: (keyId: number) => Promise<PreKeyType>;
  };
  Curve: {
    generateKeyPair: () => KeyPairType;
    createKeyPair: (privKey: ArrayBuffer) => KeyPairType;
    calculateAgreement: (
      pubKey: ArrayBuffer,
      privKey: ArrayBuffer
    ) => ArrayBuffer;
    verifySignature: (
      pubKey: ArrayBuffer,
      msg: ArrayBuffer,
      sig: ArrayBuffer
    ) => void;
    calculateSignature: (
      privKey: ArrayBuffer,
      message: ArrayBuffer
    ) => ArrayBuffer | Promise<ArrayBuffer>;
    validatePubKeyFormat: (buffer: ArrayBuffer) => ArrayBuffer;
    async: CurveType;
  };
  HKDF: {
    deriveSecrets: (
      packKey: ArrayBuffer,
      salt: ArrayBuffer,
      // The string is a bit crazy, but ProvisioningCipher currently passes in a string
      info?: ArrayBuffer | string
    ) => Promise<Array<ArrayBuffer>>;
  };
  worker: {
    startWorker: () => void;
    stopWorker: () => void;
  };
  FingerprintGenerator: typeof FingerprintGeneratorClass;
  SessionBuilder: typeof SessionBuilderClass;
  SessionCipher: typeof SessionCipherClass;
  SignalProtocolAddress: typeof SignalProtocolAddressClass;
};

export type KeyPairType = {
  pubKey: ArrayBuffer;
  privKey: ArrayBuffer;
};

export type SignedPreKeyType = {
  keyId: number;
  keyPair: KeyPairType;
  signature: ArrayBuffer;
};

export type PreKeyType = {
  keyId: number;
  keyPair: KeyPairType;
};

type RecordType = {
  archiveCurrentState: () => void;
  deleteAllSessions: () => void;
  getOpenSession: () => void;
  getSessionByBaseKey: () => void;
  getSessions: () => void;
  haveOpenSession: () => void;
  promoteState: () => void;
  serialize: () => void;
  updateSessionState: () => void;
};

type CurveType = {
  generateKeyPair: () => Promise<KeyPairType>;
  createKeyPair: (privKey: ArrayBuffer) => Promise<KeyPairType>;
  calculateAgreement: (
    pubKey: ArrayBuffer,
    privKey: ArrayBuffer
  ) => Promise<ArrayBuffer>;
  verifySignature: (
    pubKey: ArrayBuffer,
    msg: ArrayBuffer,
    sig: ArrayBuffer
  ) => Promise<void>;
  calculateSignature: (
    privKey: ArrayBuffer,
    message: ArrayBuffer
  ) => ArrayBuffer | Promise<ArrayBuffer>;
  validatePubKeyFormat: (buffer: ArrayBuffer) => ArrayBuffer;
};

type SessionRecordType = any;

export type StorageType = {
  Direction: {
    SENDING: number;
    RECEIVING: number;
  };
  getIdentityKeyPair: () => Promise<KeyPairType>;
  getLocalRegistrationId: () => Promise<number>;
  isTrustedIdentity: () => Promise<void>;
  loadPreKey: (
    encodedAddress: string,
    publicKey: ArrayBuffer | undefined,
    direction: number
  ) => Promise<void>;
  loadSession: (encodedAddress: string) => Promise<SessionRecordType>;
  loadSignedPreKey: (keyId: number) => Promise<SignedPreKeyType>;
  removePreKey: (keyId: number) => Promise<void>;
  saveIdentity: (
    encodedAddress: string,
    publicKey: ArrayBuffer,
    nonblockingApproval?: boolean
  ) => Promise<boolean>;
  storeSession: (
    encodedAddress: string,
    record: SessionRecordType
  ) => Promise<void>;
};

declare class FingerprintGeneratorClass {
  constructor(iterations: number);
  createFor: (
    localIdentifier: string,
    localIdentityKey: ArrayBuffer,
    remoteIdentifier: string,
    remoteIdentityKey: ArrayBuffer
  ) => string;
}

export declare class SignalProtocolAddressClass {
  static fromString(encodedAddress: string): SignalProtocolAddressClass;
  constructor(name: string, deviceId: number);
  getName: () => string;
  getDeviceId: () => number;
  toString: () => string;
  equals: (other: SignalProtocolAddressClass) => boolean;
}

type DeviceType = {
  deviceId: number;
  identityKey: ArrayBuffer;
  registrationId: number;
  signedPreKey: {
    keyId: number;
    publicKey: ArrayBuffer;
    signature: ArrayBuffer;
  };
  preKey?: {
    keyId: number;
    publicKey: ArrayBuffer;
  };
};

declare class SessionBuilderClass {
  constructor(storage: StorageType, remoteAddress: SignalProtocolAddressClass);
  processPreKey: (device: DeviceType) => Promise<void>;
  processV3: (record: RecordType, message: any) => Promise<void>;
}

export declare class SessionCipherClass {
  constructor(
    storage: StorageType,
    remoteAddress: SignalProtocolAddressClass | string,
    options?: { messageKeysLimit?: number | boolean }
  );
  closeOpenSessionForDevice: () => Promise<void>;
  decryptPreKeyWhisperMessage: (
    buffer: ArrayBuffer,
    encoding?: string
  ) => Promise<ArrayBuffer>;
  decryptWhisperMessage: (
    buffer: ArrayBuffer,
    encoding?: string
  ) => Promise<ArrayBuffer>;
  deleteAllSessionsForDevice: () => Promise<void>;
  encrypt: (
    buffer: ArrayBuffer | Uint8Array,
    encoding?: string
  ) => Promise<{
    type: number;
    registrationId: number;
    body: string;
  }>;
  getRecord: () => Promise<RecordType>;
  getSessionVersion: () => Promise<number>;
  getRemoteRegistrationId: () => Promise<number>;
  hasOpenSession: () => Promise<boolean>;
}
