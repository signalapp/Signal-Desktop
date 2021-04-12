// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import {
  KeyPairType,
  SessionRecordType,
  SignedPreKeyType,
  StorageType,
} from './libsignal.d';
import Crypto from './textsecure/Crypto';
import MessageReceiver from './textsecure/MessageReceiver';
import MessageSender from './textsecure/SendMessage';
import EventTarget from './textsecure/EventTarget';
import { ByteBufferClass } from './window.d';
import SendMessage, { SendOptionsType } from './textsecure/SendMessage';
import { WebAPIType } from './textsecure/WebAPI';
import utils from './textsecure/Helpers';
import { CallingMessage as CallingMessageClass } from 'ringrtc';
import { WhatIsThis } from './window.d';

export type UnprocessedType = {
  attempts: number;
  decrypted?: string;
  envelope?: string;
  id: string;
  timestamp: number;
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
    task: () => Promise<any> | any,
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
  messageReceiver: MessageReceiver;
  messageSender: MessageSender;
  messaging: SendMessage;
  protobuf: ProtobufCollectionType;
  utils: typeof utils;

  EventTarget: typeof EventTarget;
  MessageReceiver: typeof MessageReceiver;
  AccountManager: WhatIsThis;
  MessageSender: WhatIsThis;
  SyncRequest: WhatIsThis;
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
  getVerified: (id: string) => Promise<number>;
  hydrateCaches: () => Promise<void>;
  clearPreKeyStore: () => Promise<void>;
  clearSignedPreKeysStore: () => Promise<void>;
  clearSessionStore: () => Promise<void>;
  isTrustedIdentity: () => void;
  isUntrusted: (id: string) => boolean;
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
  setApproval: (id: string, something: boolean) => void;
  setVerified: (
    encodedAddress: string,
    verifiedStatus: number,
    publicKey?: ArrayBuffer
  ) => Promise<void>;
  removeSignedPreKey: (keyId: number) => Promise<void>;
  removeAllSessions: (identifier: string) => Promise<void>;
  removeAllData: () => Promise<void>;
  on: (key: string, callback: () => void) => WhatIsThis;
  removeAllConfiguration: () => Promise<void>;
};

// Protobufs

type DeviceMessagesProtobufTypes = {
  ProvisioningUuid: typeof ProvisioningUuidClass;
  ProvisionEnvelope: typeof ProvisionEnvelopeClass;
  ProvisionMessage: typeof ProvisionMessageClass;
};

type DeviceNameProtobufTypes = {
  DeviceName: typeof DeviceNameClass;
};

type GroupsProtobufTypes = {
  AvatarUploadAttributes: typeof AvatarUploadAttributesClass;
  Member: typeof MemberClass;
  MemberPendingProfileKey: typeof MemberPendingProfileKeyClass;
  MemberPendingAdminApproval: typeof MemberPendingAdminApprovalClass;
  AccessControl: typeof AccessControlClass;
  Group: typeof GroupClass;
  GroupChange: typeof GroupChangeClass;
  GroupChanges: typeof GroupChangesClass;
  GroupAttributeBlob: typeof GroupAttributeBlobClass;
  GroupExternalCredential: typeof GroupExternalCredentialClass;
  GroupInviteLink: typeof GroupInviteLinkClass;
  GroupJoinInfo: typeof GroupJoinInfoClass;
};

type SignalServiceProtobufTypes = {
  AttachmentPointer: typeof AttachmentPointerClass;
  ContactDetails: typeof ContactDetailsClass;
  Content: typeof ContentClass;
  DataMessage: typeof DataMessageClass;
  Envelope: typeof EnvelopeClass;
  GroupContext: typeof GroupContextClass;
  GroupContextV2: typeof GroupContextV2Class;
  GroupDetails: typeof GroupDetailsClass;
  NullMessage: typeof NullMessageClass;
  ReceiptMessage: typeof ReceiptMessageClass;
  SyncMessage: typeof SyncMessageClass;
  TypingMessage: typeof TypingMessageClass;
  Verified: typeof VerifiedClass;
};

