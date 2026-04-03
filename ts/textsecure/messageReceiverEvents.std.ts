// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { PublicKey } from '@signalapp/libsignal-client';
import { z } from 'zod';

import type { SignalService as Proto } from '../protobuf/index.std.ts';
import {
  type ServiceIdString,
  type AciString,
  isPniString,
} from '../types/ServiceId.std.ts';
import type { StoryDistributionIdString } from '../types/StoryDistributionId.std.ts';
import type { StoryMessageRecipientsType } from '../types/Stories.std.ts';
import type {
  ProcessedEnvelope,
  ProcessedDataMessage,
  ProcessedSent,
  ProcessedAttachment,
} from './Types.d.ts';
import type {
  CallEventDetails,
  CallLogEventDetails,
} from '../types/CallDisposition.std.ts';
import type { CallLinkUpdateSyncType } from '../types/CallLink.std.ts';
import { isAciString } from '../util/isAciString.std.ts';

export class EmptyEvent extends Event {
  constructor() {
    super('empty');
  }
}

export type TypingEventData = Readonly<{
  typingMessage: Proto.TypingMessage;
  timestamp: number;
  started: boolean;
  stopped: boolean;
  groupId?: string;
  groupV2Id?: string;
}>;

export type TypingEventConfig = {
  sender?: string;
  senderAci?: AciString;
  senderDevice: number;
  typing: TypingEventData;
};

// oxlint-disable-next-line max-classes-per-file
export class TypingEvent extends Event {
  public readonly sender?: string;
  public readonly senderAci?: AciString;
  public readonly senderDevice: number;
  public readonly typing: TypingEventData;

  constructor({ sender, senderAci, senderDevice, typing }: TypingEventConfig) {
    super('typing');
    this.sender = sender;
    this.senderAci = senderAci;
    this.senderDevice = senderDevice;
    this.typing = typing;
  }
}

export class ErrorEvent extends Event {
  public readonly error: Error;

  constructor(error: Error) {
    super('error');
    this.error = error;
  }
}

export class ContactSyncEvent extends Event {
  public readonly contactAttachment: ProcessedAttachment;
  public readonly complete: boolean;
  public readonly receivedAtCounter: number;
  public readonly sentAt: number;

  constructor(
    contactAttachment: ProcessedAttachment,
    complete: boolean,
    receivedAtCounter: number,
    sentAt: number
  ) {
    super('contactSync');
    this.contactAttachment = contactAttachment;
    this.complete = complete;
    this.receivedAtCounter = receivedAtCounter;
    this.sentAt = sentAt;
  }
}

// Emitted right before we do full decrypt on a message, but after Sealed Sender unseal
export class EnvelopeUnsealedEvent extends Event {
  public readonly envelope: ProcessedEnvelope;

  constructor(envelope: ProcessedEnvelope) {
    super('envelopeUnsealed');
    this.envelope = envelope;
  }
}

export class EnvelopeQueuedEvent extends Event {
  public readonly envelope: ProcessedEnvelope;

  constructor(envelope: ProcessedEnvelope) {
    super('envelopeQueued');
    this.envelope = envelope;
  }
}

//
// Confirmable events below
//

export type ConfirmCallback = () => void;

export class ConfirmableEvent extends Event {
  public readonly confirm: ConfirmCallback;

  constructor(type: string, confirm: ConfirmCallback) {
    super(type);
    this.confirm = confirm;
  }
}

export type DeliveryEventData = Readonly<{
  timestamp: number;
  source?: string;
  sourceServiceId?: ServiceIdString;
  sourceDevice?: number;
  wasSentEncrypted: boolean;
}>;

export class DeliveryEvent extends ConfirmableEvent {
  public readonly deliveryReceipts: ReadonlyArray<DeliveryEventData>;
  public readonly envelopeId: string;
  public readonly envelopeTimestamp: number;

  constructor(
    deliveryReceipts: ReadonlyArray<DeliveryEventData>,
    envelopeId: string,
    envelopeTimestamp: number,
    confirm: ConfirmCallback
  ) {
    super('delivery', confirm);
    this.deliveryReceipts = deliveryReceipts;
    this.envelopeId = envelopeId;
    this.envelopeTimestamp = envelopeTimestamp;
  }
}

export type SuccessfulDecryptEventData = Readonly<{
  senderDevice: number;
  senderAci: AciString;
  timestamp: number;
}>;

