// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { SignalService as Proto } from '../protobuf';
import type { IncomingWebSocketRequest } from './WebsocketResources';
import type { UUID, UUIDStringType, TaggedUUIDStringType } from '../types/UUID';
import type { TextAttachmentType } from '../types/Attachment';
import type { GiftBadgeStates } from '../components/conversation/Message';
import type { MIMEType } from '../types/MIME';
import type { DurationInSeconds } from '../util/durations';
import type { AnyPaymentEvent } from '../types/Payment';
import type { RawBodyRange } from '../types/BodyRange';

export {
  IdentityKeyType,
  IdentityKeyIdType,
  KyberPreKeyType,
  PreKeyIdType,
  PreKeyType,
  SenderKeyIdType,
  SenderKeyType,
  SessionIdType,
  SessionType,
  SignedPreKeyIdType,
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

export type WebAPICredentials = {
  username: string;
  password: string;
};

export type DeviceType = {
  id: number;
  identifier: string;
  registrationId: number;
};

// How the legacy APIs generate these types

export type CompatSignedPreKeyType = {
  keyId: number;
  keyPair: KeyPairType;
  signature: Uint8Array;
};

export type CompatPreKeyType = {
  keyId: number;
  keyPair: KeyPairType;
};

// How we work with these types thereafter

export type KeyPairType = {
  privKey: Uint8Array;
  pubKey: Uint8Array;
};

export type OuterSignedPrekeyType = {
  confirmed: boolean;

  created_at: number;
  keyId: number;
  privKey: Uint8Array;
  pubKey: Uint8Array;
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
  sourceUuid?: UUIDStringType;
  sourceDevice?: number;
  destinationUuid: UUID;
  updatedPni?: UUID;
  timestamp: number;
  content?: Uint8Array;
  serverGuid: string;
  serverTimestamp: number;
  groupId?: string;
  urgent?: boolean;
  story?: boolean;
  reportingToken?: Uint8Array;
}>;

export type ProcessedAttachment = {
  cdnId?: string;
  cdnKey?: string;
  digest?: string;
  contentType: MIMEType;
  key?: string;
  size: number;
  fileName?: string;
  flags?: number;
  width?: number;
  height?: number;
  caption?: string;
  blurHash?: string;
  cdnNumber?: number;
  textAttachment?: Omit<TextAttachmentType, 'preview'>;
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
  bodyRanges?: ReadonlyArray<ProcessedBodyRange>;
  type: Proto.DataMessage.Quote.Type;
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
  emoji?: string;
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

export type ProcessedBodyRange = RawBodyRange;

export type ProcessedGroupCallUpdate = Proto.DataMessage.IGroupCallUpdate;

export type ProcessedStoryContext = Proto.DataMessage.IStoryContext;

export type ProcessedGiftBadge = {
  expiration: number;
  id: string | undefined;
  level: number;
  receiptCredentialPresentation: string;
  state: GiftBadgeStates;
};

export type ProcessedDataMessage = {
  body?: string;
  attachments: ReadonlyArray<ProcessedAttachment>;
  groupV2?: ProcessedGroupV2Context;
  flags: number;
  expireTimer: DurationInSeconds;
  profileKey?: string;
  timestamp: number;
  payment?: AnyPaymentEvent;
  quote?: ProcessedQuote;
  contact?: ReadonlyArray<ProcessedContact>;
  preview?: ReadonlyArray<ProcessedPreview>;
  sticker?: ProcessedSticker;
  requiredProtocolVersion?: number;
  editedMessageTimestamp?: number;
  isStory?: boolean;
  isViewOnce: boolean;
  reaction?: ProcessedReaction;
  delete?: ProcessedDelete;
  bodyRanges?: ReadonlyArray<ProcessedBodyRange>;
  groupCallUpdate?: ProcessedGroupCallUpdate;
  storyContext?: ProcessedStoryContext;
  giftBadge?: ProcessedGiftBadge;
  canReplyToStory?: boolean;
};

export type ProcessedUnidentifiedDeliveryStatus = Omit<
  Proto.SyncMessage.Sent.IUnidentifiedDeliveryStatus,
  'destinationAci' | 'destinationPni'
> & {
  destinationUuid?: TaggedUUIDStringType;
  isAllowedToReplyToStory?: boolean;
};

export type ProcessedStoryMessageRecipient = Omit<
  Proto.SyncMessage.Sent.IStoryMessageRecipient,
  'destinationAci' | 'destinationPni'
> & {
  destinationUuid?: TaggedUUIDStringType;
};

export type ProcessedSent = Omit<
  Proto.SyncMessage.ISent,
  | 'destinationId'
  | 'unidentifiedStatus'
  | 'storyMessageRecipients'
  | 'destinationAci'
  | 'destinationPni'
> & {
  destinationId?: string;
  destinationUuid?: TaggedUUIDStringType;
  unidentifiedStatus?: Array<ProcessedUnidentifiedDeliveryStatus>;
  storyMessageRecipients?: Array<ProcessedStoryMessageRecipient>;
};

export type ProcessedSyncMessage = Omit<Proto.ISyncMessage, 'sent'> & {
  sent?: ProcessedSent;
};

export type CustomError = Error & {
  identifier?: string;
  number?: string;
};

export type CallbackResultType = {
  successfulIdentifiers?: Array<string>;
  failoverIdentifiers?: Array<string>;
  errors?: Array<CustomError>;
  unidentifiedDeliveries?: Array<string>;
  dataMessage: Uint8Array | undefined;
  editMessage: Uint8Array | undefined;

  // If this send is not the final step in a multi-step send, we shouldn't treat its
  //   results we would treat a one-step send.
  sendIsNotFinal?: boolean;

  // Fields necessary for send log save
  contentHint?: number;
  contentProto?: Uint8Array;
  timestamp?: number;
  recipients?: Record<string, Array<number>>;
  urgent?: boolean;
  hasPniSignatureMessage?: boolean;
};

export type IRequestHandler = {
  handleRequest(request: IncomingWebSocketRequest): void;
};

export type PniKeyMaterialType = Readonly<{
  identityKeyPair: Uint8Array;
  signedPreKey: Uint8Array;
  lastResortKyberPreKey?: Uint8Array;
  registrationId: number;
}>;

export type PniSignatureMessageType = Readonly<{
  pni: UUIDStringType;
  signature: Uint8Array;
}>;