type SignalStorageProtobufTypes = {
  AccountRecord: typeof AccountRecordClass;
  ContactRecord: typeof ContactRecordClass;
  GroupV1Record: typeof GroupV1RecordClass;
  GroupV2Record: typeof GroupV2RecordClass;
  ManifestRecord: typeof ManifestRecordClass;
  ReadOperation: typeof ReadOperationClass;
  StorageItem: typeof StorageItemClass;
  StorageItems: typeof StorageItemsClass;
  StorageManifest: typeof StorageManifestClass;
  StorageRecord: typeof StorageRecordClass;
  WriteOperation: typeof WriteOperationClass;
};

type SubProtocolProtobufTypes = {
  WebSocketMessage: typeof WebSocketMessageClass;
  WebSocketRequestMessage: typeof WebSocketRequestMessageClass;
  WebSocketResponseMessage: typeof WebSocketResponseMessageClass;
};

type UnidentifiedDeliveryTypes = {
  ServerCertificate: typeof ServerCertificateClass;
  SenderCertificate: typeof SenderCertificateClass;
  UnidentifiedSenderMessage: typeof UnidentifiedSenderMessageClass;
};

type ProtobufCollectionType = {
  onLoad: (callback: () => unknown) => void;
} & DeviceMessagesProtobufTypes &
  DeviceNameProtobufTypes &
  GroupsProtobufTypes &
  SignalServiceProtobufTypes &
  SignalStorageProtobufTypes &
  SubProtocolProtobufTypes &
  UnidentifiedDeliveryTypes;

// Note: there are a lot of places in the code that overwrite a field like this
//   with a type that the app can use. Being more rigorous with these
//   types would require code changes, out of scope for now.
export type ProtoBinaryType = any;
export type ProtoBigNumberType = any;

// Groups.proto

export declare class AvatarUploadAttributesClass {
  static decode: (
    data: ArrayBuffer | ByteBufferClass,
    encoding?: string
  ) => AvatarUploadAttributesClass;

  key?: string;
  credential?: string;
  acl?: string;
  algorithm?: string;
  date?: string;
  policy?: string;
  signature?: string;
}

export declare class MemberClass {
  static decode: (
    data: ArrayBuffer | ByteBufferClass,
    encoding?: string
  ) => MemberClass;

  userId?: ProtoBinaryType;
  role?: MemberRoleEnum;
  profileKey?: ProtoBinaryType;
  presentation?: ProtoBinaryType;
  joinedAtVersion?: number;

  // Note: only role and presentation are required when creating a group
}

export type MemberRoleEnum = number;

// Note: we need to use namespaces to express nested classes in Typescript
export declare namespace MemberClass {
  class Role {
    static UNKNOWN: number;
    static DEFAULT: number;
    static ADMINISTRATOR: number;
  }
}

export declare class MemberPendingProfileKeyClass {
  static decode: (
    data: ArrayBuffer | ByteBufferClass,
    encoding?: string
  ) => MemberPendingProfileKeyClass;

  member?: MemberClass;
  addedByUserId?: ProtoBinaryType;
  timestamp?: ProtoBigNumberType;
}

export declare class MemberPendingAdminApprovalClass {
  static decode: (
    data: ArrayBuffer | ByteBufferClass,
    encoding?: string
  ) => MemberPendingProfileKeyClass;

  userId?: ProtoBinaryType;
  profileKey?: ProtoBinaryType;
  presentation?: ProtoBinaryType;
  timestamp?: ProtoBigNumberType;
}

export declare class AccessControlClass {
  static decode: (
    data: ArrayBuffer | ByteBufferClass,
    encoding?: string
  ) => AccessControlClass;

  attributes?: AccessRequiredEnum;
  members?: AccessRequiredEnum;
  addFromInviteLink?: AccessRequiredEnum;
}

export type AccessRequiredEnum = number;

// Note: we need to use namespaces to express nested classes in Typescript
export declare namespace AccessControlClass {
  class AccessRequired {
    static UNKNOWN: number;
    static ANY: number;
    static MEMBER: number;
    static ADMINISTRATOR: number;
    static UNSATISFIABLE: number;
  }
}

export declare class GroupClass {
  static decode: (
    data: ArrayBuffer | ByteBufferClass,
    encoding?: string
  ) => GroupClass;
  toArrayBuffer: () => ArrayBuffer;

