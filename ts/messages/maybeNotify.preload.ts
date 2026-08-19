// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createLogger } from '../logging/log.std.ts';

import { isOutgoing } from './helpers.std.ts';
import { getAuthor } from './sources.preload.ts';

import type { ConversationModel } from '../models/conversations.preload.ts';
import { getActiveProfile } from '../state/selectors/notificationProfiles.dom.ts';
import { shouldNotify as shouldNotifyDuringNotificationProfile } from '../types/NotificationProfile.std.ts';
import { NotificationType } from '../types/notifications.std.ts';
import { isMessageUnread } from '../util/isMessageUnread.std.ts';
import { isDirectConversation } from '../util/whatTypeOfConversation.dom.ts';
import { isExpiringMessage } from '../types/Message2.preload.ts';
import { notificationService } from '../services/notifications.preload.ts';
import { getNotificationTextForMessage } from '../util/getNotificationTextForMessage.preload.ts';
import type { MessageAttributesType } from '../model-types.d.ts';
import type { ReactionAttributesType } from '../messageModifiers/Reactions.preload.ts';
import {
  type PollVoteAttributesType,
  PollSource,
} from '../messageModifiers/Polls.preload.ts';
import { shouldStoryReplyNotifyUser } from '../util/shouldStoryReplyNotifyUser.preload.ts';
import { ReactionSource } from '../reactions/ReactionSource.std.ts';
import { itemStorage } from '../textsecure/Storage.preload.ts';
import { missingCaseError } from '../util/missingCaseError.std.ts';

const log = createLogger('maybeNotify');

type ReactionNotifyData = Readonly<{
  kind: 'reaction';
  reaction: Readonly<ReactionAttributesType>;
  targetMessage: Readonly<MessageAttributesType>;
}>;

type PollVoteNotifyData = Readonly<{
  kind: 'pollVote';
  pollVote: Readonly<PollVoteAttributesType>;
  targetMessage: Readonly<MessageAttributesType>;
}>;

type PollTerminateNotifyData = Readonly<{
  kind: 'pollTerminate';
  pollSource: PollSource;
  pollTerminatorId: string;
  message: Readonly<MessageAttributesType>;
}>;

type DeliveryIssueNotifyData = Readonly<{
  kind: 'deliveryIssue';
  message: Readonly<MessageAttributesType>;
}>;

type NormalMessageNotifyData = Readonly<{
  kind: 'normalMessage';
  message: Readonly<MessageAttributesType>;
}>;

type NotifyData =
  | ReactionNotifyData
  | PollVoteNotifyData
  | PollTerminateNotifyData
  | DeliveryIssueNotifyData
  | NormalMessageNotifyData;

type MaybeNotifyArgs = {
  conversation: ConversationModel;
} & NotifyData;

function isMentionOrReply(args: MaybeNotifyArgs): boolean {
  if (
    args.kind === 'reaction' ||
    args.kind === 'pollVote' ||
    args.kind === 'pollTerminate'
  ) {
    return false;
  }

  if (args.message.mentionsMe) {
    return true;
  }

  const quoteAuthorAci = args.message.quote?.authorAci;
  if (quoteAuthorAci && itemStorage.user.isOurServiceId(quoteAuthorAci)) {
    return true;
  }

  return false;
}

export async function maybeNotify(args: MaybeNotifyArgs): Promise<void> {
  if (!notificationService.isEnabled) {
    return;
  }

  const { i18n } = window.SignalContext;

  const { conversation } = args;

  let warrantsNotification: boolean;
  if (args.kind === 'reaction') {
    warrantsNotification = doesReactionWarrantNotification({
      reaction: args.reaction,
      targetMessage: args.targetMessage,
    });
  } else if (args.kind === 'pollVote') {
    warrantsNotification = doesPollVoteWarrantNotification({
      pollVote: args.pollVote,
      targetMessage: args.targetMessage,
    });
  } else if (args.kind === 'pollTerminate') {
    warrantsNotification = doesPollTerminateWarrantNotification({
      pollSource: args.pollSource,
    });
  } else if (args.kind === 'deliveryIssue') {
    warrantsNotification = await doesMessageWarrantNotification({
      message: args.message,
      conversation,
    });
  } else if (args.kind === 'normalMessage') {
    warrantsNotification = await doesMessageWarrantNotification({
      message: args.message,
      conversation,
    });
  } else {
    throw missingCaseError(args);
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
      isMentionOrReply: isMentionOrReply(args),
    })
  ) {
    log.info('Would notify for message, but notification profile prevented it');
    return;
  }

  const conversationId = conversation.get('id');

  const isMessageInDirectConversation = isDirectConversation(
    conversation.attributes
  );

  let sender: ConversationModel | undefined;
  let messageForNotification: MessageAttributesType | undefined;

  if (args.kind === 'reaction') {
    sender = window.ConversationController.get(args.reaction.fromId);
    messageForNotification = args.targetMessage;
  } else if (args.kind === 'pollVote') {
    sender = window.ConversationController.get(
      args.pollVote.fromConversationId
    );
    messageForNotification = args.targetMessage;
  } else if (args.kind === 'pollTerminate') {
    sender = window.ConversationController.get(args.pollTerminatorId);
    messageForNotification = args.message;
  } else if (args.kind === 'deliveryIssue') {
    sender = getAuthor(args.message);
    messageForNotification = args.message;
  } else if (args.kind === 'normalMessage') {
    sender = getAuthor(args.message);
    messageForNotification = args.message;
  } else {
    throw missingCaseError(args);
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
    reaction:
      args.kind === 'reaction'
        ? {
            emoji: args.reaction.emoji,
            targetAuthorAci: args.reaction.targetAuthorAci,
            targetTimestamp: args.reaction.targetTimestamp,
          }
        : undefined,
    pollVote:
      args.kind === 'pollVote'
        ? {
            voterConversationId: args.pollVote.fromConversationId,
            targetAuthorAci: args.pollVote.targetAuthorAci,
            targetTimestamp: args.pollVote.targetTimestamp,
          }
        : undefined,
    sentAt: messageForNotification.timestamp,
    type:
      args.kind === 'reaction'
        ? NotificationType.Reaction
        : NotificationType.Message,
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

function doesPollTerminateWarrantNotification({
  pollSource,
}: {
  pollSource: Readonly<PollSource>;
}): boolean {
  return pollSource === PollSource.FromSomeoneElse;
}

async function doesMessageWarrantNotification({
  message,
  conversation,
}: {
  message: MessageAttributesType;
  conversation: ConversationModel;
}): Promise<boolean> {
  if (message.type !== 'incoming') {
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

  return isMentionOrReply(args);
}
