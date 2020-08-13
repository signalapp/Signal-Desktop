// Captures the globals put in place by preload.js, background.js and others

import * as Backbone from 'backbone';
import * as Underscore from 'underscore';
import { Ref } from 'react';
import {
  ConversationModelCollectionType,
  ConversationModelType,
  MessageModelCollectionType,
  MessageModelType,
} from './model-types.d';
import {
  LibSignalType,
  SignalProtocolAddressClass,
  StorageType,
} from './libsignal.d';
import { ContactRecordIdentityState, TextSecureType } from './textsecure.d';
import { WebAPIConnectType } from './textsecure/WebAPI';
import { CallingClass, CallHistoryDetailsType } from './services/calling';
import * as Crypto from './Crypto';
import { LocalizerType } from './types/Util';
import { ColorType } from './types/Colors';
import { ConversationController } from './ConversationController';
import { SendOptionsType } from './textsecure/SendMessage';
import Data from './sql/Client';

type TaskResultType = any;

declare global {
  interface Window {
    dcodeIO: DCodeIOType;
    getAlwaysRelayCalls: () => Promise<boolean>;
    getCallRingtoneNotification: () => Promise<boolean>;
    getCallSystemNotification: () => Promise<boolean>;
    getConversations: () => ConversationModelCollectionType;
    getEnvironment: () => string;
    getExpiration: () => string;
    getGuid: () => string;
    getInboxCollection: () => ConversationModelCollectionType;
    getIncomingCallNotification: () => Promise<boolean>;
    getMediaCameraPermissions: () => Promise<boolean>;
    getMediaPermissions: () => Promise<boolean>;
    getSocketStatus: () => number;
    getTitle: () => string;
    showCallingPermissionsPopup: (forCamera: boolean) => Promise<void>;
    i18n: LocalizerType;
    isValidGuid: (maybeGuid: string) => boolean;
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
    setBadgeCount: (count: number) => void;
    storage: {
      put: (key: string, value: any) => void;
      remove: (key: string) => Promise<void>;
      get: <T = any>(key: string) => T | undefined;
      addBlockedNumber: (number: string) => void;
      isBlocked: (number: string) => boolean;
      removeBlockedNumber: (number: string) => void;
    };
    textsecure: TextSecureType;
    updateTrayIcon: (count: number) => void;

    Backbone: typeof Backbone;
    Signal: {
      Crypto: typeof Crypto;
      Data: typeof Data;
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
    ConversationController: ConversationController;
    WebAPI: WebAPIConnectType;
    Whisper: WhisperType;

    // Flags
    CALLING: boolean;
  }

  interface Error {
    cause?: Event;
  }
}

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
  toBinary: () => string;
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
    trigger: (name: string, param1: any, param2?: any) => void;
  };
  Database: {
    open: () => Promise<IDBDatabase>;
    handleDOMException: (
      context: string,
      error: DOMException | null,
      reject: Function
    ) => void;
  };
  ConversationCollection: typeof ConversationModelCollectionType;
  Conversation: typeof ConversationModelType;
  MessageCollection: typeof MessageModelCollectionType;
  Message: typeof MessageModelType;
};
