// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
/* eslint-disable max-classes-per-file */

import type { PublicKey } from '@signalapp/libsignal-client';
import { z } from 'zod';

import type { SignalService as Proto } from '../protobuf';
import {
  type ServiceIdString,
  type AciString,
  isPniString,
} from '../types/ServiceId';
import type { StoryDistributionIdString } from '../types/StoryDistributionId';
import type {
  ProcessedEnvelope,
  ProcessedDataMessage,
  ProcessedSent,
  ProcessedAttachment,
} from './Types.d';
import type {
  CallEventDetails,
  CallLogEventDetails,
} from '../types/CallDisposition';
import type { CallLinkUpdateSyncType } from '../types/CallLink';
import { isAciString } from '../util/isAciString';

export class EmptyEvent extends Event {
  constructor() {
    super('empty');
  }
}

export class ProgressEvent extends Event {
  public readonly count: number;

  constructor({ count }: { count: number }) {
    super('progress');

    this.count = count;
  }
}

export type TypingEventData = Readonly<{
  typingMessage: Proto.ITypingMessage;
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
  constructor(public readonly error: Error) {
    super('error');
  }
}

export class ContactSyncEvent extends Event {
  constructor(
    public readonly contactAttachment: ProcessedAttachment,
    public readonly complete: boolean,
    public readonly receivedAtCounter: number,
    public readonly sentAt: number
  ) {
    super('contactSync');
  }
}

// Emitted right before we do full decrypt on a message, but after Sealed Sender unseal
export class EnvelopeUnsealedEvent extends Event {
  constructor(public readonly envelope: ProcessedEnvelope) {
    super('envelopeUnsealed');
  }
}

export class EnvelopeQueuedEvent extends Event {
  constructor(public readonly envelope: ProcessedEnvelope) {
    super('envelopeQueued');
  }
}

//
// Confirmable events below
//

export type ConfirmCallback = () => void;

