// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
/* eslint-disable max-classes-per-file */

import type { PublicKey } from '@signalapp/signal-client';

import type { SignalService as Proto } from '../protobuf';
import type {
  ProcessedEnvelope,
  ProcessedDataMessage,
  ProcessedSent,
} from './Types.d';
import type {
  ModifiedContactDetails,
  ModifiedGroupDetails,
} from './ContactsParser';

export class ReconnectEvent extends Event {
  constructor() {
    super('reconnect');
  }
}

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
  senderUuid?: string;
  senderDevice: number;
  typing: TypingEventData;
};

export class TypingEvent extends Event {
  public readonly sender?: string;

  public readonly senderUuid?: string;

  public readonly senderDevice: number;

  public readonly typing: TypingEventData;

  constructor({ sender, senderUuid, senderDevice, typing }: TypingEventConfig) {
    super('typing');

    this.sender = sender;
    this.senderUuid = senderUuid;
    this.senderDevice = senderDevice;
    this.typing = typing;
  }
}

export class ErrorEvent extends Event {
  constructor(public readonly error: Error) {
    super('error');
  }
}

export class ContactEvent extends Event {
  constructor(public readonly contactDetails: ModifiedContactDetails) {
    super('contact');
  }
}

export class ContactSyncEvent extends Event {
  constructor() {
    super('contactSync');
  }
}

export type GroupEventData = Omit<ModifiedGroupDetails, 'id'> &
  Readonly<{
    id: string;
  }>;

export class GroupEvent extends Event {
  constructor(public readonly groupDetails: GroupEventData) {
    super('group');
  }
}

export class GroupSyncEvent extends Event {
  constructor() {
    super('groupSync');
  }
}

export class EnvelopeEvent extends Event {
  constructor(public readonly envelope: ProcessedEnvelope) {
    super('envelope');
  }
}

//
// Confirmable events below
//

export type ConfirmCallback = () => void;

export class ConfirmableEvent extends Event {
  constructor(type: string, public readonly confirm: ConfirmCallback) {
    super(type);
  }
}

export type DeliveryEventData = Readonly<{
  timestamp: number;
  envelopeTimestamp?: number;
  source?: string;
  sourceUuid?: string;
  sourceDevice?: number;
}>;

export class DeliveryEvent extends ConfirmableEvent {
  constructor(
    public readonly deliveryReceipt: DeliveryEventData,
    confirm: ConfirmCallback
  ) {
    super('delivery', confirm);
  }
}

export type DecryptionErrorEventData = Readonly<{
  cipherTextBytes?: Uint8Array;
  cipherTextType?: number;
  contentHint?: number;
  groupId?: string;
  receivedAtCounter: number;
  receivedAtDate: number;
  senderDevice: number;
  senderUuid: string;
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

export type RetryRequestEventData = Readonly<{
  groupId?: string;
  ratchetKey?: PublicKey;
  requesterUuid: string;
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
  destination?: string;
  destinationUuid?: string;
  timestamp?: number;
  serverTimestamp?: number;
  device?: number;
  unidentifiedStatus: ProcessedSent['unidentifiedStatus'];
  message: ProcessedDataMessage;
  isRecipientUpdate: boolean;
  receivedAtCounter: number;
  receivedAtDate: number;
  expirationStartTimestamp?: number;
}>;

export class SentEvent extends ConfirmableEvent {
  constructor(public readonly data: SentEventData, confirm: ConfirmCallback) {
    super('sent', confirm);
  }
}

export type ProfileKeyUpdateData = Readonly<{
  source?: string;
  sourceUuid?: string;
  profileKey: string;
}>;

export class ProfileKeyUpdateEvent extends ConfirmableEvent {
  constructor(
    public readonly data: ProfileKeyUpdateData,
    confirm: ConfirmCallback
  ) {
    super('profileKeyUpdate', confirm);
  }
}

export type MessageEventData = Readonly<{
  source?: string;
  sourceUuid?: string;
  sourceDevice?: number;
  timestamp: number;
  serverGuid?: string;
  serverTimestamp?: number;
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
  envelopeTimestamp: number;
  source?: string;
  sourceUuid?: string;
  sourceDevice?: number;
}>;

export class ReadEvent extends ConfirmableEvent {
  constructor(
    public readonly receipt: ReadOrViewEventData,
    confirm: ConfirmCallback
  ) {
    super('read', confirm);
  }
}

export class ViewEvent extends ConfirmableEvent {
  constructor(
    public readonly receipt: ReadOrViewEventData,
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
  source?: string;
  sourceUuid?: string;
  timestamp?: number;
};

export class ViewOnceOpenSyncEvent extends ConfirmableEvent {
  public readonly source?: string;

  public readonly sourceUuid?: string;

  public readonly timestamp?: number;

  constructor(
    { source, sourceUuid, timestamp }: ViewOnceOpenSyncOptions,
    confirm: ConfirmCallback
  ) {
    super('viewOnceOpenSync', confirm);

    this.source = source;
    this.sourceUuid = sourceUuid;
    this.timestamp = timestamp;
  }
}

export type MessageRequestResponseOptions = {
  threadE164?: string;
  threadUuid?: string;
  messageRequestResponseType: Proto.SyncMessage.IMessageRequestResponse['type'];
  groupId?: string;
  groupV2Id?: string;
};

export class MessageRequestResponseEvent extends ConfirmableEvent {
  public readonly threadE164?: string;

  public readonly threadUuid?: string;

  public readonly messageRequestResponseType?: MessageRequestResponseOptions['messageRequestResponseType'];

  public readonly groupId?: string;

  public readonly groupV2Id?: string;

  constructor(
    {
      threadE164,
      threadUuid,
      messageRequestResponseType,
      groupId,
      groupV2Id,
    }: MessageRequestResponseOptions,
    confirm: ConfirmCallback
  ) {
    super('messageRequestResponse', confirm);

    this.threadE164 = threadE164;
    this.threadUuid = threadUuid;
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

export class KeysEvent extends ConfirmableEvent {
  constructor(
    public readonly storageServiceKey: Uint8Array,
    confirm: ConfirmCallback
  ) {
    super('keys', confirm);
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

export type VerifiedEventData = Readonly<{
  state: Proto.IVerified['state'];
  destination?: string;
  destinationUuid?: string;
  identityKey?: Uint8Array;

  // Used in `ts/background.ts`
  viaContactSync?: boolean;
}>;

export class VerifiedEvent extends ConfirmableEvent {
  constructor(
    public readonly verified: VerifiedEventData,
    confirm: ConfirmCallback
  ) {
    super('verified', confirm);
  }
}

export type ReadSyncEventData = Readonly<{
  timestamp?: number;
  envelopeTimestamp: number;
  sender?: string;
  senderUuid?: string;
}>;

export class ReadSyncEvent extends ConfirmableEvent {
  constructor(
    public readonly read: ReadSyncEventData,
    confirm: ConfirmCallback
  ) {
    super('readSync', confirm);
  }
}

export type ViewSyncEventData = Readonly<{
  timestamp?: number;
  envelopeTimestamp: number;
  senderE164?: string;
  senderUuid?: string;
}>;

export class ViewSyncEvent extends ConfirmableEvent {
  constructor(
    public readonly view: ViewSyncEventData,
    confirm: ConfirmCallback
  ) {
    super('viewSync', confirm);
  }
}
