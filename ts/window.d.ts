// Captures the globals put in place by preload.js, background.js and others

import { Ref } from 'react';
import {
  LibSignalType,
  SignalProtocolAddressClass,
  StorageType,
} from './libsignal.d';
import { TextSecureType } from './textsecure.d';
import { WebAPIConnectType } from './textsecure/WebAPI';
import { CallingClass, CallHistoryDetailsType } from './services/calling';
import * as Crypto from './Crypto';
import { ColorType, LocalizerType } from './types/Util';
import { SendOptionsType } from './textsecure/SendMessage';

declare global {
  interface Window {
    dcodeIO: DCodeIOType;
    getExpiration: () => string;
    getEnvironment: () => string;
    getSocketStatus: () => number;
    getAlwaysRelayCalls: () => Promise<boolean>;
    getIncomingCallNotification: () => Promise<boolean>;
    getCallRingtoneNotification: () => Promise<boolean>;
    getCallSystemNotification: () => Promise<boolean>;
    getMediaPermissions: () => Promise<boolean>;
    getMediaCameraPermissions: () => Promise<boolean>;
    showCallingPermissionsPopup: (forCamera: boolean) => Promise<void>;
    i18n: LocalizerType;
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
    platform: string;
    restart: () => void;
    showWindow: () => void;
    storage: {
      put: (key: string, value: any) => void;
      remove: (key: string) => void;
      get: <T = any>(key: string) => T | undefined;
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
      Services: {
        calling: CallingClass;
      };
    };
    ConversationController: ConversationControllerType;
    WebAPI: WebAPIConnectType;
    Whisper: WhisperType;

    // Flags
    CALLING: boolean;
  }

  interface Error {
    cause?: Event;
  }
}

export type ConversationType = {
  updateE164: (e164?: string) => void;
  updateUuid: (uuid?: string) => void;
  id: string;
  get: (key: string) => any;
  getAvatarPath(): string | undefined;
  getColor(): ColorType | undefined;
  getName(): string | undefined;
  getNumber(): string;
  getProfileName(): string | undefined;
  getRecipients: () => Array<string>;
  getSendOptions(): SendOptionsType;
  safeGetVerified(): Promise<number>;
  getIsAddedByContact(): boolean;
  addCallHistory(details: CallHistoryDetailsType): void;
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
  get: (identifier: string) => null | ConversationType;
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

export class GumVideoCapturer {
  constructor(
    maxWidth: number,
    maxHeight: number,
    maxFramerate: number,
    localPreview: Ref<HTMLVideoElement>
  );
}

export class CanvasVideoRenderer {
  constructor(canvas: Ref<HTMLCanvasElement>);
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
