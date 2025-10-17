// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationAttributesType } from '../model-types.d.ts';
import type { ConversationQueueJobData } from '../jobs/conversationJobQueue.preload.js';
import * as Errors from '../types/errors.std.js';
import { DAY } from './durations/index.std.js';
import { createLogger } from '../logging/log.std.js';
import {
  conversationJobQueue,
  conversationQueueJobEnum,
} from '../jobs/conversationJobQueue.preload.js';
import { deleteForEveryone } from './deleteForEveryone.preload.js';
import {
  getConversationIdForLogging,
  getMessageIdForLogging,
} from './idForLogging.preload.js';
import { getMessageById } from '../messages/getMessageById.preload.js';
import { getRecipientConversationIds } from './getRecipientConversationIds.dom.js';
import { getRecipients } from './getRecipients.dom.js';
import { repeat, zipObject } from './iterables.std.js';
import { isMe } from './whatTypeOfConversation.dom.js';

const log = createLogger('sendDeleteForEveryoneMessage');

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
    `enqueuing DeleteForEveryone: ${idForLogging} ` +
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
        `Deleting message ${idForLogging} ` +
          `in conversation ${conversationIdForLogging} with job ${jobToInsert.id}`
      );
      await window.MessageCache.saveMessage(message.attributes, {
        jobToInsert,
      });
    });
  } catch (error) {
    log.error(
      `Failed to queue delete for everyone for message ${idForLogging}`,
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
