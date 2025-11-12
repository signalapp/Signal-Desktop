// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createLogger } from '../logging/log.std.js';

import { isOutgoing } from './helpers.std.js';
import { getAuthor } from './sources.preload.js';

import type { ConversationModel } from '../models/conversations.preload.js';
import { getActiveProfile } from '../state/selectors/notificationProfiles.dom.js';
import { shouldNotify as shouldNotifyDuringNotificationProfile } from '../types/NotificationProfile.std.js';
import { NotificationType } from '../types/notifications.std.js';
import { isMessageUnread } from '../util/isMessageUnread.std.js';
import { isDirectConversation } from '../util/whatTypeOfConversation.dom.js';
import { isExpiringMessage } from '../types/Message2.preload.js';
import { notificationService } from '../services/notifications.preload.js';
import { getNotificationTextForMessage } from '../util/getNotificationTextForMessage.preload.js';
import type { MessageAttributesType } from '../model-types.d.ts';
import type { ReactionAttributesType } from '../messageModifiers/Reactions.preload.js';
import {
  type PollVoteAttributesType,
  PollSource,
} from '../messageModifiers/Polls.preload.js';
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
  | {
      pollVote: Readonly<PollVoteAttributesType>;
      targetMessage: Readonly<MessageAttributesType>;
    }
  | {
      message: Readonly<MessageAttributesType>;
      reaction?: never;
      pollVote?: never;
    }
);

function isMention(args: MaybeNotifyArgs): boolean {
  if ('reaction' in args || 'pollVote' in args) {
    return false;
  }
  return Boolean(args.message.mentionsMe);
}

export async function maybeNotify(args: MaybeNotifyArgs): Promise<void> {
  if (!notificationService.isEnabled) {
    return;
  }

  const { i18n } = window.SignalContext;

  const { conversation } = args;
  const reaction = 'reaction' in args ? args.reaction : undefined;
  const pollVote = 'pollVote' in args ? args.pollVote : undefined;

  let warrantsNotification: boolean;
  if ('reaction' in args && 'targetMessage' in args) {
    warrantsNotification = doesReactionWarrantNotification({
      reaction: args.reaction,
      targetMessage: args.targetMessage,
    });
  } else if ('pollVote' in args && 'targetMessage' in args) {
    warrantsNotification = doesPollVoteWarrantNotification({
      pollVote: args.pollVote,
      targetMessage: args.targetMessage,
    });
  } else {
    warrantsNotification = await doesMessageWarrantNotification({
      message: args.message,
      conversation,
    });
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
      isMention: isMention(args),
    })
  ) {
    log.info('Would notify for message, but notification profile prevented it');
    return;
  }

  const conversationId = conversation.get('id');
  const messageForNotification =
    'targetMessage' in args ? args.targetMessage : args.message;
  const isMessageInDirectConversation = isDirectConversation(
    conversation.attributes
  );

  let sender: ConversationModel | undefined;
  if (reaction) {
    sender = window.ConversationController.get(reaction.fromId);
  } else if (pollVote) {
    sender = window.ConversationController.get(pollVote.fromConversationId);
  } else if ('message' in args) {
    sender = getAuthor(args.message);
  }
  const senderName = sender ? sender.getTitle() : i18n('icu:unknownContact');
  const senderTitle = isMessageInDirectConversation
    ? senderName
    : i18n('icu:notificationSenderInGroup', {
        sender: senderName,
        group: conversation.getTitle(),
      });

  const { url, absolutePath } = await conversation.getAvatarOrIdenticon();

  const messageId = messageForNotification.id;

  notificationService.add({
    senderTitle,
    conversationId,
    storyId: isMessageInDirectConversation
      ? undefined
      : messageForNotification.storyId,
    notificationIconUrl: url,
    notificationIconAbsolutePath: absolutePath,
    isExpiringMessage: isExpiringMessage(messageForNotification),
    message: getNotificationTextForMessage(messageForNotification),
    messageId,
    reaction: reaction
      ? {
          emoji: reaction.emoji,
          targetAuthorAci: reaction.targetAuthorAci,
          targetTimestamp: reaction.targetTimestamp,
        }
      : undefined,
    pollVote: pollVote
      ? {
          voterConversationId: pollVote.fromConversationId,
          targetAuthorAci: pollVote.targetAuthorAci,
          targetTimestamp: pollVote.targetTimestamp,
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

function doesPollVoteWarrantNotification({
  pollVote,
  targetMessage,
}: {
  targetMessage: MessageAttributesType;
  pollVote: PollVoteAttributesType;
}): boolean {
  return (
    pollVote.source === PollSource.FromSomeoneElse && isOutgoing(targetMessage)
  );
}

async function doesMessageWarrantNotification({
  message,
  conversation,
}: {
  message: MessageAttributesType;
  conversation: ConversationModel;
}): Promise<boolean> {
  if (!(message.type === 'incoming' || message.type === 'poll-terminate')) {
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
  const { conversation } = args;

  if (!conversation.isMuted()) {
    return true;
  }

  if (conversation.get('dontNotifyForMentionsIfMuted')) {
    return false;
  }

  return isMention(args);
}
