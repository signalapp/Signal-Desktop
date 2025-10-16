// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createLogger } from '../logging/log.std.js';
import * as Errors from '../types/errors.std.js';
import { drop } from '../util/drop.std.js';
import { getMessageSentTimestampSet } from '../util/getMessageSentTimestampSet.std.js';

import type { MessageAttributesType } from '../model-types.d.ts';
import type {
  ConversationIdentifier,
  AddressableMessage,
} from '../textsecure/messageReceiverEvents.std.js';
import {
  deleteAttachmentData,
  deleteDownloadData,
} from '../util/migrations.preload.js';
import {
  deleteAttachmentFromMessage,
  deleteMessage,
} from '../util/deleteForMe.preload.js';
import {
  doesMessageMatch,
  getConversationFromTarget,
  getMessageQueryFromTarget,
} from '../util/syncIdentifiers.preload.js';
import { DataWriter } from '../sql/Client.preload.js';

const log = createLogger('DeletesForMe');

const { removeSyncTaskById } = DataWriter;

export type DeleteForMeAttributesType = {
  conversation: ConversationIdentifier;
  deleteAttachmentData?: {
    clientUuid?: string;
    fallbackDigest?: string;
    fallbackPlaintextHash?: string;
  };
  envelopeId: string;
  message: AddressableMessage;
  syncTaskId: string;
  timestamp: number;
};

const deletes = new Map<string, DeleteForMeAttributesType>();

async function remove(item: DeleteForMeAttributesType): Promise<void> {
  const { syncTaskId } = item;
  await removeSyncTaskById(syncTaskId);
  deletes.delete(syncTaskId);
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

    deletes.set(item.syncTaskId, item);

    if (!conversation) {
      log.warn(`${logId}: Conversation not found!`);
      await remove(item);
      return;
    }

    // Do not await, since this a can deadlock the queue
    drop(
      conversation.queueJob('DeletesForMe.onDelete', async () => {
        log.info(`${logId}: Starting...`);

        let result: boolean;
        if (item.deleteAttachmentData) {
          // This will find the message, then work with a model to mirror what
          //   modifyTargetMessage does.
          result = await deleteAttachmentFromMessage(
            conversation.id,
            item.message,
            item.deleteAttachmentData,
            {
              deleteAttachmentOnDisk: deleteAttachmentData,
              deleteDownloadOnDisk: deleteDownloadData,
              logId,
            }
          );
        } else {
          // This automatically notifies redux
          result = await deleteMessage(conversation.id, item.message, logId);
        }
        if (result) {
          await remove(item);
        }

        log.info(`${logId}: Complete (result=${result})`);
      })
    );
  } catch (error) {
    log.error(
      `onDelete(task=${item.syncTaskId},envelopeId=${item.envelopeId}): Error`,
      Errors.toLogFormat(error)
    );
    await remove(item);
  }
}
