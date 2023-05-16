// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { ReactionModel } from '../messageModifiers/Reactions';
import { ReactionSource } from './ReactionSource';
import { getMessageById } from '../messages/getMessageById';
import { getSourceUuid, isStory } from '../messages/helpers';
import { strictAssert } from '../util/assert';
import { isDirectConversation } from '../util/whatTypeOfConversation';
import { incrementMessageCounter } from '../util/incrementMessageCounter';
import { repeat, zipObject } from '../util/iterables';
import { getMessageSentTimestamp } from '../util/getMessageSentTimestamp';
import { SendStatus } from '../messages/MessageSendState';
import { UUID } from '../types/UUID';
import * as log from '../logging/log';

export async function enqueueReactionForSend({
  emoji,
  messageId,
  remove,
}: Readonly<{
  emoji: string;
  messageId: string;
  remove: boolean;
}>): Promise<void> {
  const message = await getMessageById(messageId);
  strictAssert(message, 'enqueueReactionForSend: no message found');

  const targetAuthorUuid = getSourceUuid(message.attributes);
  strictAssert(
    targetAuthorUuid,
    `enqueueReactionForSend: message ${message.idForLogging()} had no source UUID`
  );

  const targetTimestamp = getMessageSentTimestamp(message.attributes, {
    log,
  });
  strictAssert(
    targetTimestamp,
    `enqueueReactionForSend: message ${message.idForLogging()} had no timestamp`
  );

  const timestamp = Date.now();
  const messageConversation = message.getConversation();
  strictAssert(
    messageConversation,
    'enqueueReactionForSend: No conversation extracted from target message'
  );

  const isMessageAStory = isStory(message.attributes);
  const targetConversation =
    isMessageAStory && isDirectConversation(messageConversation.attributes)
      ? window.ConversationController.get(targetAuthorUuid)
      : messageConversation;
  strictAssert(
    targetConversation,
    'enqueueReactionForSend: Did not find a targetConversation'
  );

  const expireTimer =
    !isMessageAStory || isDirectConversation(targetConversation.attributes)
      ? targetConversation.get('expireTimer')
      : undefined;
  const storyMessage = isStory(message.attributes)
    ? message.attributes
    : undefined;

  // Only used in story scenarios, where we use a whole message to represent the reaction
  const storyReactionMessage = storyMessage
    ? new window.Whisper.Message({
        id: UUID.generate().toString(),
        type: 'outgoing',
        conversationId: targetConversation.id,
        sent_at: timestamp,
        received_at: incrementMessageCounter(),
        received_at_ms: timestamp,
        timestamp,
        expireTimer,
        sendStateByConversationId: zipObject(
          targetConversation.getMemberConversationIds(),
          repeat({
            status: SendStatus.Pending,
            updatedAt: Date.now(),
          })
        ),
        storyId: message.id,
        storyReaction: {
          emoji,
          targetAuthorUuid,
          targetTimestamp,
        },
      })
    : undefined;

  const reaction = new ReactionModel({
    emoji,
    fromId: window.ConversationController.getOurConversationIdOrThrow(),
    remove,
    source: ReactionSource.FromThisDevice,
    storyReactionMessage,
    targetAuthorUuid,
    targetTimestamp,
    timestamp,
  });

  await message.handleReaction(reaction, { storyMessage });
}
