// Captures the globals put in place by preload.js, background.js and others

import {
  LibSignalType,
  SignalProtocolAddressClass,
  StorageType,
} from './libsignal.d';
import { TextSecureType } from './textsecure.d';
import { WebAPIConnectType } from './textsecure/WebAPI';
import * as Crypto from './Crypto';

declare global {
  interface Window {
    dcodeIO: DCodeIOType;
    getExpiration: () => string;
    getEnvironment: () => string;
    getSocketStatus: () => number;
    libphonenumber: {
      util: {
        getRegionCodeForNumber: (number: string) => string;
      };
    };
    libsignal: LibSignalType;
    log: {
      info: LoggerType;
      warn: LoggerType;
      error: LoggerType;
    };
    normalizeUuids: (obj: any, paths: Array<string>, context: string) => any;
    restart: () => void;
    storage: {
      put: (key: string, value: any) => void;
      remove: (key: string) => void;
      get: (key: string) => any;
    };
    textsecure: TextSecureType;

    Signal: {
      Crypto: typeof Crypto;
      Metadata: {
        SecretSessionCipher: typeof SecretSessionCipherClass;
        createCertificateValidator: (
          trustRoot: ArrayBuffer
        ) => CertificateValidatorType;
      };
    };
    ConversationController: ConversationControllerType;
    WebAPI: WebAPIConnectType;
    Whisper: WhisperType;
  }
}

export type ConversationType = {
  updateE164: (e164?: string) => void;
  updateUuid: (uuid?: string) => void;
  id: string;
};

export type ConversationControllerType = {
  getOrCreateAndWait: (
    identifier: string,
    type: 'private' | 'group'
  ) => Promise<ConversationType>;
  getConversationId: (identifier: string) => string | null;
  prepareForSend: (
    id: string,
    options: Object
  ) => {
    wrap: (promise: Promise<any>) => Promise<void>;
    sendOptions: Object;
  };
  get: (
    identifier: string
  ) => null | {
    get: (key: string) => any;
  };
};

export type DCodeIOType = {
  ByteBuffer: typeof ByteBufferClass;
  Long: {
    fromBits: (low: number, high: number, unsigned: boolean) => number;
  };
};

export class CertificateValidatorType {
  validate: (cerficate: any, certificateTime: number) => Promise<void>;
}

export class SecretSessionCipherClass {
  constructor(storage: StorageType);
  decrypt: (
    validator: CertificateValidatorType,
    ciphertext: ArrayBuffer,
    serverTimestamp: number,
    me: any
  ) => Promise<{
    isMe: boolean;
    sender: SignalProtocolAddressClass;
    senderUuid: SignalProtocolAddressClass;
    content: ArrayBuffer;
  }>;
  getRemoteRegistrationId: (
    address: SignalProtocolAddressClass
  ) => Promise<number>;
  closeOpenSessionForDevice: (
    address: SignalProtocolAddressClass
  ) => Promise<void>;
  encrypt: (
    address: SignalProtocolAddressClass,
    senderCertificate: any,
    plaintext: ArrayBuffer | Uint8Array
  ) => Promise<ArrayBuffer>;
}

export class ByteBufferClass {
  constructor(value?: any, encoding?: string);
  static wrap: (value: any, type?: string) => ByteBufferClass;
  toString: (type: string) => string;
  toArrayBuffer: () => ArrayBuffer;
  slice: (start: number, end?: number) => ByteBufferClass;
  append: (data: ArrayBuffer) => void;
  limit: number;
  offset: 0;
  readVarint32: () => number;
  skip: (length: number) => void;
}

export type LoggerType = (...args: Array<any>) => void;

export type WhisperType = {
  events: {
    trigger: (name: string, param1: any, param2: any) => void;
  };
  Database: {
    open: () => Promise<IDBDatabase>;
    handleDOMException: (
      context: string,
      error: DOMException | null,
      reject: Function
    ) => void;
  };
};