export class ConfirmableEvent extends Event {
  constructor(
    type: string,
    public readonly confirm: ConfirmCallback
  ) {
    super(type);
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
  constructor(
    public readonly deliveryReceipts: ReadonlyArray<DeliveryEventData>,
    public readonly envelopeId: string,
    public readonly envelopeTimestamp: number,
    confirm: ConfirmCallback
  ) {
    super('delivery', confirm);
  }
}

export type SuccessfulDecryptEventData = Readonly<{
  senderDevice: number;
  senderAci: AciString;
  timestamp: number;
}>;

export class SuccessfulDecryptEvent extends ConfirmableEvent {
  constructor(
    public readonly data: SuccessfulDecryptEventData,
    confirm: ConfirmCallback
  ) {
    super('successful-decrypt', confirm);
  }
}

export type DecryptionErrorEventData = Readonly<{
  cipherTextBytes: Uint8Array | undefined;
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
  constructor(
    public readonly decryptionError: DecryptionErrorEventData,
    confirm: ConfirmCallback
  ) {
    super('decryption-error', confirm);
  }
}

export type InvalidPlaintextEventData = Readonly<{
  senderDevice: number;
  senderAci: AciString;
  timestamp: number;
}>;

export class InvalidPlaintextEvent extends Event {
  constructor(public readonly data: InvalidPlaintextEventData) {
    super('invalid-plaintext');
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
  constructor(
    public readonly retryRequest: RetryRequestEventData,
    confirm: ConfirmCallback
  ) {
    super('retry-request', confirm);
  }
}

export type SentEventData = Readonly<{
  envelopeId: string;
  destinationE164?: string;
  destinationServiceId?: ServiceIdString;
  timestamp?: number;
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
  constructor(
    public readonly data: SentEventData,
    confirm: ConfirmCallback
  ) {
    super('sent', confirm);
  }
}

export type ProfileKeyUpdateData = Readonly<{
  source?: string;
  sourceAci?: AciString;
  profileKey: string;
}>;

export class ProfileKeyUpdateEvent extends ConfirmableEvent {
  constructor(
    public readonly data: ProfileKeyUpdateData,
    public readonly reason: string,
    confirm: ConfirmCallback
  ) {
    super('profileKeyUpdate', confirm);
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
  constructor(
    public readonly data: MessageEventData,
    confirm: ConfirmCallback
  ) {
    super('message', confirm);
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
  constructor(
    public readonly receipts: ReadonlyArray<ReadOrViewEventData>,
    public readonly envelopeId: string,
    public readonly envelopeTimestamp: number,
    confirm: ConfirmCallback
  ) {
    super('read', confirm);
  }
}

export class ViewEvent extends ConfirmableEvent {
  constructor(
    public readonly receipts: ReadonlyArray<ReadOrViewEventData>,
    public readonly envelopeId: string,
    public readonly envelopeTimestamp: number,
    confirm: ConfirmCallback
  ) {
    super('view', confirm);
  }
}

export class ConfigurationEvent extends ConfirmableEvent {
  constructor(
    public readonly configuration: Proto.SyncMessage.IConfiguration,
    confirm: ConfirmCallback
  ) {
    super('configuration', confirm);
  }
}

export type ViewOnceOpenSyncOptions = {
  sourceAci?: AciString;
  timestamp?: number;
};

export class ViewOnceOpenSyncEvent extends ConfirmableEvent {
  public readonly sourceAci?: AciString;

  public readonly timestamp?: number;

  constructor(
    { sourceAci, timestamp }: ViewOnceOpenSyncOptions,
    confirm: ConfirmCallback
  ) {
    super('viewOnceOpenSync', confirm);

    this.sourceAci = sourceAci;
    this.timestamp = timestamp;
  }
}

export type MessageRequestResponseOptions = {
  envelopeId: string;
  threadE164?: string;
  threadAci?: AciString;
  messageRequestResponseType: Proto.SyncMessage.IMessageRequestResponse['type'];
  groupId?: string;
  groupV2Id?: string;
};

export class MessageRequestResponseEvent extends ConfirmableEvent {
  public readonly threadAci?: AciString;

  public readonly messageRequestResponseType?: MessageRequestResponseOptions['messageRequestResponseType'];

  public readonly groupId?: string;

  public readonly groupV2Id?: string;

  public readonly envelopeId?: string;

  constructor(
    {
      envelopeId,
      threadAci,
      messageRequestResponseType,
      groupId,
      groupV2Id,
    }: MessageRequestResponseOptions,
    confirm: ConfirmCallback
  ) {
    super('messageRequestResponse', confirm);

    this.envelopeId = envelopeId;
    this.threadAci = threadAci;
    this.messageRequestResponseType = messageRequestResponseType;
    this.groupId = groupId;
    this.groupV2Id = groupV2Id;
  }
}

export class FetchLatestEvent extends ConfirmableEvent {
  constructor(
    public readonly eventType: Proto.SyncMessage.IFetchLatest['type'],
    confirm: ConfirmCallback
  ) {
    super('fetchLatest', confirm);
  }
}

export type KeysEventData = Readonly<{
  masterKey: Uint8Array | undefined;
  accountEntropyPool: string | undefined;
  mediaRootBackupKey: Uint8Array | undefined;
}>;

export class KeysEvent extends ConfirmableEvent {
  public readonly masterKey: Uint8Array | undefined;
  public readonly accountEntropyPool: string | undefined;
  public readonly mediaRootBackupKey: Uint8Array | undefined;

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
  constructor(
    public readonly stickerPacks: ReadonlyArray<StickerPackEventData>,
    confirm: ConfirmCallback
  ) {
    super('sticker-pack', confirm);
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
  constructor(
    public readonly reads: ReadonlyArray<ReadSyncEventData>,
    public readonly envelopeId: string,
    public readonly envelopeTimestamp: number,
    confirm: ConfirmCallback
  ) {
    super('readSync', confirm);
  }
}

export type ViewSyncEventData = Readonly<{
  timestamp?: number;
  senderE164?: string;
  senderAci?: AciString;
}>;

export class ViewSyncEvent extends ConfirmableEvent {
  constructor(
    public readonly views: ReadonlyArray<ViewSyncEventData>,
    public readonly envelopeId: string,
    public readonly envelopeTimestamp: number,
    confirm: ConfirmCallback
  ) {
    super('viewSync', confirm);
  }
}

export type CallEventSyncEventData = Readonly<{
  callEventDetails: CallEventDetails;
  receivedAtCounter: number;
  receivedAtMS: number;
}>;

export class CallEventSyncEvent extends ConfirmableEvent {
  constructor(
    public readonly callEvent: CallEventSyncEventData,
    confirm: ConfirmCallback
  ) {
    super('callEventSync', confirm);
  }
}

export type CallLinkUpdateSyncEventData = Readonly<{
  type: CallLinkUpdateSyncType;
  rootKey: Uint8Array | undefined;
  adminKey: Uint8Array | undefined;
}>;

export class CallLinkUpdateSyncEvent extends ConfirmableEvent {
  constructor(
    public readonly callLinkUpdate: CallLinkUpdateSyncEventData,
    confirm: ConfirmCallback
  ) {
    super('callLinkUpdateSync', confirm);
  }
}

export class DeviceNameChangeSyncEvent extends ConfirmableEvent {
  constructor(confirm: ConfirmCallback) {
    super('deviceNameChangeSync', confirm);
  }
}

const messageToDeleteSchema = z.union([
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

export type MessageToDelete = z.infer<typeof messageToDeleteSchema>;

const conversationToDeleteSchema = z.union([
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

export type ConversationToDelete = z.infer<typeof conversationToDeleteSchema>;

export const deleteMessageSchema = z.object({
  type: z.literal('delete-message').readonly(),
  conversation: conversationToDeleteSchema,
  message: messageToDeleteSchema,
  timestamp: z.number(),
});
export type DeleteMessageSyncTarget = z.infer<typeof deleteMessageSchema>;
export const deleteConversationSchema = z.object({
  type: z.literal('delete-conversation').readonly(),
  conversation: conversationToDeleteSchema,
  mostRecentMessages: z.array(messageToDeleteSchema),
  mostRecentNonExpiringMessages: z.array(messageToDeleteSchema).optional(),
  isFullDelete: z.boolean(),
  timestamp: z.number(),
});
export const deleteLocalConversationSchema = z.object({
  type: z.literal('delete-local-conversation').readonly(),
  conversation: conversationToDeleteSchema,
  timestamp: z.number(),
});
export const deleteAttachmentSchema = z.object({
  type: z.literal('delete-single-attachment').readonly(),
  conversation: conversationToDeleteSchema,
  message: messageToDeleteSchema,
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
  constructor(
    public readonly deleteForMeSync: DeleteForMeSyncEventData,
    public readonly timestamp: number,
    public readonly envelopeId: string,
    confirm: ConfirmCallback
  ) {
    super('deleteForMeSync', confirm);
  }
}

export type CallLogEventSyncEventData = Readonly<{
  callLogEventDetails: CallLogEventDetails;
  receivedAtCounter: number;
}>;

export class CallLogEventSyncEvent extends ConfirmableEvent {
  constructor(
    public readonly data: CallLogEventSyncEventData,
    confirm: ConfirmCallback
  ) {
    super('callLogEventSync', confirm);
  }
}

export type StoryRecipientUpdateData = Readonly<{
  destinationServiceId: ServiceIdString;
  storyMessageRecipients: Array<Proto.SyncMessage.Sent.IStoryMessageRecipient>;
  timestamp: number;
}>;

export class StoryRecipientUpdateEvent extends ConfirmableEvent {
  constructor(
    public readonly data: StoryRecipientUpdateData,
    confirm: ConfirmCallback
  ) {
    super('storyRecipientUpdate', confirm);
  }
}
