// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { MessageAttributesType } from '../model-types.js';
import { strictAssert } from '../util/assert.std.js';
import type { DurationInSeconds } from '../util/durations/index.std.js';
import type { AttachmentType } from './Attachment.std.js';
import type { EmbeddedContactType } from './EmbeddedContact.std.js';
import type { ErrorIfOverlapping, ExactKeys } from './Util.std.js';

export function getMentionsRegex(): RegExp {
  return /\uFFFC/g;
}

export type Message = (
  | VerifiedChangeMessage
  | ProfileChangeNotificationMessage
) & { deletedForEveryone?: boolean };

export type IncomingMessage = Readonly<
  {
    type: 'incoming';
    // Required
    attachments: Array<AttachmentType>;
    id: string;
    received_at: number;

    // Optional
    body?: string;
    decrypted_at?: number;
    errors?: Array<Error>;
    expireTimer?: DurationInSeconds;
    messageTimer?: number; // deprecated
    isViewOnce?: number;
    flags?: number;
    source?: string;
    sourceDevice?: number;
  } & SharedMessageProperties &
    MessageSchemaVersion6 &
    ExpirationTimerUpdate
>;

export type OutgoingMessage = Readonly<
  {
    type: 'outgoing';

    // Required
    attachments: Array<AttachmentType>;
    expirationStartTimestamp: number;
    id: string;
    received_at: number;

    // Optional
    body?: string;
    expireTimer?: DurationInSeconds;
    messageTimer?: number; // deprecated
    isViewOnce?: number;
    synced: boolean;
  } & SharedMessageProperties &
    ExpirationTimerUpdate
>;

export type VerifiedChangeMessage = Readonly<
  {
    type: 'verified-change';
  } & SharedMessageProperties &
    ExpirationTimerUpdate
>;

export type ProfileChangeNotificationMessage = Readonly<
  {
    type: 'profile-change';
  } & SharedMessageProperties &
    ExpirationTimerUpdate
>;

export type SharedMessageProperties = Readonly<{
  conversationId: string;
  sent_at: number;
  timestamp: number;
}>;

export type ExpirationTimerUpdate = Partial<
  Readonly<{
    expirationTimerUpdate: Readonly<{
      expireTimer: DurationInSeconds;
      fromSync: boolean;
      source: string; // PhoneNumber
    }>;
  }>
>;

export type MessageSchemaVersion6 = Partial<
  Readonly<{
    contact: Array<EmbeddedContactType>;
  }>
>;

// NB: see `eraseMessageContents` for all scenarios in which message content can be erased
export const messageAttrsToPreserveAfterErase = [
  // TS required fields
  'id',
  'timestamp',
  'conversationId',
  'type',
  'sent_at',
  'received_at',

  // all other, non-TS-required fields to preserve
  'canReplyToStory',
  'deletedForEveryone',
  'deletedForEveryoneFailed',
  'deletedForEveryoneSendStatus',
  'deletedForEveryoneTimestamp',
  'editMessageReceivedAt',
  'editMessageReceivedAtMs',
  'editMessageTimestamp',
  'errors',
  'expirationStartTimestamp',
  'expireTimer',
  'isErased',
  'isTapToViewInvalid',
  'isViewOnce',
  'readAt',
  'readStatus',
  'received_at_ms',
  'requiredProtocolVersion',
  'schemaMigrationAttempts',
  'schemaVersion',
  'seenStatus',
  'sendStateByConversationId',
  'serverGuid',
  'serverTimestamp',
  'source',
  'sourceDevice',
  'sourceServiceId',
  'storyId',
  'synced',
  'unidentifiedDeliveries',
] as const;

const messageAttrsToErase = [
  'attachments',
  'body',
  'bodyAttachment',
  'bodyRanges',
  'callId',
  'changedId',
  'contact',
  'conversationMerge',
  'dataMessage',
  'decrypted_at',
  'droppedGV2MemberIds',
  'editHistory',
  'expirationTimerUpdate',
  'flags',
  'giftBadge',
  'group_update',
  'groupMigration',
  'groupV2Change',
  'hasUnreadPollVotes',
  'invitedGV2Members',
  'unidentifiedDeliveryReceived',
  'key_changed',
  'local',
  'logger',
  'mentionsMe',
  'message',
  'messageRequestResponseEvent',
  'messageTimer',
  'payment',
  'phoneNumberDiscovery',
  'pinnedMessageId',
  'poll',
  'pollTerminateNotification',
  'preview',
  'profileChange',
  'quote',
  'reactions',
  'sendHQImages',
  'sms',
  'sticker',
  'storyDistributionListId',
  'storyReaction',
  'storyRecipientsVersion',
  'storyReplyContext',
  'supportedVersionAtReceive',
  'titleTransition',
  'verified',
  'verifiedChanged',
] as const;

const allKeys = [
  ...messageAttrsToPreserveAfterErase,
  ...messageAttrsToErase,
] as const;

// Note: if this errors, it's likely that the keys of MessageAttributesType have changed
// and you need to update messageAttrsToPreserveAfterErase or
// messageAttributesToEraseIfMessageContentsAreErased as needed
const _enforceTypeCheck: ExactKeys<MessageAttributesType, typeof allKeys> =
  {} as MessageAttributesType;
strictAssert(_enforceTypeCheck != null, 'type check');

const _checkKeys: ErrorIfOverlapping<
  typeof messageAttrsToPreserveAfterErase,
  typeof messageAttrsToErase
> = undefined;
strictAssert(_checkKeys === undefined, 'type check');
