// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { maxBy } from 'lodash';

import type { AciString } from '../types/ServiceId';
import type {
  MessageAttributesType,
  MessageReactionType,
  ReadonlyMessageAttributesType,
} from '../model-types.d';
import { MessageModel } from '../models/messages';
import { ReactionSource } from '../reactions/ReactionSource';
import { DataReader, DataWriter } from '../sql/Client';
import * as Errors from '../types/errors';
import * as log from '../logging/log';
import { getAuthor, isIncoming, isOutgoing } from '../messages/helpers';
import { getMessageSentTimestampSet } from '../util/getMessageSentTimestampSet';
import { isDirectConversation, isMe } from '../util/whatTypeOfConversation';
import {
  getMessagePropStatus,
  hasErrors,
  isStory,
} from '../state/selectors/message';
import { getPropForTimestamp } from '../util/editHelpers';
import { isSent } from '../messages/MessageSendState';
import { strictAssert } from '../util/assert';
import { repeat, zipObject } from '../util/iterables';
import { getMessageIdForLogging } from '../util/idForLogging';
import { hydrateStoryContext } from '../util/hydrateStoryContext';
import { shouldReplyNotifyUser } from '../util/shouldReplyNotifyUser';
import { drop } from '../util/drop';
import * as reactionUtil from '../reactions/util';
import { isNewReactionReplacingPrevious } from '../reactions/util';
import { notificationService } from '../services/notifications';
import { ReactionReadStatus } from '../types/Reactions';
import type { ConversationQueueJobData } from '../jobs/conversationJobQueue';
import {
  conversationJobQueue,
  conversationQueueJobEnum,
} from '../jobs/conversationJobQueue';

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

const reactionCache = new Map<string, ReactionAttributesType>();

function remove(reaction: ReactionAttributesType): void {
  reactionCache.delete(reaction.envelopeId);
  reaction.removeFromMessageReceiverCache();
}