  publicKey?: ProtoBinaryType;
  title?: ProtoBinaryType;
  avatar?: string;
  disappearingMessagesTimer?: ProtoBinaryType;
  accessControl?: AccessControlClass;
  version?: number;
  members?: Array<MemberClass>;
  membersPendingProfileKey?: Array<MemberPendingProfileKeyClass>;
  membersPendingAdminApproval?: Array<MemberPendingAdminApprovalClass>;
  inviteLinkPassword?: ProtoBinaryType;
}

export declare class GroupChangeClass {
  static decode: (
    data: ArrayBuffer | ByteBufferClass,
    encoding?: string
  ) => GroupChangeClass;
  toArrayBuffer: () => ArrayBuffer;

  actions?: ProtoBinaryType;
  serverSignature?: ProtoBinaryType;
  changeEpoch?: number;
}

// Note: we need to use namespaces to express nested classes in Typescript
export declare namespace GroupChangeClass {
  class Actions {
    static decode: (
      data: ArrayBuffer | ByteBufferClass,
      encoding?: string
    ) => Actions;
    toArrayBuffer: () => ArrayBuffer;

    sourceUuid?: ProtoBinaryType;
    version?: number;
    addMembers?: Array<GroupChangeClass.Actions.AddMemberAction>;
    deleteMembers?: Array<GroupChangeClass.Actions.DeleteMemberAction>;
    modifyMemberRoles?: Array<GroupChangeClass.Actions.ModifyMemberRoleAction>;
    modifyMemberProfileKeys?: Array<
      GroupChangeClass.Actions.ModifyMemberProfileKeyAction
    >;
    addPendingMembers?: Array<
      GroupChangeClass.Actions.AddMemberPendingProfileKeyAction
    >;
    deletePendingMembers?: Array<
      GroupChangeClass.Actions.DeleteMemberPendingProfileKeyAction
    >;
    promotePendingMembers?: Array<
      GroupChangeClass.Actions.PromoteMemberPendingProfileKeyAction
    >;
    modifyTitle?: GroupChangeClass.Actions.ModifyTitleAction;
    modifyAvatar?: GroupChangeClass.Actions.ModifyAvatarAction;
    modifyDisappearingMessagesTimer?: GroupChangeClass.Actions.ModifyDisappearingMessagesTimerAction;
    modifyAttributesAccess?: GroupChangeClass.Actions.ModifyAttributesAccessControlAction;
    modifyMemberAccess?: GroupChangeClass.Actions.ModifyMembersAccessControlAction;
    modifyAddFromInviteLinkAccess?: GroupChangeClass.Actions.ModifyAddFromInviteLinkAccessControlAction;
    addMemberPendingAdminApprovals?: Array<
      GroupChangeClass.Actions.AddMemberPendingAdminApprovalAction
    >;
    deleteMemberPendingAdminApprovals?: Array<
      GroupChangeClass.Actions.DeleteMemberPendingAdminApprovalAction
    >;
    promoteMemberPendingAdminApprovals?: Array<
      GroupChangeClass.Actions.PromoteMemberPendingAdminApprovalAction
    >;
    modifyInviteLinkPassword?: GroupChangeClass.Actions.ModifyInviteLinkPasswordAction;
  }
}

// Note: we need to use namespaces to express nested classes in Typescript
export declare namespace GroupChangeClass.Actions {
  class AddMemberAction {
    added?: MemberClass;
    joinFromInviteLink?: boolean;
  }

  class DeleteMemberAction {
    deletedUserId?: ProtoBinaryType;
  }

  class ModifyMemberRoleAction {
    userId?: ProtoBinaryType;
    role?: MemberRoleEnum;
  }

  class ModifyMemberProfileKeyAction {
    presentation?: ProtoBinaryType;

    // The result of decryption
    profileKey: ArrayBuffer;
    uuid: string;
  }

  class AddMemberPendingProfileKeyAction {
    added?: MemberPendingProfileKeyClass;
  }

  class DeleteMemberPendingProfileKeyAction {
    deletedUserId?: ProtoBinaryType;
  }

  class PromoteMemberPendingProfileKeyAction {
    presentation?: ProtoBinaryType;

    // The result of decryption
    profileKey: ArrayBuffer;
    uuid: string;
  }

  class AddMemberPendingAdminApprovalAction {
    added?: MemberPendingAdminApprovalClass;
  }

  class DeleteMemberPendingAdminApprovalAction {
    deletedUserId?: ProtoBinaryType;
  }

