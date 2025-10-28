// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import noop from 'lodash/noop.js';
import { v7 as generateUuid } from 'uuid';

import { DataWriter } from '../sql/Client.preload.js';
import { MessageModel } from '../models/messages.preload.js';
import {
  handleReaction,
  type ReactionAttributesType,
} from '../messageModifiers/Reactions.preload.js';
import { ReactionSource } from './ReactionSource.std.js';
import { getMessageById } from '../messages/getMessageById.preload.js';
import { getSourceServiceId } from '../messages/sources.preload.js';
import { isStory } from '../messages/helpers.std.js';
import { strictAssert } from '../util/assert.std.js';
import { isDirectConversation } from '../util/whatTypeOfConversation.dom.js';
import { incrementMessageCounter } from '../util/incrementMessageCounter.preload.js';
import { generateMessageId } from '../util/generateMessageId.node.js';
import { repeat, zipObject } from '../util/iterables.std.js';
import { getMessageSentTimestamp } from '../util/getMessageSentTimestamp.std.js';
import { isAciString } from '../util/isAciString.std.js';
import { SendStatus } from '../messages/MessageSendState.std.js';
import { createLogger } from '../logging/log.std.js';
import { getMessageIdForLogging } from '../util/idForLogging.preload.js';

const log = createLogger('enqueueReactionForSend');

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

  const targetAuthorAci = getSourceServiceId(message.attributes);
  strictAssert(
    targetAuthorAci,
    `enqueueReactionForSend: message ${getMessageIdForLogging(message.attributes)} had no source UUID`
  );
  strictAssert(
    isAciString(targetAuthorAci),
    `enqueueReactionForSend: message ${getMessageIdForLogging(message.attributes)} had no source ACI`
  );

  const targetTimestamp = getMessageSentTimestamp(message.attributes, {
    log,
  });
  strictAssert(
    targetTimestamp,
    `enqueueReactionForSend: message ${getMessageIdForLogging(message.attributes)} had no timestamp`
  );

  const timestamp = Date.now();
  const messageConversation = window.ConversationController.get(
    message.get('conversationId')
  );
  strictAssert(
    messageConversation,
    'enqueueReactionForSend: No conversation extracted from target message'
  );

  const isMessageAStory = isStory(message.attributes);

  if (
    !isMessageAStory ||
    isDirectConversation(messageConversation.attributes)
  ) {
    log.info('Enabling profile sharing for reaction send');
    if (!messageConversation.get('profileSharing')) {
      messageConversation.set({ profileSharing: true });
      await DataWriter.updateConversation(messageConversation.attributes);
    }
    await messageConversation.restoreContact();
  }

  const targetConversation =
    isMessageAStory && isDirectConversation(messageConversation.attributes)
      ? window.ConversationController.get(targetAuthorAci)
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
  let storyReactionMessage: MessageModel | undefined;
  if (storyMessage) {
    storyReactionMessage = new MessageModel({
      ...generateMessageId(incrementMessageCounter()),
      type: 'outgoing',
      conversationId: targetConversation.id,
      sent_at: timestamp,
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
        targetAuthorAci,
        targetTimestamp,
      },
    });
  }

  const reaction: ReactionAttributesType = {
    envelopeId: generateUuid(),
    removeFromMessageReceiverCache: noop,
    emoji,
    fromId: window.ConversationController.getOurConversationIdOrThrow(),
    remove,
    source: ReactionSource.FromThisDevice,
    generatedMessageForStoryReaction: storyReactionMessage,
    targetAuthorAci,
    targetTimestamp,
    receivedAtDate: timestamp,
    timestamp,
  };

  await handleReaction(message, reaction, { storyMessage });
}
