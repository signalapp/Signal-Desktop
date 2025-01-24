// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationAttributesType } from '../model-types.d';
import type { ConversationQueueJobData } from '../jobs/conversationJobQueue';
import * as Errors from '../types/errors';
import { DAY } from './durations';
import * as log from '../logging/log';
import {
  conversationJobQueue,
  conversationQueueJobEnum,
} from '../jobs/conversationJobQueue';
import { deleteForEveryone } from './deleteForEveryone';
import {
  getConversationIdForLogging,
  getMessageIdForLogging,
} from './idForLogging';
import { getMessageById } from '../messages/getMessageById';
import { getRecipientConversationIds } from './getRecipientConversationIds';
import { getRecipients } from './getRecipients';
import { repeat, zipObject } from './iterables';
import { isMe } from './whatTypeOfConversation';

export async function sendDeleteForEveryoneMessage(
  conversationAttributes: ConversationAttributesType,
  options: {
    deleteForEveryoneDuration?: number;
    id: string;
    timestamp: number;
  }
): Promise<void> {
  const {
    deleteForEveryoneDuration,
    timestamp: targetTimestamp,
    id: messageId,
  } = options;
  const message = await getMessageById(messageId);
  if (!message) {
    throw new Error('sendDeleteForEveryoneMessage: Cannot find message!');
  }
  const idForLogging = getMessageIdForLogging(message.attributes);

  // If conversation is a Note To Self, no deletion time limits apply.
  if (!isMe(conversationAttributes)) {
    const timestamp = Date.now();
    const maxDuration = deleteForEveryoneDuration || DAY;
    if (timestamp - targetTimestamp > maxDuration) {
      throw new Error(
        `Cannot send DOE for a message older than ${maxDuration}`
      );
    }
  }

  message.set({
    deletedForEveryoneSendStatus: zipObject(
      getRecipientConversationIds(conversationAttributes),
      repeat(false)
    ),
  });

  const conversationIdForLogging = getConversationIdForLogging(
    conversationAttributes
  );

  log.info(
    `sendDeleteForEveryoneMessage: enqueuing DeleteForEveryone: ${idForLogging} ` +
      `in conversation ${conversationIdForLogging}`
  );

  try {
    const jobData: ConversationQueueJobData = {
      type: conversationQueueJobEnum.enum.DeleteForEveryone,
      conversationId: conversationAttributes.id,
      messageId,
      recipients: getRecipients(conversationAttributes),
      revision: conversationAttributes.revision,
      targetTimestamp,
    };
    await conversationJobQueue.add(jobData, async jobToInsert => {
      log.info(
        `sendDeleteForEveryoneMessage: Deleting message ${idForLogging} ` +
          `in conversation ${conversationIdForLogging} with job ${jobToInsert.id}`
      );
      await window.MessageCache.saveMessage(message.attributes, {
        jobToInsert,
      });
    });
  } catch (error) {
    log.error(
      `sendDeleteForEveryoneMessage: Failed to queue delete for everyone for message ${idForLogging}`,
      Errors.toLogFormat(error)
    );
    throw error;
  }

  await deleteForEveryone(message, {
    targetSentTimestamp: targetTimestamp,
    serverTimestamp: Date.now(),
    fromId: window.ConversationController.getOurConversationIdOrThrow(),
  });
}
