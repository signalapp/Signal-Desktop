// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { SignalService as Proto } from '../protobuf';

export {
  IdentityKeyType,
  PreKeyType,
  SenderKeyType,
  SessionType,
  SignedPreKeyType,
  UnprocessedType,
  UnprocessedUpdateType,
} from '../sql/Interface';

export type StorageServiceCallOptionsType = {
  credentials?: StorageServiceCredentials;
  greaterThanVersion?: number;
};

export type StorageServiceCredentials = {
  username: string;
  password: string;
};

export type DeviceType = {
  id: number;
  identifier: string;
};

// How the legacy APIs generate these types

export type CompatSignedPreKeyType = {
  keyId: number;
  keyPair: KeyPairType;
  signature: ArrayBuffer;
};

export type CompatPreKeyType = {
  keyId: number;
  keyPair: KeyPairType;
};

// How we work with these types thereafter

export type KeyPairType = {
  privKey: ArrayBuffer;
  pubKey: ArrayBuffer;
};

export type OuterSignedPrekeyType = {
  confirmed: boolean;
  // eslint-disable-next-line camelcase
  created_at: number;
  keyId: number;
  privKey: ArrayBuffer;
  pubKey: ArrayBuffer;
};

export type SessionResetsType = Record<string, number>;

export type ProcessedEnvelope = Readonly<{
  id: string;
  receivedAtCounter: number;
  receivedAtDate: number;
  messageAgeSec: number;

  // Mostly from Proto.Envelope except for null/undefined
  type: Proto.Envelope.Type;
  source?: string;
  sourceUuid?: string;
  sourceDevice?: number;
  timestamp: number;
  legacyMessage?: Uint8Array;
  content?: Uint8Array;
  serverGuid: string;
  serverTimestamp: number;
  groupId?: string;
}>;

export type ProcessedAttachment = {
  cdnId?: string;
  cdnKey?: string;
  digest?: string;
  contentType?: string;
  key?: string;
  size?: number;
  fileName?: string;
  flags?: number;
  width?: number;
  height?: number;
  caption?: string;
  blurHash?: string;
  cdnNumber?: number;
};

export type ProcessedGroupContext = {
  id: string;
  type: Proto.GroupContext.Type;
  name?: string;
  membersE164: ReadonlyArray<string>;
  avatar?: ProcessedAttachment;

  // Computed fields
  derivedGroupV2Id: string;
};

export type ProcessedGroupV2Context = {
  masterKey: string;
  revision?: number;
  groupChange?: string;

  // Computed fields
  id: string;
  secretParams: string;
  publicParams: string;
};

export type ProcessedQuoteAttachment = {
  contentType?: string;
  fileName?: string;
  thumbnail?: ProcessedAttachment;
};

export type ProcessedQuote = {
  id?: number;
  authorUuid?: string;
  text?: string;
  attachments: ReadonlyArray<ProcessedQuoteAttachment>;
  bodyRanges: ReadonlyArray<Proto.DataMessage.IBodyRange>;
};

export type ProcessedAvatar = {
  avatar?: ProcessedAttachment;
  isProfile: boolean;
};

export type ProcessedContact = Omit<Proto.DataMessage.IContact, 'avatar'> & {
  avatar?: ProcessedAvatar;
};

export type ProcessedPreview = {
  url?: string;
  title?: string;
  image?: ProcessedAttachment;
  description?: string;
  date?: number;
};

export type ProcessedSticker = {
  packId?: string;
  packKey?: string;
  stickerId?: number;
  data?: ProcessedAttachment;
};

export type ProcessedReaction = {
  emoji?: string;
  remove: boolean;
  targetAuthorUuid?: string;
  targetTimestamp?: number;
};

export type ProcessedDelete = {
  targetSentTimestamp?: number;
};

export type ProcessedBodyRange = Proto.DataMessage.IBodyRange;

export type ProcessedGroupCallUpdate = Proto.DataMessage.IGroupCallUpdate;

export type ProcessedDataMessage = {
  body?: string;
  attachments: ReadonlyArray<ProcessedAttachment>;
  group?: ProcessedGroupContext;
  groupV2?: ProcessedGroupV2Context;
  flags: number;
  expireTimer: number;
  profileKey?: string;
  timestamp: number;
  quote?: ProcessedQuote;
  contact?: ReadonlyArray<ProcessedContact>;
  preview?: ReadonlyArray<ProcessedPreview>;
  sticker?: ProcessedSticker;
  requiredProtocolVersion?: number;
  isViewOnce: boolean;
  reaction?: ProcessedReaction;
  delete?: ProcessedDelete;
  bodyRanges?: ReadonlyArray<ProcessedBodyRange>;
  groupCallUpdate?: ProcessedGroupCallUpdate;
};

export type ProcessedUnidentifiedDeliveryStatus = Omit<
  Proto.SyncMessage.Sent.IUnidentifiedDeliveryStatus,
  'destinationUuid'
> & {
  destinationUuid?: string;
};

export type ProcessedSent = Omit<
  Proto.SyncMessage.ISent,
  'destinationId' | 'unidentifiedStatus'
> & {
  destinationId?: string;
  unidentifiedStatus?: Array<ProcessedUnidentifiedDeliveryStatus>;
};

export type ProcessedSyncMessage = Omit<Proto.ISyncMessage, 'sent'> & {
  sent?: ProcessedSent;
};

export type CustomError = Error & {
  identifier?: string;
  number?: string;
};

export interface CallbackResultType {
  successfulIdentifiers?: Array<string>;
  failoverIdentifiers?: Array<string>;
  errors?: Array<CustomError>;
  unidentifiedDeliveries?: Array<string>;
  dataMessage?: ArrayBuffer;

  // Fields necesary for send log save
  contentHint?: number;
  contentProto?: Uint8Array;
  timestamp?: number;
  recipients?: Record<string, Array<number>>;
}
