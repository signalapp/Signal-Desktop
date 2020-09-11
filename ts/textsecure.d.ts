import {
  KeyPairType,
  SessionRecordType,
  SignedPreKeyType,
  StorageType,
} from './libsignal.d';
import Crypto from './textsecure/Crypto';
import MessageReceiver from './textsecure/MessageReceiver';
import EventTarget from './textsecure/EventTarget';
import { ByteBufferClass } from './window.d';
import SendMessage, { SendOptionsType } from './textsecure/SendMessage';
import { WebAPIType } from './textsecure/WebAPI';
import utils from './textsecure/Helpers';

type AttachmentType = any;

export type UnprocessedType = {
  attempts: number;
  decrypted?: string;
  envelope?: string;
  id: string;
  serverTimestamp?: number;
  source?: string;
  sourceDevice?: number;
  sourceUuid?: string;
  version: number;
};

export type StorageServiceCallOptionsType = {
  credentials?: StorageServiceCredentials;
  greaterThanVersion?: string;
};

export type StorageServiceCredentials = {
  username: string;
  password: string;
};

export type TextSecureType = {
  createTaskWithTimeout: (
    task: () => Promise<any>,
    id?: string,
    options?: { timeout?: number }
  ) => () => Promise<any>;
  crypto: typeof Crypto;
  storage: {
    user: {
      getNumber: () => string;
      getUuid: () => string | undefined;
      getDeviceId: () => number | string;
      getDeviceName: () => string;
      getDeviceNameEncrypted: () => boolean;
      setDeviceNameEncrypted: () => Promise<void>;
      getSignalingKey: () => ArrayBuffer;
      setNumberAndDeviceId: (
        number: string,
        deviceId: number,
        deviceName?: string | null
      ) => Promise<void>;
      setUuidAndDeviceId: (uuid: string, deviceId: number) => Promise<void>;
    };
    unprocessed: {
      batchAdd: (dataArray: Array<UnprocessedType>) => Promise<void>;
      remove: (id: string | Array<string>) => Promise<void>;
      getCount: () => Promise<number>;
      removeAll: () => Promise<void>;
      getAll: () => Promise<Array<UnprocessedType>>;
      updateAttempts: (id: string, attempts: number) => Promise<void>;
      addDecryptedDataToList: (
        array: Array<Partial<UnprocessedType>>
      ) => Promise<void>;
    };
    get: (key: string, defaultValue?: any) => any;
    put: (key: string, value: any) => Promise<void>;
    remove: (key: string | Array<string>) => Promise<void>;
    protocol: StorageProtocolType;
  };
  messageReceiver: {
    downloadAttachment: (
      attachment: AttachmentPointerClass
    ) => Promise<DownloadAttachmentType>;
  };
  messaging?: SendMessage;
  protobuf: ProtobufCollectionType;
  utils: typeof utils;

  EventTarget: typeof EventTarget;
  MessageReceiver: typeof MessageReceiver;
};

type StoredSignedPreKeyType = SignedPreKeyType & {
  confirmed?: boolean;
  created_at: number;
};

type IdentityKeyRecord = {
  publicKey: ArrayBuffer;
  firstUse: boolean;
  timestamp: number;
  verified: number;
  nonblockingApproval: boolean;
};