export class SuccessfulDecryptEvent extends Event {
  public readonly data: SuccessfulDecryptEventData;

  constructor(data: SuccessfulDecryptEventData) {
    super('successful-decrypt');
    this.data = data;
  }
}

export type DecryptionErrorEventData = Readonly<{
  cipherTextBytes: Uint8Array<ArrayBuffer> | undefined;
  cipherTextType: number | undefined;
  contentHint: number | undefined;
  groupId: string | undefined;
  receivedAtCounter: number;
  receivedAtDate: number;
  senderDevice: number;
  senderAci: AciString;
  timestamp: number;
}>;

export class DecryptionErrorEvent extends ConfirmableEvent {
  public readonly decryptionError: DecryptionErrorEventData;
  constructor(
    decryptionError: DecryptionErrorEventData,
    confirm: ConfirmCallback
  ) {
    super('decryption-error', confirm);
    this.decryptionError = decryptionError;
  }
}

export type InvalidPlaintextEventData = Readonly<{
  senderDevice: number;
  senderAci: AciString;
  timestamp: number;
}>;

export class InvalidPlaintextEvent extends Event {
  public readonly data: InvalidPlaintextEventData;

  constructor(data: InvalidPlaintextEventData) {
    super('invalid-plaintext');
    this.data = data;
  }
}

export type RetryRequestEventData = Readonly<{
  groupId?: string;
  ratchetKey?: PublicKey;
  requesterAci: AciString;
  requesterDevice: number;
  senderDevice: number;
  sentAt: number;
}>;

export class RetryRequestEvent extends ConfirmableEvent {
  public readonly retryRequest: RetryRequestEventData;

  constructor(retryRequest: RetryRequestEventData, confirm: ConfirmCallback) {
    super('retry-request', confirm);
    this.retryRequest = retryRequest;
  }
}

export type SentEventData = Readonly<{
  envelopeId: string;
  destinationE164?: string;
  destinationServiceId?: ServiceIdString;
  timestamp: number;
  serverTimestamp: number;
  device: number | undefined;
  unidentifiedStatus: ProcessedSent['unidentifiedStatus'];
  message: ProcessedDataMessage;
  isRecipientUpdate: boolean;
  receivedAtCounter: number;
  receivedAtDate: number;
  expirationStartTimestamp?: number;
  storyDistributionListId?: StoryDistributionIdString;
}>;

export class SentEvent extends ConfirmableEvent {
  public readonly data: SentEventData;

  constructor(data: SentEventData, confirm: ConfirmCallback) {
    super('sent', confirm);
    this.data = data;
  }
}

export type ProfileKeyUpdateData = Readonly<{
  source?: string;
  sourceAci?: AciString;
  profileKey: string;
}>;

export class ProfileKeyUpdateEvent extends ConfirmableEvent {
  public readonly data: ProfileKeyUpdateData;
  public readonly reason: string;

  constructor(
    data: ProfileKeyUpdateData,
    reason: string,
    confirm: ConfirmCallback
  ) {
    super('profileKeyUpdate', confirm);

    this.data = data;
    this.reason = reason;
  }
}

export type MessageEventData = Readonly<{
  envelopeId: string;
  source?: string;
  sourceAci: AciString;
  sourceDevice?: number;
  destinationServiceId: ServiceIdString;
  timestamp: number;
  serverGuid: string;
  serverTimestamp: number;
  unidentifiedDeliveryReceived: boolean;
  message: ProcessedDataMessage;
  receivedAtCounter: number;
  receivedAtDate: number;
}>;

export class MessageEvent extends ConfirmableEvent {
  public readonly data: MessageEventData;

  constructor(data: MessageEventData, confirm: ConfirmCallback) {
    super('message', confirm);
    this.data = data;
  }
}

export type ReadOrViewEventData = Readonly<{
  timestamp: number;
  source?: string;
  sourceServiceId?: ServiceIdString;
  sourceDevice?: number;
  wasSentEncrypted: true;
}>;

export class ReadEvent extends ConfirmableEvent {
  public readonly receipts: ReadonlyArray<ReadOrViewEventData>;
  public readonly envelopeId: string;
  public readonly envelopeTimestamp: number;

  constructor(
    receipts: ReadonlyArray<ReadOrViewEventData>,
    envelopeId: string,
    envelopeTimestamp: number,
    confirm: ConfirmCallback
  ) {
    super('read', confirm);

    this.receipts = receipts;
    this.envelopeId = envelopeId;
    this.envelopeTimestamp = envelopeTimestamp;
  }
}

