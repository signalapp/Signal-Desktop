// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as log from '../logging/log';
import * as Errors from '../types/errors';

import type { ConversationQueueJobData } from '../jobs/conversationJobQueue';
import {
  conversationJobQueue,
  conversationQueueJobEnum,
} from '../jobs/conversationJobQueue';
import { isOlderThan } from './timestamp';
import { DAY } from './durations';

export async function retryDeleteForEveryone(messageId: string): Promise<void> {
  const message = window.MessageController.getById(messageId);
  if (!message) {
    throw new Error(`retryDeleteForEveryone: Message ${messageId} missing!`);
  }

  if (isOlderThan(message.get('sent_at'), DAY)) {
    throw new Error(
      'retryDeleteForEveryone: Message too old to retry delete for everyone!'
    );
  }

  try {
    const conversation = message.getConversation();
    if (!conversation) {
      throw new Error(
        `retryDeleteForEveryone: Conversation for ${messageId} missing!`
      );
    }

    const jobData: ConversationQueueJobData = {
      type: conversationQueueJobEnum.enum.DeleteForEveryone,
      conversationId: conversation.id,
      messageId,
      recipients: conversation.getRecipients(),
      revision: conversation.get('revision'),
      targetTimestamp: message.get('sent_at'),
    };

    log.info(
      `retryDeleteForEveryone: Adding job for message ${message.idForLogging()}!`
    );
    await conversationJobQueue.add(jobData);
  } catch (error) {
    log.error(
      'retryDeleteForEveryone: Failed to queue delete for everyone',
      Errors.toLogFormat(error)
    );
    throw error;
  }
}