export type StorageProtocolType = StorageType & {
  VerifiedStatus: {
    DEFAULT: number;
    VERIFIED: number;
    UNVERIFIED: number;
  };
  archiveSiblingSessions: (identifier: string) => Promise<void>;
  removeSession: (identifier: string) => Promise<void>;
  getDeviceIds: (identifier: string) => Promise<Array<number>>;
  getIdentityRecord: (identifier: string) => IdentityKeyRecord | undefined;
  hydrateCaches: () => Promise<void>;
  clearPreKeyStore: () => Promise<void>;
  clearSignedPreKeysStore: () => Promise<void>;
  clearSessionStore: () => Promise<void>;
  isTrustedIdentity: () => void;
  storePreKey: (keyId: number, keyPair: KeyPairType) => Promise<void>;
  storeSignedPreKey: (
    keyId: number,
    keyPair: KeyPairType,
    confirmed?: boolean
  ) => Promise<void>;
  loadIdentityKey: (identifier: string) => Promise<ArrayBuffer | undefined>;
  loadSignedPreKeys: () => Promise<Array<StoredSignedPreKeyType>>;
  processVerifiedMessage: (
    identifier: string,
    verifiedStatus: number,
    publicKey: ArrayBuffer
  ) => Promise<boolean>;
  removeIdentityKey: (identifier: string) => Promise<void>;
  saveIdentityWithAttributes: (
    number: string,
    options: IdentityKeyRecord
  ) => Promise<void>;
  setVerified: (
    encodedAddress: string,
    verifiedStatus: number,
    publicKey?: ArrayBuffer
  ) => Promise<void>;
  removeSignedPreKey: (keyId: number) => Promise<void>;
  removeAllData: () => Promise<void>;
};

// Protobufs

type StorageServiceProtobufTypes = {
  AccountRecord: typeof AccountRecordClass;
  ContactRecord: typeof ContactRecordClass;
  GroupV1Record: typeof GroupV1RecordClass;
  GroupV2Record: typeof GroupV2RecordClass;
  ManifestRecord: typeof ManifestRecordClass;
  ReadOperation: typeof ReadOperation;
  StorageItem: typeof StorageItemClass;
  StorageItems: typeof StorageItemsClass;
  StorageManifest: typeof StorageManifest;
  StorageRecord: typeof StorageRecordClass;
};

type ProtobufCollectionType = StorageServiceProtobufTypes & {
  AttachmentPointer: typeof AttachmentPointerClass;
  ContactDetails: typeof ContactDetailsClass;
  Content: typeof ContentClass;
  DataMessage: typeof DataMessageClass;
  DeviceName: typeof DeviceNameClass;
  Envelope: typeof EnvelopeClass;
  GroupContext: typeof GroupContextClass;
  GroupContextV2: typeof GroupContextV2Class;
  GroupDetails: typeof GroupDetailsClass;
  NullMessage: typeof NullMessageClass;
  ProvisioningUuid: typeof ProvisioningUuidClass;
  ProvisionEnvelope: typeof ProvisionEnvelopeClass;
  ProvisionMessage: typeof ProvisionMessageClass;
  ReceiptMessage: typeof ReceiptMessageClass;
  SyncMessage: typeof SyncMessageClass;
  TypingMessage: typeof TypingMessageClass;
  Verified: typeof VerifiedClass;
  WebSocketMessage: typeof WebSocketMessageClass;
  WebSocketRequestMessage: typeof WebSocketRequestMessageClass;
  WebSocketResponseMessage: typeof WebSocketResponseMessageClass;
};

// Note: there are a lot of places in the code that overwrite a field like this
//   with a type that the app can use. Being more rigorous with these
//   types would require code changes, out of scope for now.
type ProtoBinaryType = any;
type ProtoBigNumberType = any;

export declare class AttachmentPointerClass {
  static decode: (
    data: ArrayBuffer | ByteBufferClass,
    encoding?: string
  ) => AttachmentPointerClass;

  cdnId?: ProtoBigNumberType;
  cdnKey?: string;
  contentType?: string;
  key?: ProtoBinaryType;
  size?: number;
  thumbnail?: ProtoBinaryType;
  digest?: ProtoBinaryType;
  fileName?: string;
  flags?: number;
  width?: number;
  height?: number;
  caption?: string;
  blurHash?: string;
  uploadTimestamp?: ProtoBigNumberType;
  cdnNumber?: number;
}

export type DownloadAttachmentType = {
  data: ArrayBuffer;
  cdnId?: ProtoBigNumberType;
  cdnKey?: string;
  contentType?: string;
  size?: number;
  thumbnail?: ProtoBinaryType;
  fileName?: string;
  flags?: number;
  width?: number;
  height?: number;
  caption?: string;
  blurHash?: string;
  uploadTimestamp?: ProtoBigNumberType;
  cdnNumber?: number;
};

