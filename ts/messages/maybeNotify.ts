// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createLogger } from '../logging/log';

import { getAuthor, isIncoming, isOutgoing } from './helpers';

import type { ConversationModel } from '../models/conversations';
import { getActiveProfile } from '../state/selectors/notificationProfiles';
import { shouldNotify as shouldNotifyDuringNotificationProfile } from '../types/NotificationProfile';
import { isMessageUnread } from '../util/isMessageUnread';
import { isDirectConversation } from '../util/whatTypeOfConversation';
import { hasExpiration } from '../types/Message2';
import {
  notificationService,
  NotificationType,
} from '../services/notifications';
import { getNotificationTextForMessage } from '../util/getNotificationTextForMessage';
import type { MessageAttributesType } from '../model-types';
import type { ReactionAttributesType } from '../messageModifiers/Reactions';
import { shouldStoryReplyNotifyUser } from '../util/shouldStoryReplyNotifyUser';
import { ReactionSource } from '../reactions/ReactionSource';

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
  const senderName = sender
    ? sender.getTitle()
    : window.i18n('icu:unknownContact');
  const senderTitle = isMessageInDirectConversation
    ? senderName
    : window.i18n('icu:notificationSenderInGroup', {
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
