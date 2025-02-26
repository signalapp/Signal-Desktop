// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { SignalService as Proto } from '../protobuf';
import type { IncomingWebSocketRequest } from './WebsocketResources';
import type { ServiceIdString, AciString, PniString } from '../types/ServiceId';
import type { AttachmentType, TextAttachmentType } from '../types/Attachment';
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
  serviceId: ServiceIdString;
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
  source: string | undefined;
  sourceServiceId: ServiceIdString | undefined;
  sourceDevice: number | Undefined;
  destinationServiceId: ServiceIdString;
  updatedPni: PniString | undefined;
  timestamp: number;
  content: Uint8Array;
  serverGuid: string;
  serverTimestamp: number;
  groupId: string | undefined;
  urgent: boolean;
  story: boolean;
  reportingToken: Uint8Array | undefined;
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
  backupLocator?: AttachmentType['backupLocator'];
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
  targetAuthorAci?: AciString;
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
  destinationServiceId?: ServiceIdString;
  isAllowedToReplyToStory?: boolean;
};

export type ProcessedStoryMessageRecipient = Omit<
  Proto.SyncMessage.Sent.IStoryMessageRecipient,
  'destinationAci' | 'destinationPni'
> & {
  destinationServiceId?: ServiceIdString;
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
  destinationServiceId?: ServiceIdString;
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
  successfulServiceIds?: Array<ServiceIdString>;
  failoverServiceIds?: Array<ServiceIdString>;
  errors?: Array<CustomError>;
  unidentifiedDeliveries?: Array<ServiceIdString>;
  dataMessage: Uint8Array | undefined;
  editMessage: Uint8Array | undefined;

  // If this send is not the final step in a multi-step send, we shouldn't treat its
  //   results we would treat a one-step send.
  sendIsNotFinal?: boolean;

  // Fields necessary for send log save
  contentHint?: number;
  contentProto?: Uint8Array;
  timestamp?: number;
  recipients?: Record<ServiceIdString, Array<number>>;
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
  pni: PniString;
  signature: Uint8Array;
}>;
