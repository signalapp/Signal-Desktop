import { SignalService } from '../ts/protobuf';

export type BinaryString = String;

export type CipherTextObject = {
  type: SignalService.Envelope.Type;
  body: BinaryString;
  registrationId?: number;
};

export declare class SignalProtocolAddress {
  constructor(hexEncodedPublicKey: string, deviceId: number);
  getName(): string;
  getDeviceId(): number;
  toString(): string;
  equals(other: SignalProtocolAddress): boolean;
  static fromString(encodedAddress: string): SignalProtocolAddress;
}

export type KeyPair = {
  pubKey: ArrayBuffer;
  privKey: ArrayBuffer;
};

interface CurveSync {
  generateKeyPair(): KeyPair;
  createKeyPair(privKey: ArrayBuffer): KeyPair;
  calculateAgreement(pubKey: ArrayBuffer, privKey: ArrayBuffer): ArrayBuffer;
  verifySignature(pubKey: ArrayBuffer, msg: ArrayBuffer, sig: ArrayBuffer);
  calculateSignature(privKey: ArrayBuffer, message: ArrayBuffer): ArrayBuffer;
  validatePubKeyFormat(pubKey: ArrayBuffer): ArrayBuffer;
}

interface CurveAsync {
  generateKeyPair(): Promise<KeyPair>;
  createKeyPair(privKey: ArrayBuffer): Promise<KeyPair>;
  calculateAgreement(
    pubKey: ArrayBuffer,
    privKey: ArrayBuffer
  ): Promise<ArrayBuffer>;
  verifySignature(
    pubKey: ArrayBuffer,
    msg: ArrayBuffer,
    sig: ArrayBuffer
  ): Promise<void>;
  calculateSignature(
    privKey: ArrayBuffer,
    message: ArrayBuffer
  ): Promise<ArrayBuffer>;
  validatePubKeyFormat(pubKey: ArrayBuffer): Promise<ArrayBuffer>;
}

export interface CurveInterface extends CurveSync {
  async: CurveAsync;
}

export interface CryptoInterface {
  encrypt(
    key: ArrayBuffer,
    data: ArrayBuffer,
    iv: ArrayBuffer
  ): Promise<ArrayBuffer>;
  decrypt(
    key: ArrayBuffer,
    data: ArrayBuffer,
    iv: ArrayBuffer
  ): Promise<ArrayBuffer>;
  calculateMAC(key: ArrayBuffer, data: ArrayBuffer): Promise<ArrayBuffer>;
  verifyMAC(
    data: ArrayBuffer,
    key: ArrayBuffer,
    mac: ArrayBuffer,
    length: number
  ): Promise<void>;
  getRandomBytes(size: number): ArrayBuffer;
}

export interface KeyHelperInterface {
  generateIdentityKeyPair(): Promise<KeyPair>;
  generateRegistrationId(): number;
  generateSignedPreKey(
    identityKeyPair: KeyPair,
    signedKeyId: number
  ): Promise<{
    keyId: number;
    keyPair: KeyPair;
    signature: ArrayBuffer;
  }>;
  generatePreKey(
    keyId: number
  ): Promise<{
    keyId: number;
    keyPair: KeyPair;
  }>;
}

export declare class SessionCipher {
  constructor(storage: any, remoteAddress: SignalProtocolAddress);
  /**
   * @returns The envelope type, registration id and binary encoded encrypted body.
   */
  encrypt(buffer: ArrayBuffer | Uint8Array): Promise<CipherTextObject>;
  decryptPreKeyWhisperMessage(
    buffer: ArrayBuffer | Uint8Array
  ): Promise<ArrayBuffer>;
  decryptWhisperMessage(buffer: ArrayBuffer | Uint8Array): Promise<ArrayBuffer>;
  getRecord(encodedNumber: string): Promise<any | undefined>;
  getRemoteRegistrationId(): Promise<number>;
  hasOpenSession(): Promise<boolean>;
  closeOpenSessionForDevice(): Promise<void>;
  deleteAllSessionsForDevice(): Promise<void>;
}

export interface LibsignalProtocol {
  SignalProtocolAddress: typeof SignalProtocolAddress;
  Curve: CurveInterface;
  crypto: CryptoInterface;
  KeyHelper: KeyHelperInterface;
  SessionCipher: typeof SessionCipher;
}
