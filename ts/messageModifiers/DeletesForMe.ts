// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as log from '../logging/log';
import * as Errors from '../types/errors';
import { drop } from '../util/drop';
import { getMessageSentTimestampSet } from '../util/getMessageSentTimestampSet';

import type { MessageAttributesType } from '../model-types';
import type {
  ConversationToDelete,
  MessageToDelete,
} from '../textsecure/messageReceiverEvents';
import {
  deleteMessage,
  doesMessageMatch,
  getConversationFromTarget,
  getMessageQueryFromTarget,
} from '../util/deleteForMe';
import dataInterface from '../sql/Client';

const { removeSyncTaskById } = dataInterface;

export type DeleteForMeAttributesType = {
  conversation: ConversationToDelete;
  envelopeId: string;
  message: MessageToDelete;
  syncTaskId: string;
  timestamp: number;
};

const deletes = new Map<string, DeleteForMeAttributesType>();

async function remove(item: DeleteForMeAttributesType): Promise<void> {
  await removeSyncTaskById(item.syncTaskId);
  deletes.delete(item.envelopeId);
}

export async function forMessage(
  messageAttributes: MessageAttributesType
): Promise<Array<DeleteForMeAttributesType>> {
  const sentTimestamps = getMessageSentTimestampSet(messageAttributes);
  const deleteValues = Array.from(deletes.values());

  const matchingDeletes = deleteValues.filter(item => {
    const itemConversation = getConversationFromTarget(item.conversation);
    const query = getMessageQueryFromTarget(item.message);

    if (!itemConversation) {
      return false;
    }

    return doesMessageMatch({
      conversationId: itemConversation.id,
      message: messageAttributes,
      query,
      sentTimestamps,
    });
  });

  if (!matchingDeletes.length) {
    return [];
  }

  log.info('Found early DeleteForMe for message');
  await Promise.all(
    matchingDeletes.map(async item => {
      await remove(item);
    })
  );
  return matchingDeletes;
}

export async function onDelete(item: DeleteForMeAttributesType): Promise<void> {
  try {
    const conversation = getConversationFromTarget(item.conversation);
    const message = getMessageQueryFromTarget(item.message);

    const logId = `DeletesForMe.onDelete(sentAt=${message.sentAt},timestamp=${item.timestamp},envelopeId=${item.envelopeId})`;

    deletes.set(item.envelopeId, item);

    if (!conversation) {
      log.warn(`${logId}: Conversation not found!`);
      await remove(item);
      return;
    }

    // Do not await, since this a can deadlock the queue
    drop(
      conversation.queueJob('DeletesForMe.onDelete', async () => {
        log.info(`${logId}: Starting...`);

        const result = await deleteMessage(
          conversation.id,
          item.message,
          logId
        );
        if (result) {
          await remove(item);
        }

        log.info(`${logId}: Complete (result=${result})`);
      })
    );
  } catch (error) {
    log.error(
      `DeletesForMe.onDelete(task=${item.syncTaskId},envelopeId=${item.envelopeId}): Error`,
      Errors.toLogFormat(error)
    );
    await remove(item);
  }
}