export class ViewEvent extends ConfirmableEvent {
  public readonly receipts: ReadonlyArray<ReadOrViewEventData>;
  public readonly envelopeId: string;
  public readonly envelopeTimestamp: number;

  constructor(
    receipts: ReadonlyArray<ReadOrViewEventData>,
    envelopeId: string,
    envelopeTimestamp: number,
    confirm: ConfirmCallback
  ) {
    super('view', confirm);
    this.receipts = receipts;
    this.envelopeId = envelopeId;
    this.envelopeTimestamp = envelopeTimestamp;
  }
}

export class ConfigurationEvent extends ConfirmableEvent {
  public readonly configuration: Proto.SyncMessage.Configuration;

  constructor(
    configuration: Proto.SyncMessage.Configuration,
    confirm: ConfirmCallback
  ) {
    super('configuration', confirm);
    this.configuration = configuration;
  }
}

export type ViewOnceOpenSyncOptions = {
  sourceAci?: AciString;
  timestamp?: number;
  envelopeTimestamp: number;
};

export class ViewOnceOpenSyncEvent extends ConfirmableEvent {
  public readonly sourceAci?: AciString;

  public readonly envelopeTimestamp: number;
  public readonly timestamp?: number;

  constructor(
    { sourceAci, timestamp, envelopeTimestamp }: ViewOnceOpenSyncOptions,
    confirm: ConfirmCallback
  ) {
    super('viewOnceOpenSync', confirm);
    this.sourceAci = sourceAci;
    this.timestamp = timestamp;
    this.envelopeTimestamp = envelopeTimestamp;
  }
}

export type MessageRequestResponseOptions = {
  envelopeId: string;
  threadE164?: string;
  threadAci?: AciString;
  messageRequestResponseType: Proto.SyncMessage.MessageRequestResponse.Type;
  groupId?: string;
  groupV2Id?: string;
  receivedAtCounter: number;
  receivedAtMs: number;
  sentAt: number;
};

export class MessageRequestResponseEvent extends ConfirmableEvent {
  public readonly threadAci?: AciString;
  public readonly messageRequestResponseType?: MessageRequestResponseOptions['messageRequestResponseType'];
  public readonly groupId?: string;
  public readonly groupV2Id?: string;
  public readonly envelopeId?: string;
  public readonly receivedAtMs: number;
  public readonly receivedAtCounter: number;
  public readonly sentAt: number;

  constructor(
    {
      envelopeId,
      threadAci,
      messageRequestResponseType,
      groupId,
      groupV2Id,
      receivedAtMs,
      receivedAtCounter,
      sentAt,
    }: MessageRequestResponseOptions,
    confirm: ConfirmCallback
  ) {
    super('messageRequestResponse', confirm);
    this.envelopeId = envelopeId;
    this.threadAci = threadAci;
    this.messageRequestResponseType = messageRequestResponseType;
    this.groupId = groupId;
    this.groupV2Id = groupV2Id;
    this.receivedAtMs = receivedAtMs;
    this.receivedAtCounter = receivedAtCounter;
    this.sentAt = sentAt;
  }
}

export class FetchLatestEvent extends ConfirmableEvent {
  public readonly eventType: Proto.SyncMessage.FetchLatest['type'];

  constructor(
    eventType: Proto.SyncMessage.FetchLatest['type'],
    confirm: ConfirmCallback
  ) {
    super('fetchLatest', confirm);
    this.eventType = eventType;
  }
}

export type KeysEventData = Readonly<{
  masterKey: Uint8Array<ArrayBuffer> | undefined;
  accountEntropyPool: string | undefined;
  mediaRootBackupKey: Uint8Array<ArrayBuffer> | undefined;
}>;

export class KeysEvent extends ConfirmableEvent {
  public readonly masterKey: Uint8Array<ArrayBuffer> | undefined;
  public readonly accountEntropyPool: string | undefined;
  public readonly mediaRootBackupKey: Uint8Array<ArrayBuffer> | undefined;

  constructor(
    { masterKey, accountEntropyPool, mediaRootBackupKey }: KeysEventData,
    confirm: ConfirmCallback
  ) {
    super('keys', confirm);
    this.masterKey = masterKey;
    this.accountEntropyPool = accountEntropyPool;
    this.mediaRootBackupKey = mediaRootBackupKey;
  }
}