export function findReactionsForMessage(
  message: ReadonlyMessageAttributesType
): Array<ReactionAttributesType> {
  const matchingReactions = Array.from(reactionCache.values()).filter(
    reaction => {
      return isMessageAMatchForReaction({
        message,
        targetTimestamp: reaction.targetTimestamp,
        targetAuthorAci: reaction.targetAuthorAci,
        reactionSenderConversationId: reaction.fromId,
      });
    }
  );

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
  message: ReadonlyMessageAttributesType;
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
  reactionCache.set(reaction.envelopeId, reaction);

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

        const targetMessageModel = window.MessageCache.register(
          new MessageModel(targetMessage)
        );

        // Use the generated message in ts/background.ts to create a message
        // if the reaction is targeted at a story.
        if (!isStory(targetMessage)) {
          await handleReaction(targetMessageModel, reaction);
        } else {
          const generatedMessage = reaction.generatedMessageForStoryReaction;
          strictAssert(
            generatedMessage,
            'Generated message must exist for story reaction'
          );
          await handleReaction(generatedMessage, reaction, {
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

export async function handleReaction(
  message: MessageModel,
  reaction: ReactionAttributesType,
  {
    storyMessage,
    shouldPersist = true,
  }: {
    storyMessage?: MessageAttributesType;
    shouldPersist?: boolean;
  } = {}
): Promise<void> {
  const { attributes } = message;

  if (message.get('deletedForEveryone')) {
    return;
  }

  // We allow you to react to messages with outgoing errors only if it has sent
  //   successfully to at least one person.
  if (
    hasErrors(attributes) &&
    (isIncoming(attributes) ||
      getMessagePropStatus(
        attributes,
        window.ConversationController.getOurConversationIdOrThrow()
      ) !== 'partial-sent')
  ) {
    return;
  }

  const conversation = window.ConversationController.get(
    message.attributes.conversationId
  );
  if (!conversation) {
    return;
  }

  const isFromThisDevice = reaction.source === ReactionSource.FromThisDevice;
  const isFromSync = reaction.source === ReactionSource.FromSync;
  const isFromSomeoneElse = reaction.source === ReactionSource.FromSomeoneElse;
  strictAssert(
    isFromThisDevice || isFromSync || isFromSomeoneElse,
    'Reaction can only be from this device, from sync, or from someone else'
  );

  const newReaction: MessageReactionType = {
    emoji: reaction.remove ? undefined : reaction.emoji,
    fromId: reaction.fromId,
    targetTimestamp: reaction.targetTimestamp,
    timestamp: reaction.timestamp,
    isSentByConversationId: isFromThisDevice
      ? zipObject(conversation.getMemberConversationIds(), repeat(false))
      : undefined,
  };

  // Reactions to stories are saved as separate messages, and so require a totally
  //   different codepath.
  if (storyMessage) {
    if (isFromThisDevice) {
      log.info(
        'handleReaction: sending story reaction to ' +
          `${getMessageIdForLogging(storyMessage)} from this device`
      );
    } else {
      if (isFromSomeoneElse) {
        log.info(
          'handleReaction: receiving story reaction to ' +
            `${getMessageIdForLogging(storyMessage)} from someone else`
        );
      } else if (isFromSync) {
        log.info(
          'handleReaction: receiving story reaction to ' +
            `${getMessageIdForLogging(storyMessage)} from another device`
        );
      }

      const generatedMessage = reaction.generatedMessageForStoryReaction;
      strictAssert(
        generatedMessage,
        'Story reactions must provide storyReactionMessage'
      );
      const targetConversation = window.ConversationController.get(
        generatedMessage.get('conversationId')
      );
      strictAssert(
        targetConversation,
        'handleReaction: targetConversation not found'
      );

      window.MessageCache.register(generatedMessage);
      generatedMessage.set({
        expireTimer: isDirectConversation(targetConversation.attributes)
          ? targetConversation.get('expireTimer')
          : undefined,
        storyId: storyMessage.id,
        storyReaction: {
          emoji: reaction.emoji,
          targetAuthorAci: reaction.targetAuthorAci,
          targetTimestamp: reaction.targetTimestamp,
        },
      });

      await hydrateStoryContext(generatedMessage.id, storyMessage, {
        shouldSave: false,
      });
      // Note: generatedMessage comes with an id, so we have to force this save
      await window.MessageCache.saveMessage(generatedMessage.attributes, {
        forceSave: true,
      });

      log.info('Reactions.onReaction adding reaction to story', {
        reactionMessageId: getMessageIdForLogging(generatedMessage.attributes),
        storyId: getMessageIdForLogging(storyMessage),
        targetTimestamp: reaction.targetTimestamp,
        timestamp: reaction.timestamp,
      });

      window.MessageCache.register(generatedMessage);
      if (isDirectConversation(targetConversation.attributes)) {
        await targetConversation.addSingleMessage(generatedMessage.attributes);
        if (!targetConversation.get('active_at')) {
          targetConversation.set({
            active_at: generatedMessage.attributes.timestamp,
          });
          await DataWriter.updateConversation(targetConversation.attributes);
        }
      }

      if (isFromSomeoneElse) {
        log.info(
          'handleReaction: notifying for story reaction to ' +
            `${getMessageIdForLogging(storyMessage)} from someone else`
        );
        if (
          await shouldReplyNotifyUser(
            generatedMessage.attributes,
            targetConversation
          )
        ) {
          drop(targetConversation.notify(generatedMessage.attributes));
        }
      }
    }
  } else {
    // Reactions to all messages other than stories will update the target message
    const previousLength = (message.get('reactions') || []).length;

    if (isFromThisDevice) {
      log.info(
        `handleReaction: sending reaction to ${getMessageIdForLogging(message.attributes)} ` +
          'from this device'
      );

      const reactions = reactionUtil.addOutgoingReaction(
        message.get('reactions') || [],
        newReaction
      );
      message.set({ reactions });
    } else {
      const oldReactions = message.get('reactions') || [];
      let reactions: Array<MessageReactionType>;
      const oldReaction = oldReactions.find(re =>
        isNewReactionReplacingPrevious(re, newReaction)
      );
      if (oldReaction) {
        notificationService.removeBy({
          ...oldReaction,
          messageId: message.id,
        });
      }

      if (reaction.remove) {
        log.info(
          'handleReaction: removing reaction for message',
          getMessageIdForLogging(message.attributes)
        );

        if (isFromSync) {
          reactions = oldReactions.filter(
            re =>
              !isNewReactionReplacingPrevious(re, newReaction) ||
              re.timestamp > reaction.timestamp
          );
        } else {
          reactions = oldReactions.filter(
            re => !isNewReactionReplacingPrevious(re, newReaction)
          );
        }
        message.set({ reactions });
      } else {
        log.info(
          'handleReaction: adding reaction for message',
          getMessageIdForLogging(message.attributes)
        );

        let reactionToAdd: MessageReactionType;
        if (isFromSync) {
          const ourReactions = [
            newReaction,
            ...oldReactions.filter(re => re.fromId === reaction.fromId),
          ];
          reactionToAdd = maxBy(ourReactions, 'timestamp') || newReaction;
        } else {
          reactionToAdd = newReaction;
        }

        reactions = oldReactions.filter(
          re => !isNewReactionReplacingPrevious(re, reaction)
        );
        reactions.push(reactionToAdd);
        message.set({ reactions });

        if (isOutgoing(message.attributes) && isFromSomeoneElse) {
          void conversation.notify(message.attributes, reaction);
        }
      }
    }

    if (reaction.remove) {
      await DataWriter.removeReactionFromConversation({
        emoji: reaction.emoji,
        fromId: reaction.fromId,
        targetAuthorServiceId: reaction.targetAuthorAci,
        targetTimestamp: reaction.targetTimestamp,
      });
    } else {
      await DataWriter.addReaction(
        {
          conversationId: message.get('conversationId'),
          emoji: reaction.emoji,
          fromId: reaction.fromId,
          messageId: message.id,
          messageReceivedAt: message.get('received_at'),
          targetAuthorAci: reaction.targetAuthorAci,
          targetTimestamp: reaction.targetTimestamp,
          timestamp: reaction.timestamp,
        },
        {
          readStatus: isFromThisDevice
            ? ReactionReadStatus.Read
            : ReactionReadStatus.Unread,
        }
      );
    }

    const currentLength = (message.get('reactions') || []).length;
    log.info(
      'handleReaction:',
      `Done processing reaction for message ${getMessageIdForLogging(message.attributes)}.`,
      `Went from ${previousLength} to ${currentLength} reactions.`
    );
  }

  if (isFromThisDevice) {
    let jobData: ConversationQueueJobData;
    if (storyMessage) {
      strictAssert(
        newReaction.emoji !== undefined,
        'New story reaction must have an emoji'
      );

      const generatedMessage = reaction.generatedMessageForStoryReaction;
      strictAssert(
        generatedMessage,
        'Story reactions must provide storyReactionmessage'
      );

      await hydrateStoryContext(generatedMessage.id, message.attributes, {
        shouldSave: false,
      });
      await window.MessageCache.saveMessage(generatedMessage.attributes, {
        forceSave: true,
      });

      window.MessageCache.register(generatedMessage);

      void conversation.addSingleMessage(generatedMessage.attributes);

      jobData = {
        type: conversationQueueJobEnum.enum.NormalMessage,
        conversationId: conversation.id,
        messageId: generatedMessage.id,
        revision: conversation.get('revision'),
      };
    } else {
      jobData = {
        type: conversationQueueJobEnum.enum.Reaction,
        conversationId: conversation.id,
        messageId: message.id,
        revision: conversation.get('revision'),
      };
    }
    if (shouldPersist) {
      await conversationJobQueue.add(jobData, async jobToInsert => {
        log.info(
          `enqueueReactionForSend: saving message ${getMessageIdForLogging(message.attributes)} and job ${
            jobToInsert.id
          }`
        );
        await window.MessageCache.saveMessage(message.attributes, {
          jobToInsert,
        });
      });
    } else {
      await conversationJobQueue.add(jobData);
    }
  } else if (shouldPersist && !isStory(message.attributes)) {
    await window.MessageCache.saveMessage(message.attributes);
    window.reduxActions.conversations.markOpenConversationRead(conversation.id);
  }
}
