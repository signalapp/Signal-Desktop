// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { AciString } from '../types/ServiceId';
import type { MessageAttributesType } from '../model-types.d';
import type { MessageModel } from '../models/messages';
import type { ReactionSource } from '../reactions/ReactionSource';
import { DataReader } from '../sql/Client';
import * as Errors from '../types/errors';
import * as log from '../logging/log';
import { getAuthor } from '../messages/helpers';
import { getMessageSentTimestampSet } from '../util/getMessageSentTimestampSet';
import { isMe } from '../util/whatTypeOfConversation';
import { isStory } from '../state/selectors/message';
import { getPropForTimestamp } from '../util/editHelpers';
import { isSent } from '../messages/MessageSendState';
import { strictAssert } from '../util/assert';

export type ReactionAttributesType = {
  emoji: string;
  envelopeId: string;
  fromId: string;
  remove?: boolean;
  removeFromMessageReceiverCache: () => unknown;
  source: ReactionSource;
  // If this is a reaction to a 1:1 story, we can use this message, generated from the
  //   reaction message itself. Necessary to put 1:1 story replies into the right
  //   conversation - not the same conversation as the target message!
  generatedMessageForStoryReaction?: MessageModel;
  targetAuthorAci: AciString;
  targetTimestamp: number;
  timestamp: number;
  receivedAtDate: number;
};

const reactions = new Map<string, ReactionAttributesType>();

function remove(reaction: ReactionAttributesType): void {
  reactions.delete(reaction.envelopeId);
  reaction.removeFromMessageReceiverCache();
}

export function findReactionsForMessage(
  message: MessageModel
): Array<ReactionAttributesType> {
  const matchingReactions = Array.from(reactions.values()).filter(reaction => {
    return isMessageAMatchForReaction({
      message: message.attributes,
      targetTimestamp: reaction.targetTimestamp,
      targetAuthorAci: reaction.targetAuthorAci,
      reactionSenderConversationId: reaction.fromId,
    });
  });

  matchingReactions.forEach(reaction => remove(reaction));
  return matchingReactions;
}

async function findMessageForReaction({
  targetTimestamp,
  targetAuthorAci,
  reactionSenderConversationId,
  logId,
}: {
  targetTimestamp: number;
  targetAuthorAci: string;
  reactionSenderConversationId: string;
  logId: string;
}): Promise<MessageAttributesType | undefined> {
  const messages = await DataReader.getMessagesBySentAt(targetTimestamp);

  const matchingMessages = messages.filter(message =>
    isMessageAMatchForReaction({
      message,
      targetTimestamp,
      targetAuthorAci,
      reactionSenderConversationId,
    })
  );

  if (!matchingMessages.length) {
    return undefined;
  }

  if (matchingMessages.length > 1) {
    // This could theoretically happen given limitations in the reaction proto but
    // is very unlikely
    log.warn(
      `${logId}/findMessageForReaction: found ${matchingMessages.length} matching messages for the reaction!`
    );
  }

  return matchingMessages[0];
}

function isMessageAMatchForReaction({
  message,
  targetTimestamp,
  targetAuthorAci,
  reactionSenderConversationId,
}: {
  message: MessageAttributesType;
  targetTimestamp: number;
  targetAuthorAci: string;
  reactionSenderConversationId: string;
}): boolean {
  if (!getMessageSentTimestampSet(message).has(targetTimestamp)) {
    return false;
  }

  const targetAuthorConversation =
    window.ConversationController.get(targetAuthorAci);
  const reactionSenderConversation = window.ConversationController.get(
    reactionSenderConversationId
  );

  if (!targetAuthorConversation || !reactionSenderConversation) {
    return false;
  }

  const author = getAuthor(message);
  if (!author) {
    return false;
  }

  if (author.id !== targetAuthorConversation.id) {
    return false;
  }

  if (isMe(reactionSenderConversation.attributes)) {
    // I am either the recipient or sender of all the messages I know about!
    return true;
  }

  if (message.type === 'outgoing') {
    const sendStateByConversationId = getPropForTimestamp({
      log,
      message,
      prop: 'sendStateByConversationId',
      targetTimestamp,
    });

    const sendState =
      sendStateByConversationId?.[reactionSenderConversation.id];
    if (!sendState) {
      return false;
    }

    return isSent(sendState.status);
  }

  if (message.type === 'incoming') {
    const messageConversation = window.ConversationController.get(
      message.conversationId
    );
    if (!messageConversation) {
      return false;
    }

    const reactionSenderServiceId = reactionSenderConversation.getServiceId();
    return (
      reactionSenderServiceId != null &&
      messageConversation.hasMember(reactionSenderServiceId)
    );
  }

  return true;
}

export async function onReaction(
  reaction: ReactionAttributesType
): Promise<void> {
  reactions.set(reaction.envelopeId, reaction);

  const logId = `Reactions.onReaction(timestamp=${reaction.timestamp};target=${reaction.targetTimestamp})`;

  try {
    const matchingMessage = await findMessageForReaction({
      targetTimestamp: reaction.targetTimestamp,
      targetAuthorAci: reaction.targetAuthorAci,
      reactionSenderConversationId: reaction.fromId,
      logId,
    });

    if (!matchingMessage) {
      log.info(
        `${logId}: No message for reaction`,
        'targeting',
        reaction.targetAuthorAci
      );
      return;
    }

    const matchingMessageConversation = window.ConversationController.get(
      matchingMessage.conversationId
    );

    if (!matchingMessageConversation) {
      log.info(
        `${logId}: No target conversation for reaction`,
        reaction.targetAuthorAci,
        reaction.targetTimestamp
      );
      remove(reaction);
      return undefined;
    }

    // awaiting is safe since `onReaction` is never called from inside the queue
    await matchingMessageConversation.queueJob(
      'Reactions.onReaction',
      async () => {
        log.info(`${logId}: handling`);

        // Message is fetched inside the conversation queue so we have the
        // most recent data
        const targetMessage = await findMessageForReaction({
          targetTimestamp: reaction.targetTimestamp,
          targetAuthorAci: reaction.targetAuthorAci,
          reactionSenderConversationId: reaction.fromId,
          logId: `${logId}/conversationQueue`,
        });

        if (!targetMessage || targetMessage.id !== matchingMessage.id) {
          log.warn(
            `${logId}: message no longer a match for reaction! Maybe it's been deleted?`
          );
          remove(reaction);
          return;
        }

        const targetMessageModel = window.MessageCache.__DEPRECATED$register(
          targetMessage.id,
          targetMessage,
          'Reactions.onReaction'
        );

        // Use the generated message in ts/background.ts to create a message
        // if the reaction is targeted at a story.
        if (!isStory(targetMessage)) {
          await targetMessageModel.handleReaction(reaction);
        } else {
          const generatedMessage = reaction.generatedMessageForStoryReaction;
          strictAssert(
            generatedMessage,
            'Generated message must exist for story reaction'
          );
          await generatedMessage.handleReaction(reaction, {
            storyMessage: targetMessage,
          });
        }

        remove(reaction);
      }
    );
  } catch (error) {
    remove(reaction);
    log.error(`${logId} error:`, Errors.toLogFormat(error));
  }
}