export type StickerPackEventData = Readonly<{
  id?: string;
  key?: string;
  isInstall: boolean;
  isRemove: boolean;
}>;

export class StickerPackEvent extends ConfirmableEvent {
  public readonly stickerPacks: ReadonlyArray<StickerPackEventData>;

  constructor(
    stickerPacks: ReadonlyArray<StickerPackEventData>,
    confirm: ConfirmCallback
  ) {
    super('sticker-pack', confirm);
    this.stickerPacks = stickerPacks;
  }
}

export type ReadSyncEventData = Readonly<{
  envelopeId: string;
  timestamp?: number;
  envelopeTimestamp: number;
  sender?: string;
  senderAci?: AciString;
}>;

export class ReadSyncEvent extends ConfirmableEvent {
  public readonly reads: ReadonlyArray<ReadSyncEventData>;
  public readonly envelopeId: string;
  public readonly envelopeTimestamp: number;

  constructor(
    reads: ReadonlyArray<ReadSyncEventData>,
    envelopeId: string,
    envelopeTimestamp: number,
    confirm: ConfirmCallback
  ) {
    super('readSync', confirm);
    this.reads = reads;
    this.envelopeId = envelopeId;
    this.envelopeTimestamp = envelopeTimestamp;
  }
}

export type ViewSyncEventData = Readonly<{
  timestamp?: number;
  senderE164?: string;
  senderAci?: AciString;
}>;

export class ViewSyncEvent extends ConfirmableEvent {
  public readonly views: ReadonlyArray<ViewSyncEventData>;
  public readonly envelopeId: string;
  public readonly envelopeTimestamp: number;

  constructor(
    views: ReadonlyArray<ViewSyncEventData>,
    envelopeId: string,
    envelopeTimestamp: number,
    confirm: ConfirmCallback
  ) {
    super('viewSync', confirm);
    this.views = views;
    this.envelopeId = envelopeId;
    this.envelopeTimestamp = envelopeTimestamp;
  }
}

export type CallEventSyncEventData = Readonly<{
  callEventDetails: CallEventDetails;
  receivedAtCounter: number;
  receivedAtMS: number;
}>;

export class CallEventSyncEvent extends ConfirmableEvent {
  public readonly callEvent: CallEventSyncEventData;

  constructor(callEvent: CallEventSyncEventData, confirm: ConfirmCallback) {
    super('callEventSync', confirm);
    this.callEvent = callEvent;
  }
}

export type CallLinkUpdateSyncEventData = Readonly<{
  type: CallLinkUpdateSyncType;
  rootKey: Uint8Array<ArrayBuffer> | undefined;
  adminKey: Uint8Array<ArrayBuffer> | undefined;
}>;

export class CallLinkUpdateSyncEvent extends ConfirmableEvent {
  public readonly callLinkUpdate: CallLinkUpdateSyncEventData;

  constructor(
    callLinkUpdate: CallLinkUpdateSyncEventData,
    confirm: ConfirmCallback
  ) {
    super('callLinkUpdateSync', confirm);
    this.callLinkUpdate = callLinkUpdate;
  }
}

export class DeviceNameChangeSyncEvent extends ConfirmableEvent {
  constructor(confirm: ConfirmCallback) {
    super('deviceNameChangeSync', confirm);
  }
}

const addressableMessageSchema = z.union([
  z.object({
    type: z.literal('aci').readonly(),
    authorAci: z.string().refine(isAciString),
    sentAt: z.number(),
  }),
  z.object({
    type: z.literal('e164').readonly(),
    authorE164: z.string(),
    sentAt: z.number(),
  }),
  z.object({
    type: z.literal('pni').readonly(),
    authorPni: z.string().refine(isPniString),
    sentAt: z.number(),
  }),
]);

export type AddressableMessage = z.infer<typeof addressableMessageSchema>;

const conversationIdentifierSchema = z.union([
  z.object({
    type: z.literal('aci').readonly(),
    aci: z.string().refine(isAciString),
  }),
  z.object({
    type: z.literal('e164').readonly(),
    e164: z.string(),
  }),
  z.object({
    type: z.literal('group').readonly(),
    groupId: z.string(),
  }),
  z.object({
    type: z.literal('pni').readonly(),
    pni: z.string().refine(isPniString),
  }),
]);

export type ConversationIdentifier = z.infer<
  typeof conversationIdentifierSchema