export declare class ContactDetailsClass {
  static decode: (
    data: ArrayBuffer | ByteBufferClass,
    encoding?: string
  ) => ContactDetailsClass;

  number?: string;
  uuid?: string;
  name?: string;
  avatar?: ContactDetailsClass.Avatar;
  color?: string;
  verified?: VerifiedClass;
  profileKey?: ProtoBinaryType;
  blocked?: boolean;
  expireTimer?: number;
  inboxPosition?: number;
}

// Note: we need to use namespaces to express nested classes in Typescript
export declare namespace ContactDetailsClass {
  class Avatar {
    contentType?: string;
    length?: number;
  }
}

export declare class ContentClass {
  static decode: (
    data: ArrayBuffer | ByteBufferClass,
    encoding?: string
  ) => ContentClass;
  toArrayBuffer: () => ArrayBuffer;

  dataMessage?: DataMessageClass;
  syncMessage?: SyncMessageClass;
  callingMessage?: CallingMessageClass;
  nullMessage?: NullMessageClass;
  receiptMessage?: ReceiptMessageClass;
  typingMessage?: TypingMessageClass;
}

export declare class DataMessageClass {
  static decode: (
    data: ArrayBuffer | ByteBufferClass,
    encoding?: string
  ) => DataMessageClass;
  toArrayBuffer(): ArrayBuffer;

  body?: string | null;
  attachments?: Array<AttachmentPointerClass>;
  group?: GroupContextClass | null;
  groupV2?: GroupContextV2Class | null;
  flags?: number;
  expireTimer?: number;
  profileKey?: ProtoBinaryType;
  timestamp?: ProtoBigNumberType;
  quote?: DataMessageClass.Quote;
  contact?: Array<DataMessageClass.Contact>;
  preview?: Array<DataMessageClass.Preview>;
  sticker?: DataMessageClass.Sticker;
  requiredProtocolVersion?: number;
  isViewOnce?: boolean;
  reaction?: DataMessageClass.Reaction;
  delete?: DataMessageClass.Delete;
}

// Note: we need to use namespaces to express nested classes in Typescript
export declare namespace DataMessageClass {
  // Note: deep nesting
  class Contact {
    name: any;
    number: any;
    email: any;
    address: any;
    avatar: any;
    organization?: string;
  }

  class Flags {
    static END_SESSION: number;
    static EXPIRATION_TIMER_UPDATE: number;
    static PROFILE_KEY_UPDATE: number;
  }

  class Preview {
    url?: string;
    title?: string;
    image?: AttachmentPointerClass;
    description?: string;
    date?: ProtoBigNumberType;
  }

  class ProtocolVersion {
    static INITIAL: number;
    static MESSAGE_TIMERS: number;
    static VIEW_ONCE: number;
    static VIEW_ONCE_VIDEO: number;
    static REACTIONS: number;
    static CURRENT: number;
  }

  // Note: deep nesting
  class Quote {
    id?: ProtoBigNumberType;
    author?: string;
    authorUuid?: string;
    text?: string;
    attachments?: Array<DataMessageClass.Quote.QuotedAttachment>;
  }

  class Reaction {
    emoji?: string;
    remove?: boolean;
    targetAuthorE164?: string;
    targetAuthorUuid?: string;
    targetTimestamp?: ProtoBigNumberType;
  }

  class Delete {
    targetSentTimestamp?: ProtoBigNumberType;
  }

  class Sticker {
    packId?: ProtoBinaryType;
    packKey?: ProtoBinaryType;
    stickerId?: number;
    data?: AttachmentPointerClass;
  }
}

// Note: we need to use namespaces to express nested classes in Typescript
export declare namespace DataMessageClass.Quote {
  class QuotedAttachment {
    contentType?: string;
    fileName?: string;
    thumbnail?: AttachmentPointerClass;
  }
}

