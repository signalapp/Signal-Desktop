// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { MessageAttributesType } from '../model-types.d';
import { getAuthorId } from '../messages/helpers';
import { DataReader } from '../sql/Client';
import * as log from '../logging/log';
import * as Errors from '../types/errors';
import { deleteForEveryone } from '../util/deleteForEveryone';
import { drop } from '../util/drop';
import { getMessageSentTimestampSet } from '../util/getMessageSentTimestampSet';
import { MessageModel } from '../models/messages';

export type DeleteAttributesType = {
  envelopeId: string;
  targetSentTimestamp: number;
  serverTimestamp: number;
  fromId: string;
  removeFromMessageReceiverCache: () => unknown;
};

const deletes = new Map<string, DeleteAttributesType>();

function remove(del: DeleteAttributesType): void {
  del.removeFromMessageReceiverCache();
  deletes.delete(del.envelopeId);
}

export function forMessage(
  messageAttributes: MessageAttributesType
): Array<DeleteAttributesType> {
  const sentTimestamps = getMessageSentTimestampSet(messageAttributes);
  const deleteValues = Array.from(deletes.values());

  const matchingDeletes = deleteValues.filter(item => {
    return (
      item.fromId === getAuthorId(messageAttributes) &&
      sentTimestamps.has(item.targetSentTimestamp)
    );
  });

  if (!matchingDeletes.length) {
    return [];
  }

  log.info('Found early DOE for message');
  matchingDeletes.forEach(del => {
    remove(del);
  });
  return matchingDeletes;
}

export async function onDelete(del: DeleteAttributesType): Promise<void> {
  deletes.set(del.envelopeId, del);

  const logId = `Deletes.onDelete(timestamp=${del.targetSentTimestamp})`;

  try {
    // The conversation the deleted message was in; we have to find it in the database
    //   to to figure that out.
    const targetConversation =
      await window.ConversationController.getConversationForTargetMessage(
        del.fromId,
        del.targetSentTimestamp
      );

    if (!targetConversation) {
      log.info(`${logId}: No message for DOE`);
      return;
    }

    // Do not await, since this can deadlock the queue
    drop(
      targetConversation.queueJob('Deletes.onDelete', async () => {
        log.info(`${logId}: Handling DOE`);

        const messages = await DataReader.getMessagesBySentAt(
          del.targetSentTimestamp
        );

        const targetMessage = messages.find(
          m => del.fromId === getAuthorId(m) && !m.deletedForEveryone
        );

        if (!targetMessage) {
          log.info(`${logId}: No message for DOE 2`);
          return;
        }

        const message = window.MessageCache.register(
          new MessageModel(targetMessage)
        );

        await deleteForEveryone(message, del);

        remove(del);
      })
    );
  } catch (error) {
    remove(del);
    log.error(`${logId}: error`, Errors.toLogFormat(error));
  }
}
