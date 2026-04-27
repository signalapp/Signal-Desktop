// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type * as client from '@signalapp/libsignal-client';

import type { SignalService as Proto } from '../protobuf/index.std.ts';
import type { IncomingWebSocketRequest } from './WebsocketResources.preload.ts';
import type {
  ServiceIdString,
  AciString,
  PniString,
} from '../types/ServiceId.std.ts';
import type { TextAttachmentType } from '../types/Attachment.std.ts';
import type { GiftBadgeStates } from '../types/GiftBadgeStates.std.ts';
import type { MIMEType } from '../types/MIME.std.ts';
import type { DurationInSeconds } from '../util/durations/index.std.ts';
import type { AnyPaymentEvent } from '../types/Payment.std.ts';
import type { RawBodyRange } from '../types/BodyRange.std.ts';
import type { StoryMessageRecipientsType } from '../types/Stories.std.ts';

export type {
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
} from '../sql/Interface.std.ts';

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
  serviceId: ServiceIdString;
  registrationId: number;
};

// How the legacy APIs generate these types

export type CompatSignedPreKeyType = {
  keyId: number;
  keyPair: KeyPairType;
  signature: Uint8Array<ArrayBuffer>;
};

export type CompatPreKeyType = {
  keyId: number;
  keyPair: KeyPairType;
};

// How we work with these types thereafter

export type KeyPairType = client.IdentityKeyPair;

export type OuterSignedPrekeyType = {
  confirmed: boolean;

  created_at: number;
  keyId: number;
  privKey: Uint8Array<ArrayBuffer>;
  pubKey: Uint8Array<ArrayBuffer>;
};

export type SessionResetsType = Record<string, number>;

export type ProcessedEnvelope = Readonly<{
  id: string;
  receivedAtCounter: number;
  receivedAtDate: number;
  messageAgeSec: number;

  // Mostly from Proto.Envelope except for null/undefined
  type: Proto.Envelope.Type;
  source: string | undefined;
  sourceServiceId: ServiceIdString | undefined;
  sourceDevice: number | undefined;
  destinationServiceId: ServiceIdString;
  updatedPni: PniString | undefined;
  timestamp: number;
  content: Uint8Array<ArrayBuffer>;
  serverGuid: string;
  serverTimestamp: number;
  groupId: string | undefined;
  urgent: boolean;
  story: boolean;
  reportingToken: Uint8Array<ArrayBuffer> | undefined;
  groupId: string | undefined;
}>;

export type ProcessedAttachment = {
  cdnId?: string;
  cdnKey?: string;
  contentType: MIMEType;
  clientUuid?: string;
  digest?: string;
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
  uploadTimestamp?: number;
  downloadPath?: string;
  incrementalMac?: string;
  chunkSize?: number;
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
  contentType: MIMEType;
  fileName?: string;
  thumbnail?: ProcessedAttachment;
};

export type ProcessedQuote = {
  id?: number;
  authorAci?: AciString;
  text?: string;
  attachments: ReadonlyArray<ProcessedQuoteAttachment>;
  bodyRanges?: ReadonlyArray<ProcessedBodyRange>;
  type: Proto.DataMessage.Quote.Type;
};

export type ProcessedAvatar = {
  avatar?: ProcessedAttachment;
  isProfile: boolean;
};

export type ProcessedContact = Omit<Proto.DataMessage.Contact, 'avatar'> & {
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
  targetAuthorAci?: AciString;
  targetTimestamp?: number;
};

export type ProcessedPinMessage = Readonly<{
  targetAuthorAci: AciString;
  targetSentTimestamp: number;
  pinDuration: DurationInSeconds | null;
}>;

export type ProcessedPollCreate = {
  question?: string;
  options?: Array<string>;
  allowMultiple?: boolean;
};

export type ProcessedPollVote = {
  targetAuthorAci?: AciString;
  targetTimestamp?: number;
  optionIndexes?: Array<number>;
  voteCount?: number;
};

export type ProcessedPollTerminate = {
  targetTimestamp?: number;
};