declare class DeviceNameClass {
  static decode: (
    data: ArrayBuffer | ByteBufferClass,
    encoding?: string
  ) => DeviceNameClass;
  encode: () => DeviceNameClass;
  toArrayBuffer: () => ArrayBuffer;

  ephemeralPublic: ProtoBinaryType;
  syntheticIv: ProtoBinaryType;
  ciphertext: ProtoBinaryType;
}

export declare class EnvelopeClass {
  static decode: (
    data: ArrayBuffer | ByteBufferClass,
    encoding?: string
  ) => EnvelopeClass;

  type?: number;
  source?: string;
  sourceUuid?: string;
  sourceDevice?: number;
  relay?: string;
  timestamp?: ProtoBigNumberType;
  legacyMessage?: ProtoBinaryType;
  content?: ProtoBinaryType;
  serverGuid?: string;
  serverTimestamp?: ProtoBigNumberType;

  // Note: these additional properties are added in the course of processing
  id: string;
  unidentifiedDeliveryReceived?: boolean;
  messageAgeSec?: number;
}

// Note: we need to use namespaces to express nested classes in Typescript
export declare namespace EnvelopeClass {
  class Type {
    static CIPHERTEXT: number;
    static PREKEY_BUNDLE: number;
    static RECEIPT: number;
    static UNIDENTIFIED_SENDER: number;
  }
}

export declare class GroupContextClass {
  static decode: (
    data: ArrayBuffer | ByteBufferClass,
    encoding?: string
  ) => GroupContextClass;

  id?: ProtoBinaryType;
  type?: number;
  name?: string | null;
  membersE164?: Array<string>;
  avatar?: AttachmentPointerClass | null;
}

export declare class GroupContextV2Class {
  static decode: (
    data: ArrayBuffer | ByteBufferClass,
    encoding?: string
  ) => GroupContextV2Class;

  masterKey?: ProtoBinaryType;
  revision?: number;
  groupChange?: ProtoBinaryType;
}

// Note: we need to use namespaces to express nested classes in Typescript
export declare namespace GroupContextClass {
  class Member {
    uuid?: string;
    e164?: string;
  }
  class Type {
    static UNKNOWN: number;
    static UPDATE: number;
    static DELIVER: number;
    static QUIT: number;
    static REQUEST_INFO: number;
  }
}

export declare class GroupDetailsClass {
  static decode: (
    data: ArrayBuffer | ByteBufferClass,
    encoding?: string
  ) => GroupDetailsClass;

  id?: ProtoBinaryType;
  name?: string;
  membersE164?: Array<string>;
  members?: Array<GroupDetailsClass.Member>;
  avatar?: GroupDetailsClass.Avatar;
  active?: boolean;
  expireTimer?: number;
  color?: string;
  blocked?: boolean;
  inboxPosition?: number;
}

// Note: we need to use namespaces to express nested classes in Typescript
export declare namespace GroupDetailsClass {
  class Avatar {
    contentType?: string;
    length?: string;
  }

  class Member {
    uuid?: string;
    e164?: string;
  }
}

declare enum ManifestType {
  UNKNOWN,
  CONTACT,
  GROUPV1,
  GROUPV2,
  ACCOUNT,
}

type ManifestRecordIdentifier = {
  raw: ProtoBinaryType;
  type: ManifestType;
};

export declare class ManifestRecordClass {
  static decode: (
    data: ArrayBuffer | ByteBufferClass,
    encoding?: string
  ) => ManifestRecordClass;

  static Identifier: {
    Type: typeof ManifestType;
  };

  version: ProtoBigNumberType;
  keys: ManifestRecordIdentifier[];
}

export declare class NullMessageClass {
  static decode: (
    data: ArrayBuffer | ByteBufferClass,
    encoding?: string
  ) => NullMessageClass;

  padding?: ProtoBinaryType;
}

declare class ProvisioningUuidClass {
  static decode: (
    data: ArrayBuffer | ByteBufferClass,
    encoding?: string
  ) => ProvisioningUuidClass;
  encode: () => ProvisioningUuidClass;
  toArrayBuffer: () => ArrayBuffer;

