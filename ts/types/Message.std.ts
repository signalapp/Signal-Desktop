// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { MessageAttributesType } from '../model-types.d.ts';
import { strictAssert } from '../util/assert.std.ts';
import type { ErrorIfOverlapping, ExactKeys } from './Util.std.ts';

export function getMentionsRegex(): RegExp {
  return /\uFFFC/g;
}

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
  'deletedForEveryoneByAdminAci',
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
  'pinMessage',
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