export type ProcessedDelete = {
  targetSentTimestamp?: number;
};

export type ProcessedAdminDelete = Readonly<{
  targetSentTimestamp: number;
  targetAuthorAci: AciString;
}>;

export type ProcessedBodyRange = RawBodyRange;

export type ProcessedGroupCallUpdate = Proto.DataMessage.GroupCallUpdate;

export type ProcessedGiftBadge = {
  expiration: number;
  id: string | undefined;
  level: number;
  receiptCredentialPresentation: string;
  state: GiftBadgeStates;
};

export type ProcessedUnpinMessage = Readonly<{
  targetAuthorAci: AciString;
  targetSentTimestamp: number;
}>;

export type ProcessedStoryContext = {
  authorAci: AciString | undefined;
  sentTimestamp: number;
};

export type ProcessedDataMessage = {
  body?: string;
  bodyAttachment?: ProcessedAttachment;
  attachments: ReadonlyArray<ProcessedAttachment>;
  groupV2?: ProcessedGroupV2Context;
  flags: number;
  expireTimer: DurationInSeconds;
  expireTimerVersion: number;
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
  pinMessage?: ProcessedPinMessage;
  pollCreate?: ProcessedPollCreate;
  pollVote?: ProcessedPollVote;
  pollTerminate?: ProcessedPollTerminate;
  delete?: ProcessedDelete;
  adminDelete?: ProcessedAdminDelete;
  bodyRanges?: ReadonlyArray<ProcessedBodyRange>;
  groupCallUpdate?: ProcessedGroupCallUpdate;
  storyContext?: ProcessedStoryContext;
  giftBadge?: ProcessedGiftBadge;
  unpinMessage?: ProcessedUnpinMessage;
  canReplyToStory?: boolean;
};

export type ProcessedUnidentifiedDeliveryStatus = Readonly<{
  destinationServiceId?: ServiceIdString;
  isAllowedToReplyToStory?: boolean;
  destinationPniIdentityKey?: Uint8Array<ArrayBuffer>;
  unidentified?: boolean;
}>;

export type ProcessedSent = Omit<
  Proto.SyncMessage.Sent,
  | '$unknown'
  | 'destinationId'
  | 'unidentifiedStatus'
  | 'storyMessageRecipients'
  | 'destinationServiceId'
  | 'destinationServiceIdBinary'
> & {
  destinationId?: string;
  destinationServiceId?: ServiceIdString;
  unidentifiedStatus?: Array<ProcessedUnidentifiedDeliveryStatus>;
  storyMessageRecipients?: StoryMessageRecipientsType;
};

export type CustomError = Error & {
  identifier?: string;
  number?: string;
};

export type CallbackResultType = {
  successfulServiceIds?: Array<ServiceIdString>;
  failoverServiceIds?: Array<ServiceIdString>;
  errors?: Array<CustomError>;
  unidentifiedDeliveries?: Array<ServiceIdString>;
  dataMessage: Uint8Array<ArrayBuffer> | undefined;
  editMessage: Uint8Array<ArrayBuffer> | undefined;

  // If this send is not the final step in a multi-step send, we shouldn't treat its
  //   results we would treat a one-step send.
  sendIsNotFinal?: boolean;

  // Fields necessary for send log save
  contentHint?: number;
  contentProto?: Uint8Array<ArrayBuffer>;
  timestamp?: number;
  recipients?: Record<ServiceIdString, Array<number>>;
  urgent?: boolean;
  hasPniSignatureMessage?: boolean;
};

export type IRequestHandler = {
  handleRequest(request: IncomingWebSocketRequest): void;
  handleDisconnect(): void;
};

export type PniKeyMaterialType = Readonly<{
  identityKeyPair: Uint8Array<ArrayBuffer>;
  signedPreKey: Uint8Array<ArrayBuffer>;
  lastResortKyberPreKey?: Uint8Array<ArrayBuffer>;
  registrationId: number;
}>;

export type PniSignatureMessageType = Readonly<{
  pni: PniString;
  signature: Uint8Array<ArrayBuffer>;
}>;
