// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import noop from 'lodash/noop';
import { v7 as generateUuid } from 'uuid';

import { DataWriter } from '../sql/Client';
import type { MessageModel } from '../models/messages';
import type { ReactionAttributesType } from '../messageModifiers/Reactions';
import { ReactionSource } from './ReactionSource';
import { __DEPRECATED$getMessageById } from '../messages/getMessageById';
import { getSourceServiceId, isStory } from '../messages/helpers';
import { strictAssert } from '../util/assert';
import { isDirectConversation } from '../util/whatTypeOfConversation';
import { incrementMessageCounter } from '../util/incrementMessageCounter';
import { generateMessageId } from '../util/generateMessageId';
import { repeat, zipObject } from '../util/iterables';
import { getMessageSentTimestamp } from '../util/getMessageSentTimestamp';
import { isAciString } from '../util/isAciString';
import { SendStatus } from '../messages/MessageSendState';
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
  const message = await __DEPRECATED$getMessageById(
    messageId,
    'enqueueReactionForSend'
  );
  strictAssert(message, 'enqueueReactionForSend: no message found');

  const targetAuthorAci = getSourceServiceId(message.attributes);
  strictAssert(
    targetAuthorAci,
    `enqueueReactionForSend: message ${message.idForLogging()} had no source UUID`
  );
  strictAssert(
    isAciString(targetAuthorAci),
    `enqueueReactionForSend: message ${message.idForLogging()} had no source ACI`
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

  if (
    !isMessageAStory ||
    isDirectConversation(messageConversation.attributes)
  ) {
    log.info('Enabling profile sharing for reaction send');
    if (!messageConversation.get('profileSharing')) {
      messageConversation.set('profileSharing', true);
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
    storyReactionMessage = new window.Whisper.Message({
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

  await message.handleReaction(reaction, { storyMessage });
}