  class PromoteMemberPendingAdminApprovalAction {
    userId?: ProtoBinaryType;
    role?: MemberRoleEnum;
  }

  class ModifyTitleAction {
    title?: ProtoBinaryType;
  }

  class ModifyAvatarAction {
    avatar?: string;
  }

  class ModifyDisappearingMessagesTimerAction {
    timer?: ProtoBinaryType;
  }

  class ModifyAttributesAccessControlAction {
    attributesAccess?: AccessRequiredEnum;
  }

  class ModifyMembersAccessControlAction {
    membersAccess?: AccessRequiredEnum;
  }

  class ModifyAddFromInviteLinkAccessControlAction {
    addFromInviteLinkAccess?: AccessRequiredEnum;
  }

  class ModifyInviteLinkPasswordAction {
    inviteLinkPassword?: ProtoBinaryType;
  }
}

export declare class GroupChangesClass {
  static decode: (
    data: ArrayBuffer | ByteBufferClass,
    encoding?: string
  ) => GroupChangesClass;

  groupChanges?: Array<GroupChangesClass.GroupChangeState>;
}

// Note: we need to use namespaces to express nested classes in Typescript
export declare namespace GroupChangesClass {
  class GroupChangeState {
    groupChange?: GroupChangeClass;
    groupState?: GroupClass;
  }
}

export declare class GroupAttributeBlobClass {
  static decode: (
    data: ArrayBuffer | ByteBufferClass,
    encoding?: string
  ) => GroupAttributeBlobClass;
  toArrayBuffer(): ArrayBuffer;

  title?: string;
  avatar?: ProtoBinaryType;
  disappearingMessagesDuration?: number;

  // Note: this isn't part of the proto, but our protobuf library tells us which
  //   field has been set with this prop.
  content: 'title' | 'avatar' | 'disappearingMessagesDuration';
}

export declare class GroupExternalCredentialClass {
  static decode: (
    data: ArrayBuffer | ByteBufferClass,
    encoding?: string
  ) => GroupExternalCredentialClass;

  token?: string;
}

export declare class GroupInviteLinkClass {
  static decode: (
    data: ArrayBuffer | ByteBufferClass,
    encoding?: string
  ) => GroupInviteLinkClass;
  toArrayBuffer: () => ArrayBuffer;

  v1Contents?: GroupInviteLinkClass.GroupInviteLinkContentsV1;

  // Note: this isn't part of the proto, but our protobuf library tells us which
  //   field has been set with this prop.
  contents?: 'v1Contents';
}

export declare namespace GroupInviteLinkClass {
  class GroupInviteLinkContentsV1 {
    groupMasterKey?: ProtoBinaryType;
    inviteLinkPassword?: ProtoBinaryType;
  }
}

export declare class GroupJoinInfoClass {
  static decode: (
    data: ArrayBuffer | ByteBufferClass,
    encoding?: string
  ) => GroupJoinInfoClass;

  publicKey?: ProtoBinaryType;
  title?: ProtoBinaryType;
  avatar?: string;
  memberCount?: number;
  addFromInviteLink?: AccessControlClass.AccessRequired;
  version?: number;
  pendingAdminApproval?: boolean;
}

// Previous protos

export declare class AttachmentPointerClass {
  static decode: (
    data: ArrayBuffer | ByteBufferClass,
    encoding?: string
  ) => AttachmentPointerClass;