>;

export const deleteMessageSchema = z.object({
  type: z.literal('delete-message').readonly(),
  conversation: conversationIdentifierSchema,
  message: addressableMessageSchema,
  timestamp: z.number(),
});
export type DeleteMessageSyncTarget = z.infer<typeof deleteMessageSchema>;
export const deleteConversationSchema = z.object({
  type: z.literal('delete-conversation').readonly(),
  conversation: conversationIdentifierSchema,
  mostRecentMessages: z.array(addressableMessageSchema),
  mostRecentNonExpiringMessages: z.array(addressableMessageSchema).optional(),
  isFullDelete: z.boolean(),
  timestamp: z.number(),
});
export const deleteLocalConversationSchema = z.object({
  type: z.literal('delete-local-conversation').readonly(),
  conversation: conversationIdentifierSchema,
  timestamp: z.number(),
});
export const deleteAttachmentSchema = z.object({
  type: z.literal('delete-single-attachment').readonly(),
  conversation: conversationIdentifierSchema,
  message: addressableMessageSchema,
  clientUuid: z.string().optional(),
  fallbackDigest: z.string().optional(),
  fallbackPlaintextHash: z.string().optional(),
  timestamp: z.number(),
});
export const deleteForMeSyncTargetSchema = z.union([
  deleteMessageSchema,
  deleteConversationSchema,
  deleteLocalConversationSchema,
  deleteAttachmentSchema,
]);

export type DeleteForMeSyncTarget = z.infer<typeof deleteForMeSyncTargetSchema>;

export type DeleteForMeSyncEventData = ReadonlyArray<DeleteForMeSyncTarget>;

export class DeleteForMeSyncEvent extends ConfirmableEvent {
  public readonly deleteForMeSync: DeleteForMeSyncEventData;
  public readonly timestamp: number;
  public readonly envelopeId: string;

  constructor(
    deleteForMeSync: DeleteForMeSyncEventData,
    timestamp: number,
    envelopeId: string,
    confirm: ConfirmCallback
  ) {
    super('deleteForMeSync', confirm);

    this.deleteForMeSync = deleteForMeSync;
    this.timestamp = timestamp;
    this.envelopeId = envelopeId;
  }
}

export type AttachmentBackfillAttachmentType = Readonly<
  | {
      attachment: ProcessedAttachment;
    }
  | {
      status: Proto.SyncMessage.AttachmentBackfillResponse.AttachmentData.Status;
    }
>;

export type AttachmentBackfillResponseSyncEventData = Readonly<
  {
    targetMessage: AddressableMessage;
    targetConversation: ConversationIdentifier;
  } & (
    | {
        error: Proto.SyncMessage.AttachmentBackfillResponse.Error;
      }
    | {
        attachments: ReadonlyArray<AttachmentBackfillAttachmentType>;
        longText: AttachmentBackfillAttachmentType | undefined;
      }
  )
>;

export class AttachmentBackfillResponseSyncEvent extends ConfirmableEvent {
  public readonly response: AttachmentBackfillResponseSyncEventData;
  public readonly timestamp: number;
  public readonly envelopeId: string;

  constructor(
    response: AttachmentBackfillResponseSyncEventData,
    timestamp: number,
    envelopeId: string,
    confirm: ConfirmCallback
  ) {
    super('attachmentBackfillResponseSync', confirm);
    this.response = response;
    this.timestamp = timestamp;
    this.envelopeId = envelopeId;
  }
}

export type CallLogEventSyncEventData = Readonly<{
  callLogEventDetails: CallLogEventDetails;
  receivedAtCounter: number;
}>;

export class CallLogEventSyncEvent extends ConfirmableEvent {
  public readonly data: CallLogEventSyncEventData;

  constructor(data: CallLogEventSyncEventData, confirm: ConfirmCallback) {
    super('callLogEventSync', confirm);
    this.data = data;
  }
}

export type StoryRecipientUpdateData = Readonly<{
  destinationServiceId: ServiceIdString;
  storyMessageRecipients: StoryMessageRecipientsType;
  timestamp: number;
}>;

export class StoryRecipientUpdateEvent extends ConfirmableEvent {
  public readonly data: StoryRecipientUpdateData;

  constructor(data: StoryRecipientUpdateData, confirm: ConfirmCallback) {
    super('storyRecipientUpdate', confirm);
    this.data = data;
  }
}