  uuid?: string;
}

declare class ProvisionEnvelopeClass {
  static decode: (
    data: ArrayBuffer | ByteBufferClass,
    encoding?: string
  ) => ProvisionEnvelopeClass;
  encode: () => ProvisionEnvelopeClass;
  toArrayBuffer: () => ArrayBuffer;

  publicKey?: ProtoBinaryType;
  body?: ProtoBinaryType;
}

declare class ProvisionMessageClass {
  static decode: (
    data: ArrayBuffer | ByteBufferClass,
    encoding?: string
  ) => ProvisionMessageClass;
  encode: () => ProvisionMessageClass;
  toArrayBuffer: () => ArrayBuffer;

  identityKeyPrivate?: ProtoBinaryType;
  number?: string;
  uuid?: string;
  provisioningCode?: string;
  userAgent?: string;
  profileKey?: ProtoBinaryType;
  readReceipts?: boolean;
  ProvisioningVersion?: number;
}

export declare class ReceiptMessageClass {
  static decode: (
    data: ArrayBuffer | ByteBufferClass,
    encoding?: string
  ) => ReceiptMessageClass;

  type?: number;
  timestamp?: ProtoBigNumberType;
}

// Note: we need to use namespaces to express nested classes in Typescript
export declare namespace ReceiptMessageClass {
  class Type {
    static DELIVERY: number;
    static READ: number;
  }
}

// Storage Service related types

declare class StorageManifest {
  static decode: (
    data: ArrayBuffer | ByteBufferClass,
    encoding?: string
  ) => StorageManifest;

  version?: ProtoBigNumberType | null;
  value?: ByteBufferClass | null;
}

export declare class StorageRecordClass {
  static decode: (
    data: ArrayBuffer | ByteBufferClass,
    encoding?: string
  ) => StorageRecordClass;

  contact?: ContactRecordClass | null;
  groupV1?: GroupV1RecordClass | null;
  groupV2?: GroupV2RecordClass | null;
  account?: AccountRecordClass | null;
}

export declare class StorageItemClass {
  static decode: (
    data: ArrayBuffer | ByteBufferClass,
    encoding?: string
  ) => StorageItemClass;

  key?: ByteBufferClass | null;
  value?: ByteBufferClass | null;
}

export declare class StorageItemsClass {
  static decode: (
    data: ArrayBuffer | ByteBufferClass,
    encoding?: string
  ) => StorageItemsClass;

  items?: StorageItemClass[] | null;
}

export declare enum ContactRecordIdentityState {
  DEFAULT = 0,
  VERIFIED = 1,
  UNVERIFIED = 2,
}

export declare class ContactRecordClass {
  static IdentityState: typeof ContactRecordIdentityState;

  static decode: (
    data: ArrayBuffer | ByteBufferClass,
    encoding?: string
  ) => ContactRecordClass;

  serviceUuid?: string | null;
  serviceE164?: string | null;
  profileKey?: ByteBufferClass | null;
  identityKey?: ByteBufferClass | null;
  identityState?: ContactRecordIdentityState | null;
  givenName?: string | null;
  familyName?: string | null;
  username?: string | null;
  blocked?: boolean | null;
  whitelisted?: boolean | null;
  archived?: boolean | null;
}

export declare class GroupV1RecordClass {
  static decode: (
    data: ArrayBuffer | ByteBufferClass,
    encoding?: string
  ) => GroupV1RecordClass;

  id?: ByteBufferClass | null;
  blocked?: boolean | null;
  whitelisted?: boolean | null;
  archived?: boolean | null;
}

export declare class GroupV2RecordClass {
  static decode: (
    data: ArrayBuffer | ByteBufferClass,
    encoding?: string
  ) => GroupV2RecordClass;

  masterKey?: ByteBufferClass | null;
  blocked?: boolean | null;
  whitelisted?: boolean | null;
  archived?: boolean | null;
}

export declare class AccountRecordClass {
  static decode: (
    data: ArrayBuffer | ByteBufferClass,
    encoding?: string
  ) => AccountRecordClass;

