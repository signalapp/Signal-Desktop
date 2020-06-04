import { SignalService } from '../../protobuf';

export type BinaryString = string;

export type CipherTextObject = {
  type: SignalService.Envelope.Type;
  body: BinaryString;
  registrationId?: number;
};

export declare class SignalProtocolAddress {
  constructor(hexEncodedPublicKey: string, deviceId: number);
  // tslint:disable-next-line: function-name
  public static fromString(encodedAddress: string): SignalProtocolAddress;
  public getName(): string;
  public getDeviceId(): number;
  public toString(): string;
  public equals(other: SignalProtocolAddress): boolean;
}

export type KeyPair = {
  pubKey: ArrayBuffer;
  privKey: ArrayBuffer;
};

interface CurveSync {
  generateKeyPair(): KeyPair;
  createKeyPair(privKey: ArrayBuffer): KeyPair;
  calculateAgreement(pubKey: ArrayBuffer, privKey: ArrayBuffer): ArrayBuffer;
  verifySignature(
    pubKey: ArrayBuffer,
    msg: ArrayBuffer,
    sig: ArrayBuffer
  ): void;
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
  public encrypt(buffer: ArrayBuffer | Uint8Array): Promise<CipherTextObject>;
  public decryptPreKeyWhisperMessage(
    buffer: ArrayBuffer | Uint8Array
  ): Promise<ArrayBuffer>;
  public decryptWhisperMessage(
    buffer: ArrayBuffer | Uint8Array
  ): Promise<ArrayBuffer>;
  public getRecord(encodedNumber: string): Promise<any | undefined>;
  public getRemoteRegistrationId(): Promise<number>;
  public hasOpenSession(): Promise<boolean>;
  public closeOpenSessionForDevice(): Promise<void>;
  public deleteAllSessionsForDevice(): Promise<void>;
}

export interface LibsignalProtocol {
  SignalProtocolAddress: typeof SignalProtocolAddress;
  Curve: CurveInterface;
  crypto: CryptoInterface;
  KeyHelper: KeyHelperInterface;
  SessionCipher: typeof SessionCipher;
}
