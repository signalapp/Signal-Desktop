// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { v7 as generateUuid } from 'uuid';
import {
  conversationJobQueue,
  conversationQueueJobEnum,
} from '../jobs/conversationJobQueue.preload.js';
import { getMessageById } from '../messages/getMessageById.preload.js';
import {
  handlePollTerminate,
  PollSource,
  type PollTerminateAttributesType,
} from '../messageModifiers/Polls.preload.js';
import { isGroup } from '../util/whatTypeOfConversation.dom.js';
import { strictAssert } from '../util/assert.std.js';
import { createLogger } from '../logging/log.std.js';

const log = createLogger('enqueuePollTerminateForSend');

export async function enqueuePollTerminateForSend({
  messageId,
}: Readonly<{
  messageId: string;
}>): Promise<void> {
  const message = await getMessageById(messageId);
  strictAssert(message, 'enqueuePollTerminateForSend: no message found');

  const conversation = window.ConversationController.get(
    message.get('conversationId')
  );
  strictAssert(
    conversation,
    'enqueuePollTerminateForSend: No conversation extracted from target message'
  );
  strictAssert(
    isGroup(conversation.attributes),
    'enqueuePollTerminateForSend: conversation must be a group'
  );

  const ourId = window.ConversationController.getOurConversationIdOrThrow();
  const timestamp = Date.now();
  const targetTimestamp = message.get('sent_at');

  const terminate: PollTerminateAttributesType = {
    envelopeId: generateUuid(),
    removeFromMessageReceiverCache: () => undefined,
    fromConversationId: ourId,
    source: PollSource.FromThisDevice,
    targetTimestamp,
    receivedAtDate: timestamp,
    timestamp,
    expireTimer: conversation.get('expireTimer'),
    expirationStartTimestamp: Date.now(),
  };

  await handlePollTerminate(message, terminate, { shouldPersist: true });

  await conversationJobQueue.add(
    {
      type: conversationQueueJobEnum.enum.PollTerminate,
      conversationId: conversation.id,
      pollMessageId: messageId,
      targetTimestamp,
      revision: conversation.get('revision'),
    },
    async jobToInsert => {
      log.info(
        `Enqueueing poll terminate for poll ${messageId} with job ${jobToInsert.id}`
      );
      await window.MessageCache.saveMessage(message.attributes, {
        jobToInsert,
      });
    }
  );
}