  static Flags: {
    VOICE_MESSAGE: number;
    BORDERLESS: number;
    GIF: number;
  };

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
  bodyRanges?: Array<DataMessageClass.BodyRange>;
  groupCallUpdate?: DataMessageClass.GroupCallUpdate;
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
    static MENTIONS: number;
    static CURRENT: number;
  }

  // Note: deep nesting
  class Quote {
    id: ProtoBigNumberType | null;
    author: string | null;
    authorUuid: string | null;
    text: string | null;
    attachments?: Array<DataMessageClass.Quote.QuotedAttachment>;
    bodyRanges?: Array<DataMessageClass.BodyRange>;
  }

  class BodyRange {
    start?: number;
    length?: number;
    mentionUuid?: string;
  }

  class Reaction {
    emoji: string | null;
    remove: boolean;
    targetAuthorUuid: string | null;
    targetTimestamp: ProtoBigNumberType | null;
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

  class GroupCallUpdate {
    eraId?: string;
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
  receivedAtCounter: number;
  receivedAtDate: number;
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

  // Note: these additional properties are added in the course of processing
  derivedGroupV2Id?: string;
}

export declare class GroupContextV2Class {
  static decode: (
    data: ArrayBuffer | ByteBufferClass,
    encoding?: string
  ) => GroupContextV2Class;

  masterKey?: ProtoBinaryType;
  revision?: number;
  groupChange?: ProtoBinaryType;

  // Note: these additional properties are added in the course of processing
  id?: string;
  secretParams?: string;
  publicParams?: string;
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

export declare class ManifestRecordIdentifierClass {
  static Type: typeof ManifestType;
  raw: ProtoBinaryType;
  type: ManifestType;
  toArrayBuffer: () => ArrayBuffer;
}

export declare class ManifestRecordClass {
  static decode: (
    data: ArrayBuffer | ByteBufferClass,
    encoding?: string
  ) => ManifestRecordClass;
  toArrayBuffer: () => ArrayBuffer;
  static Identifier: typeof ManifestRecordIdentifierClass;

  version: ProtoBigNumberType;
  keys: ManifestRecordIdentifierClass[];
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

export declare class ProvisionEnvelopeClass {
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

export declare class StorageManifestClass {
  static decode: (
    data: ArrayBuffer | ByteBufferClass,
    encoding?: string
  ) => StorageManifestClass;

  version?: ProtoBigNumberType | null;
  value?: ProtoBinaryType;
}

export declare class StorageRecordClass {
  static decode: (
    data: ArrayBuffer | ByteBufferClass,
    encoding?: string
  ) => StorageRecordClass;
  toArrayBuffer: () => ArrayBuffer;

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

  key?: ProtoBinaryType;
  value?: ProtoBinaryType;
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
  toArrayBuffer: () => ArrayBuffer;

  serviceUuid?: string | null;
  serviceE164?: string | null;
  profileKey?: ProtoBinaryType;
  identityKey?: ProtoBinaryType;
  identityState?: ContactRecordIdentityState | null;
  givenName?: string | null;
  familyName?: string | null;
  username?: string | null;
  blocked?: boolean | null;
  whitelisted?: boolean | null;
  archived?: boolean | null;
  markedUnread?: boolean;

  __unknownFields?: ArrayBuffer;
}

export declare class GroupV1RecordClass {
  static decode: (
    data: ArrayBuffer | ByteBufferClass,
    encoding?: string
  ) => GroupV1RecordClass;
  toArrayBuffer: () => ArrayBuffer;

  id?: ProtoBinaryType;
  blocked?: boolean | null;
  whitelisted?: boolean | null;
  archived?: boolean | null;
  markedUnread?: boolean;

  __unknownFields?: ArrayBuffer;
}

export declare class GroupV2RecordClass {
  static decode: (
    data: ArrayBuffer | ByteBufferClass,
    encoding?: string
  ) => GroupV2RecordClass;
  toArrayBuffer: () => ArrayBuffer;

  masterKey?: ProtoBinaryType | null;
  blocked?: boolean | null;
  whitelisted?: boolean | null;
  archived?: boolean | null;
  markedUnread?: boolean;

  __unknownFields?: ArrayBuffer;
}

export declare class PinnedConversationClass {
  toArrayBuffer: () => ArrayBuffer;

  // identifier is produced by the oneof field in the PinnedConversation protobuf
  // and determined which one of the following optional fields are in use
  identifier: 'contact' | 'legacyGroupId' | 'groupMasterKey';
  contact?: {
    uuid?: string;
    e164?: string;
  };
  legacyGroupId?: ProtoBinaryType;
  groupMasterKey?: ProtoBinaryType;
}

declare enum AccountRecordPhoneNumberSharingMode {
  EVERYBODY = 0,
  CONTACTS_ONLY = 1,
  NOBODY = 2,
}

export declare class AccountRecordClass {
  static PhoneNumberSharingMode: typeof AccountRecordPhoneNumberSharingMode;
  static PinnedConversation: typeof PinnedConversationClass;

  static decode: (
    data: ArrayBuffer | ByteBufferClass,
    encoding?: string
  ) => AccountRecordClass;
  toArrayBuffer: () => ArrayBuffer;

  profileKey?: ProtoBinaryType;
  givenName?: string | null;
  familyName?: string | null;
  avatarUrl?: string | null;
  noteToSelfArchived?: boolean | null;
  readReceipts?: boolean | null;
  sealedSenderIndicators?: boolean | null;
  typingIndicators?: boolean | null;
  linkPreviews?: boolean | null;
  phoneNumberSharingMode?: AccountRecordPhoneNumberSharingMode;
  notDiscoverableByPhoneNumber?: boolean;
  pinnedConversations?: PinnedConversationClass[];
  noteToSelfMarkedUnread?: boolean;

  __unknownFields?: ArrayBuffer;
}

declare class ReadOperationClass {
  static decode: (
    data: ArrayBuffer | ByteBufferClass,
    encoding?: string
  ) => ReadOperationClass;

  readKey: ArrayBuffer[] | ByteBufferClass[];
  toArrayBuffer: () => ArrayBuffer;
}

declare class WriteOperationClass {
  static decode: (
    data: ArrayBuffer | ByteBufferClass,
    encoding?: string
  ) => WriteOperationClass;
  toArrayBuffer: () => ArrayBuffer;

  manifest: StorageManifestClass;
  insertItem: StorageItemClass[];
  deleteKey: ArrayBuffer[] | ByteBufferClass[];
  clearAll: boolean;
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
    provisioningVersion?: number;
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
    sender: string | null;
    senderUuid: string | null;
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
    static Type: {
      UNKNOWN: number;
      LOCAL_PROFILE: number;
      STORAGE_MANIFEST: number;
    };
    type?: number;
  }
  class Keys {
    storageService?: ByteBufferClass;
  }

  class MessageRequestResponse {
    threadE164: string | null;
    threadUuid: string | null;
    groupId: ProtoBinaryType | null;
    type: number | null;
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
  static State: WhatIsThis;

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

export { CallingMessageClass };

// UnidentifiedDelivery.proto

export declare class ServerCertificateClass {
  static decode: (
    data: ArrayBuffer | ByteBufferClass,
    encoding?: string
  ) => ServerCertificateClass;
  toArrayBuffer: () => ArrayBuffer;

  certificate?: ProtoBinaryType;
  signature?: ProtoBinaryType;
}

export declare namespace ServerCertificateClass {
  class Certificate {
    static decode: (
      data: ArrayBuffer | ByteBufferClass,
      encoding?: string
    ) => Certificate;
    toArrayBuffer: () => ArrayBuffer;

    id?: number;
    key?: ProtoBinaryType;
  }
}

export declare class SenderCertificateClass {
  static decode: (
    data: ArrayBuffer | ByteBufferClass,
    encoding?: string
  ) => SenderCertificateClass;
  toArrayBuffer: () => ArrayBuffer;

  certificate?: ProtoBinaryType;
  signature?: ProtoBinaryType;
}

export declare namespace SenderCertificateClass {
  class Certificate {
    static decode: (
      data: ArrayBuffer | ByteBufferClass,
      encoding?: string
    ) => Certificate;
    toArrayBuffer: () => ArrayBuffer;

    sender?: string;
    senderUuid?: string;
    senderDevice?: number;
    expires?: ProtoBigNumberType;
    identityKey?: ProtoBinaryType;
    signer?: SenderCertificateClass;
  }
}

export declare class UnidentifiedSenderMessageClass {
  static decode: (
    data: ArrayBuffer | ByteBufferClass,
    encoding?: string
  ) => UnidentifiedSenderMessageClass;
  toArrayBuffer: () => ArrayBuffer;

  ephemeralPublic?: ProtoBinaryType;
  encryptedStatic?: ProtoBinaryType;
  encryptedMessage?: ProtoBinaryType;
}

export declare namespace UnidentifiedSenderMessageClass {
  class Message {
    static decode: (
      data: ArrayBuffer | ByteBufferClass,
      encoding?: string
    ) => Message;
    toArrayBuffer: () => ArrayBuffer;

    type?: number;
    senderCertificate?: SenderCertificateClass;
    content?: ProtoBinaryType;
  }
}

export declare namespace UnidentifiedSenderMessageClass.Message {
  class Type {
    static PREKEY_MESSAGE: number;
    static MESSAGE: number;
  }
}
