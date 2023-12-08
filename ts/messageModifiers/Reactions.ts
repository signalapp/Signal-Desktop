// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { AciString } from '../types/ServiceId';
import type { ConversationModel } from '../models/conversations';
import type { MessageAttributesType } from '../model-types.d';
import type { MessageModel } from '../models/messages';
import type { ReactionSource } from '../reactions/ReactionSource';
import * as Errors from '../types/errors';
import * as log from '../logging/log';
import { getContactId, getContact } from '../messages/helpers';
import { getMessageIdForLogging } from '../util/idForLogging';
import { getMessageSentTimestampSet } from '../util/getMessageSentTimestampSet';
import { isDirectConversation, isMe } from '../util/whatTypeOfConversation';
import { isOutgoing, isStory } from '../state/selectors/message';
import { strictAssert } from '../util/assert';

export type ReactionAttributesType = {
  emoji: string;
  envelopeId: string;
  fromId: string;
  remove?: boolean;
  removeFromMessageReceiverCache: () => unknown;
  source: ReactionSource;
  // Necessary to put 1:1 story replies into the right conversation - not the same
  //   conversation as the target message!
  storyReactionMessage?: MessageModel;
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

export function forMessage(
  message: MessageModel
): Array<ReactionAttributesType> {
  const logId = `Reactions.forMessage(${getMessageIdForLogging(
    message.attributes
  )})`;

  const reactionValues = Array.from(reactions.values());
  const sentTimestamps = getMessageSentTimestampSet(message.attributes);
  if (isOutgoing(message.attributes)) {
    const outgoingReactions = reactionValues.filter(item =>
      sentTimestamps.has(item.targetTimestamp)
    );

    if (outgoingReactions.length > 0) {
      log.info(`${logId}: Found early reaction for outgoing message`);
      outgoingReactions.forEach(item => {
        remove(item);
      });
      return outgoingReactions;
    }
  }

  const senderId = getContactId(message.attributes);
  const reactionsBySource = reactionValues.filter(re => {
    const targetSender = window.ConversationController.lookupOrCreate({
      serviceId: re.targetAuthorAci,
      reason: logId,
    });
    return (
      targetSender?.id === senderId && sentTimestamps.has(re.targetTimestamp)
    );
  });

  if (reactionsBySource.length > 0) {
    log.info(`${logId}: Found early reaction for message`);
    reactionsBySource.forEach(item => {
      remove(item);
      item.removeFromMessageReceiverCache();
    });
    return reactionsBySource;
  }

  return [];
}

async function findMessage(
  targetTimestamp: number,
  targetConversationId: string
): Promise<MessageAttributesType | undefined> {
  const messages = await window.Signal.Data.getMessagesBySentAt(
    targetTimestamp
  );

  return messages.find(m => {
    const contact = getContact(m);

    if (!contact) {
      return false;
    }

    const mcid = contact.get('id');
    return mcid === targetConversationId;
  });
}

export async function onReaction(
  reaction: ReactionAttributesType
): Promise<void> {
  reactions.set(reaction.envelopeId, reaction);

  const logId = `Reactions.onReaction(timestamp=${reaction.timestamp};target=${reaction.targetTimestamp})`;

  try {
    // The conversation the target message was in; we have to find it in the database
    //   to to figure that out.
    const targetAuthorConversation =
      window.ConversationController.lookupOrCreate({
        serviceId: reaction.targetAuthorAci,
        reason: logId,
      });
    const targetConversationId = targetAuthorConversation?.id;
    if (!targetConversationId) {
      throw new Error(
        `${logId} Error: No conversationId returned from lookupOrCreate!`
      );
    }

    const generatedMessage = reaction.storyReactionMessage;
    strictAssert(
      generatedMessage,
      `${logId} strictAssert: Story reactions must provide storyReactionMessage`
    );
    const fromConversation = window.ConversationController.get(
      generatedMessage.get('conversationId')
    );

    let targetConversation: ConversationModel | undefined | null;

    const targetMessageCheck = await findMessage(
      reaction.targetTimestamp,
      targetConversationId
    );
    if (!targetMessageCheck) {
      log.info(
        `${logId}: No message for reaction`,
        'targeting',
        reaction.targetAuthorAci
      );
      return;
    }

    if (
      fromConversation &&
      isStory(targetMessageCheck) &&
      isDirectConversation(fromConversation.attributes) &&
      !isMe(fromConversation.attributes)
    ) {
      targetConversation = fromConversation;
    } else {
      targetConversation =
        await window.ConversationController.getConversationForTargetMessage(
          targetConversationId,
          reaction.targetTimestamp
        );
    }

    if (!targetConversation) {
      log.info(
        `${logId}: No target conversation for reaction`,
        reaction.targetAuthorAci,
        reaction.targetTimestamp
      );
      remove(reaction);
      return undefined;
    }

    // awaiting is safe since `onReaction` is never called from inside the queue
    await targetConversation.queueJob('Reactions.onReaction', async () => {
      log.info(`${logId}: handling`);

      // Thanks TS.
      if (!targetConversation) {
        remove(reaction);
        return;
      }

      // Message is fetched inside the conversation queue so we have the
      // most recent data
      const targetMessage = await findMessage(
        reaction.targetTimestamp,
        targetConversationId
      );

      if (!targetMessage) {
        remove(reaction);
        return;
      }

      const message = window.MessageCache.__DEPRECATED$register(
        targetMessage.id,
        targetMessage,
        'Reactions.onReaction'
      );

      // Use the generated message in ts/background.ts to create a message
      // if the reaction is targeted at a story.
      if (!isStory(targetMessage)) {
        await message.handleReaction(reaction);
      } else {
        await generatedMessage.handleReaction(reaction, {
          storyMessage: targetMessage,
        });
      }

      remove(reaction);
    });
  } catch (error) {
    remove(reaction);
    log.error(`${logId} error:`, Errors.toLogFormat(error));
  }
}
