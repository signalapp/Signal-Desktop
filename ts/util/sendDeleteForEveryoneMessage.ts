// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationAttributesType } from '../model-types.d';
import type { ConversationQueueJobData } from '../jobs/conversationJobQueue';
import * as Errors from '../types/errors';
import * as durations from './durations';
import * as log from '../logging/log';
import { DeleteModel } from '../messageModifiers/Deletes';
import {
  conversationJobQueue,
  conversationQueueJobEnum,
} from '../jobs/conversationJobQueue';
import { deleteForEveryone } from './deleteForEveryone';
import { getConversationIdForLogging } from './idForLogging';
import { getMessageById } from '../messages/getMessageById';
import { getRecipientConversationIds } from './getRecipientConversationIds';
import { getRecipients } from './getRecipients';
import { repeat, zipObject } from './iterables';

const THREE_HOURS = durations.HOUR * 3;

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
  const messageModel = window.MessageController.register(messageId, message);

  const timestamp = Date.now();
  if (
    timestamp - targetTimestamp >
    (deleteForEveryoneDuration || THREE_HOURS)
  ) {
    throw new Error('Cannot send DOE for a message older than three hours');
  }

  messageModel.set({
    deletedForEveryoneSendStatus: zipObject(
      getRecipientConversationIds(conversationAttributes),
      repeat(false)
    ),
  });

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
      const idForLogging = getConversationIdForLogging(conversationAttributes);
      log.info(
        `sendDeleteForEveryoneMessage: saving message ${idForLogging} and job ${jobToInsert.id}`
      );
      await window.Signal.Data.saveMessage(messageModel.attributes, {
        jobToInsert,
        ourUuid: window.textsecure.storage.user.getCheckedUuid().toString(),
      });
    });
  } catch (error) {
    log.error(
      'sendDeleteForEveryoneMessage: Failed to queue delete for everyone',
      Errors.toLogFormat(error)
    );
    throw error;
  }

  const deleteModel = new DeleteModel({
    targetSentTimestamp: targetTimestamp,
    serverTimestamp: Date.now(),
    fromId: window.ConversationController.getOurConversationIdOrThrow(),
  });
  await deleteForEveryone(messageModel, deleteModel);
}
