// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { MessageAttributesType } from '../model-types.d.ts';
import { isNotNil } from '../util/isNotNil.std.ts';

export type EraseMessageReasonType =
  | 'view-once-viewed'
  | 'view-once-invalid'
  | 'view-once-expired'
  | 'view-once-sent'
  | 'unsupported-message'
  | 'delete-for-everyone';

export function getMentionsRegex(): RegExp {
  return /\uFFFC/g;
}

const VIEW_ONCE_REASONS = new Set<EraseMessageReasonType>([
  'view-once-expired',
  'view-once-invalid',
  'view-once-sent',
  'view-once-viewed',
]);

const messageAttributesEraseBehavior: Record<
  keyof MessageAttributesType,
  | 'preserve'
  | 'erase'
  | ((eraseReason: EraseMessageReasonType) => 'preserve' | 'erase')
> = {
  id: 'preserve',
  timestamp: 'preserve',
  conversationId: 'preserve',
  type: 'preserve',
  sent_at: 'preserve',
  received_at: 'preserve',

  canReplyToStory: 'preserve',
  deletedForEveryone: 'preserve',
  deletedForEveryoneByAdminAci: 'preserve',
  deletedForEveryoneFailed: 'preserve',
  deletedForEveryoneSendStatus: 'preserve',
  deletedForEveryoneTimestamp: 'preserve',
  editMessageReceivedAt: 'preserve',
  editMessageReceivedAtMs: 'preserve',
  editMessageTimestamp: 'preserve',
  errors: 'preserve',
  expirationStartTimestamp: 'preserve',
  expireTimer: 'preserve',
  isErased: 'preserve',
  isTapToViewInvalid: 'preserve',
  isViewOnce: 'preserve',
  readAt: 'preserve',
  readStatus: 'preserve',
  received_at_ms: 'preserve',
  requiredProtocolVersion: 'preserve',
  schemaMigrationAttempts: 'preserve',
  schemaVersion: 'preserve',
  seenStatus: 'preserve',
  sendStateByConversationId: 'preserve',
  serverGuid: 'preserve',
  serverTimestamp: 'preserve',
  source: 'preserve',
  sourceDevice: 'preserve',
  sourceServiceId: 'preserve',
  storyId: 'preserve',
  synced: 'preserve',
  unidentifiedDeliveries: 'preserve',

  attachments: 'erase',
  body: 'erase',
  bodyAttachment: 'erase',
  bodyRanges: 'erase',
  callId: 'erase',
  changedId: 'erase',
  contact: 'erase',
  conversationMerge: 'erase',
  dataMessage: 'erase',
  decrypted_at: 'erase',
  droppedGV2MemberIds: 'erase',
  editHistory: 'erase',
  expirationTimerUpdate: 'erase',
  flags: 'erase',
  giftBadge: 'erase',
  group_update: 'erase',
  groupMigration: 'erase',
  groupV2Change: 'erase',
  hasUnreadPollVotes: 'erase',
  invitedGV2Members: 'erase',
  unidentifiedDeliveryReceived: 'erase',
  key_changed: 'erase',
  local: 'erase',
  logger: 'erase',
  mentionsMe: 'erase',
  message: 'erase',
  messageRequestResponseEvent: 'erase',
  messageTimer: 'erase',
  payment: 'erase',
  phoneNumberDiscovery: 'erase',
  pinMessage: 'erase',
  poll: 'erase',
  pollTerminateNotification: 'erase',
  preview: 'erase',
  profileChange: 'erase',
  quote: 'erase',
  sendHQImages: 'erase',
  sms: 'erase',
  sticker: 'erase',
  storyDistributionListId: 'erase',
  storyReaction: 'erase',
  storyRecipientsVersion: 'erase',
  storyReplyContext: 'erase',
  supportedVersionAtReceive: 'erase',
  titleTransition: 'erase',
  verified: 'erase',
  verifiedChanged: 'erase',

  reactions: reason => (VIEW_ONCE_REASONS.has(reason) ? 'preserve' : 'erase'),
};

export const getMessageAttrsToPreserveAfterErase = (
  reason: EraseMessageReasonType
): Array<keyof MessageAttributesType> => {
  return (
    Object.keys(messageAttributesEraseBehavior) as Array<
      keyof MessageAttributesType
    >
  )
    .filter(name => {
      const valueOrFn = messageAttributesEraseBehavior[name];
      return (
        valueOrFn === 'preserve' ||
        (typeof valueOrFn === 'function' && valueOrFn(reason) === 'preserve')
      );
    })
    .filter(isNotNil);
};
