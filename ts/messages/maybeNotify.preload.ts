// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createLogger } from '../logging/log.std.js';

import { isIncoming, isOutgoing } from './helpers.std.js';
import { getAuthor } from './sources.preload.js';

import type { ConversationModel } from '../models/conversations.preload.js';
import { getActiveProfile } from '../state/selectors/notificationProfiles.dom.js';
import { shouldNotify as shouldNotifyDuringNotificationProfile } from '../types/NotificationProfile.std.js';
import { NotificationType } from '../types/notifications.std.js';
import { isMessageUnread } from '../util/isMessageUnread.std.js';
import { isDirectConversation } from '../util/whatTypeOfConversation.dom.js';
import { hasExpiration } from '../types/Message2.preload.js';
import { notificationService } from '../services/notifications.preload.js';
import { getNotificationTextForMessage } from '../util/getNotificationTextForMessage.preload.js';
import type { MessageAttributesType } from '../model-types.d.ts';
import type { ReactionAttributesType } from '../messageModifiers/Reactions.preload.js';
import { shouldStoryReplyNotifyUser } from '../util/shouldStoryReplyNotifyUser.preload.js';
import { ReactionSource } from '../reactions/ReactionSource.std.js';

const log = createLogger('maybeNotify');

type MaybeNotifyArgs = {
  conversation: ConversationModel;
} & (
  | {
      reaction: Readonly<ReactionAttributesType>;
      targetMessage: Readonly<MessageAttributesType>;
    }
  | { message: Readonly<MessageAttributesType>; reaction?: never }
);

export async function maybeNotify(args: MaybeNotifyArgs): Promise<void> {
  if (!notificationService.isEnabled) {
    return;
  }

  const { i18n } = window.SignalContext;

  const { conversation, reaction } = args;

  let warrantsNotification: boolean;
  if (reaction) {
    warrantsNotification = doesReactionWarrantNotification(args);
  } else {
    warrantsNotification = await doesMessageWarrantNotification(args);
  }
  if (!warrantsNotification) {
    return;
  }

  if (!isAllowedByConversation(args)) {
    return;
  }

  const activeProfile = getActiveProfile(window.reduxStore.getState());
  if (
    !shouldNotifyDuringNotificationProfile({
      activeProfile,
      conversationId: conversation.id,
      isCall: false,
      isMention: args.reaction ? false : Boolean(args.message.mentionsMe),
    })
  ) {
    log.info('Would notify for message, but notification profile prevented it');
    return;
  }

  const conversationId = conversation.get('id');
  const messageForNotification = args.reaction
    ? args.targetMessage
    : args.message;
  const isMessageInDirectConversation = isDirectConversation(
    conversation.attributes
  );

  const sender = reaction
    ? window.ConversationController.get(reaction.fromId)
    : getAuthor(args.message);
  const senderName = sender ? sender.getTitle() : i18n('icu:unknownContact');
  const senderTitle = isMessageInDirectConversation
    ? senderName
    : i18n('icu:notificationSenderInGroup', {
        sender: senderName,
        group: conversation.getTitle(),
      });

  const { url, absolutePath } = await conversation.getAvatarOrIdenticon();

  const messageId = messageForNotification.id;
  const isExpiringMessage = hasExpiration(messageForNotification);

  notificationService.add({
    senderTitle,
    conversationId,
    storyId: isMessageInDirectConversation
      ? undefined
      : messageForNotification.storyId,
    notificationIconUrl: url,
    notificationIconAbsolutePath: absolutePath,
    isExpiringMessage,
    message: getNotificationTextForMessage(messageForNotification),
    messageId,
    reaction: reaction
      ? {
          emoji: reaction.emoji,
          targetAuthorAci: reaction.targetAuthorAci,
          targetTimestamp: reaction.targetTimestamp,
        }
      : undefined,
    sentAt: messageForNotification.timestamp,
    type: reaction ? NotificationType.Reaction : NotificationType.Message,
  });
}

function doesReactionWarrantNotification({
  reaction,
  targetMessage,
}: {
  targetMessage: MessageAttributesType;
  reaction: ReactionAttributesType;
}): boolean {
  return (
    reaction.source === ReactionSource.FromSomeoneElse &&
    isOutgoing(targetMessage)
  );
}

async function doesMessageWarrantNotification({
  message,
  conversation,
}: {
  message: MessageAttributesType;
  conversation: ConversationModel;
}): Promise<boolean> {
  if (!isIncoming(message)) {
    return false;
  }

  if (!isMessageUnread(message)) {
    return false;
  }

  if (
    message.storyId &&
    !(await shouldStoryReplyNotifyUser(message, conversation))
  ) {
    return false;
  }

  return true;
}

function isAllowedByConversation(args: MaybeNotifyArgs): boolean {
  const { conversation, reaction } = args;

  if (!conversation.isMuted()) {
    return true;
  }

  if (reaction) {
    return false;
  }

  if (conversation.get('dontNotifyForMentionsIfMuted')) {
    return false;
  }

  return args.message.mentionsMe === true;
}