  profileKey?: ByteBufferClass | null;
  givenName?: string | null;
  familyName?: string | null;
  avatarUrl?: string | null;
  noteToSelfArchived?: boolean | null;
  readReceipts?: boolean | null;
  sealedSenderIndicators?: boolean | null;
  typingIndicators?: boolean | null;
  linkPreviews?: boolean | null;
}

declare class ReadOperation {
  static decode: (
    data: ArrayBuffer | ByteBufferClass,
    encoding?: string
  ) => ReadOperation;

  readKey: ArrayBuffer[] | ByteBufferClass[];
  toArrayBuffer: () => ArrayBuffer;
}

export declare class SyncMessageClass {
  static decode: (
    data: ArrayBuffer | ByteBufferClass,
    encoding?: string
  ) => SyncMessageClass;

  sent?: SyncMessageClass.Sent;
  contacts?: SyncMessageClass.Contacts;
  groups?: SyncMessageClass.Groups;
  request?: SyncMessageClass.Request;
  read?: Array<SyncMessageClass.Read>;
  blocked?: SyncMessageClass.Blocked;
  verified?: VerifiedClass;
  configuration?: SyncMessageClass.Configuration;
  padding?: ProtoBinaryType;
  stickerPackOperation?: Array<SyncMessageClass.StickerPackOperation>;
  viewOnceOpen?: SyncMessageClass.ViewOnceOpen;
  messageRequestResponse?: SyncMessageClass.MessageRequestResponse;
  fetchLatest?: SyncMessageClass.FetchLatest;
  keys?: SyncMessageClass.Keys;
}

// Note: we need to use namespaces to express nested classes in Typescript
export declare namespace SyncMessageClass {
  class Configuration {
    readReceipts?: boolean;
    unidentifiedDeliveryIndicators?: boolean;
    typingIndicators?: boolean;
    linkPreviews?: boolean;
  }
  class Contacts {
    blob?: AttachmentPointerClass;
    complete?: boolean;
  }
  class Groups {
    blob?: AttachmentPointerClass;
  }
  class Blocked {
    numbers?: Array<string>;
    uuids?: Array<string>;
    groupIds?: Array<ProtoBinaryType>;
  }
  class Read {
    sender?: string;
    senderUuid?: string;
    timestamp?: ProtoBigNumberType;
  }
  class Request {
    type?: number;
  }
  class Sent {
    destination?: string;
    destinationUuid?: string;
    timestamp?: ProtoBigNumberType;
    message?: DataMessageClass;
    expirationStartTimestamp?: ProtoBigNumberType;
    unidentifiedStatus?: Array<
      SyncMessageClass.Sent.UnidentifiedDeliveryStatus
    >;
    isRecipientUpdate?: boolean;
  }
  class StickerPackOperation {
    packId?: ProtoBinaryType;
    packKey?: ProtoBinaryType;
    type?: number;
  }
  class ViewOnceOpen {
    sender?: string;
    senderUuid?: string;
    timestamp?: ProtoBinaryType;
  }
  class FetchLatest {
    type?: number;
  }
  class Keys {
    storageService?: ByteBufferClass;
  }

  class MessageRequestResponse {
    threadE164?: string;
    threadUuid?: string;
    groupId?: ProtoBinaryType;
    type?: number;
  }
}

// Note: we need to use namespaces to express nested classes in Typescript
export declare namespace SyncMessageClass.Request {
  class Type {
    static UNKNOWN: number;
    static BLOCKED: number;
    static CONFIGURATION: number;
    static CONTACTS: number;
    static GROUPS: number;
    static KEYS: number;
  }
}

// Note: we need to use namespaces to express nested classes in Typescript
export declare namespace SyncMessageClass.Sent {
  class UnidentifiedDeliveryStatus {
    destination?: string;
    destinationUuid?: string;
    unidentified?: boolean;
  }
}

// Note: we need to use namespaces to express nested classes in Typescript
export declare namespace SyncMessageClass.StickerPackOperation {
  class Type {
    static INSTALL: number;
    static REMOVE: number;
  }
}

export declare namespace SyncMessageClass.MessageRequestResponse {
  class Type {
    static UNKNOWN: number;
    static ACCEPT: number;
    static DELETE: number;
    static BLOCK: number;
    static BLOCK_AND_DELETE: number;
  }
}

export declare class TypingMessageClass {
  static decode: (
    data: ArrayBuffer | ByteBufferClass,
    encoding?: string
  ) => TypingMessageClass;

  timestamp?: ProtoBigNumberType;
  action?: number;
  groupId?: ProtoBinaryType;
}

// Note: we need to use namespaces to express nested classes in Typescript
export declare namespace TypingMessageClass {
  class Action {
    static STARTED: number;
    static STOPPED: number;
  }
}

export declare class VerifiedClass {
  static decode: (
    data: ArrayBuffer | ByteBufferClass,
    encoding?: string
  ) => VerifiedClass;

  destination?: string;
  destinationUuid?: string;
  identityKey?: ProtoBinaryType;
  state?: number;
  nullMessage?: ProtoBinaryType;
}

export declare class WebSocketMessageClass {
  constructor(data: any);
  encode: () => WebSocketMessageClass;
  toArrayBuffer: () => ArrayBuffer;
  static decode: (
    data: ArrayBuffer | ByteBufferClass,
    encoding?: string
  ) => WebSocketMessageClass;

  type?: number;
  request?: WebSocketRequestMessageClass;
  response?: WebSocketResponseMessageClass;
}

// Note: we need to use namespaces to express nested classes in Typescript
export declare namespace WebSocketMessageClass {
  class Type {
    static UNKNOWN: number;
    static REQUEST: number;
    static RESPONSE: number;
  }
}

export declare class WebSocketRequestMessageClass {
  static decode: (
    data: ArrayBuffer | ByteBufferClass,
    encoding?: string
  ) => WebSocketRequestMessageClass;
  verb?: string;
  path?: string;
  body?: ProtoBinaryType;
  headers?: Array<string>;
  id?: ProtoBigNumberType;
}

export declare class WebSocketResponseMessageClass {
  static decode: (
    data: ArrayBuffer | ByteBufferClass,
    encoding?: string
  ) => WebSocketResponseMessageClass;
  id?: ProtoBigNumberType;
  status?: number;
  message?: string;
  headers?: Array<string>;
  body?: ProtoBinaryType;
}

// Everything from here down to HangupType (everything related to calling)
// must be kept in sync with RingRTC (ringrtc-node).
// Whenever you change this, make sure you change RingRTC as well.

type ProtobufArrayBuffer = ArrayBuffer | { toArrayBuffer: () => ArrayBuffer };

export type DeviceId = number;

export type CallId = any;

export class CallingMessageClass {
  offer?: OfferMessageClass;
  answer?: AnswerMessageClass;
  iceCandidates?: Array<IceCandidateMessageClass>;
  legacyHangup?: HangupMessageClass;
  busy?: BusyMessageClass;
  hangup?: HangupMessageClass;
  supportsMultiRing?: boolean;
  destinationDeviceId?: DeviceId;
}

export class OfferMessageClass {
  callId?: CallId;
  type?: OfferType;
  sdp?: string;
}

export enum OfferType {
  AudioCall = 0,
  VideoCall = 1,
}

export class AnswerMessageClass {
  callId?: CallId;
  sdp?: string;
}

export class IceCandidateMessageClass {
  callId?: CallId;
  mid?: string;
  line?: number;
  opaque?: ProtobufArrayBuffer;
  sdp?: string;
}

export class BusyMessageClass {
  callId?: CallId;
}

export class HangupMessageClass {
  callId?: CallId;
  type?: HangupType;
  deviceId?: DeviceId;
}

export enum HangupType {
  Normal = 0,
  Accepted = 1,
  Declined = 2,
  Busy = 3,
  NeedPermission = 4,
}
