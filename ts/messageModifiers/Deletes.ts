// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { MessageAttributesType } from '../model-types.d';
import { getContactId } from '../messages/helpers';
import * as log from '../logging/log';
import * as Errors from '../types/errors';
import { deleteForEveryone } from '../util/deleteForEveryone';
import { drop } from '../util/drop';
import { filter, size } from '../util/iterables';
import { getMessageSentTimestampSet } from '../util/getMessageSentTimestampSet';

export type DeleteAttributesType = {
  envelopeId: string;
  targetSentTimestamp: number;
  serverTimestamp: number;
  fromId: string;
  removeFromMessageReceiverCache: () => unknown;
};

const deletes = new Map<string, DeleteAttributesType>();

export function forMessage(
  messageAttributes: MessageAttributesType
): Array<DeleteAttributesType> {
  const sentTimestamps = getMessageSentTimestampSet(messageAttributes);
  const matchingDeletes = filter(deletes, ([_envelopeId, item]) => {
    return (
      item.fromId === getContactId(messageAttributes) &&
      sentTimestamps.has(item.targetSentTimestamp)
    );
  });

  if (size(matchingDeletes) > 0) {
    log.info('Found early DOE for message');
    const result = Array.from(matchingDeletes);
    result.forEach(([envelopeId, del]) => {
      del.removeFromMessageReceiverCache();
      deletes.delete(envelopeId);
    });
    return result.map(([_envelopeId, item]) => item);
  }

  return [];
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

        const messages = await window.Signal.Data.getMessagesBySentAt(
          del.targetSentTimestamp
        );

        const targetMessage = messages.find(
          m => del.fromId === getContactId(m) && !m.deletedForEveryone
        );

        if (!targetMessage) {
          log.info(`${logId}: No message for DOE 2`);
          return;
        }

        const message = window.MessageController.register(
          targetMessage.id,
          targetMessage
        );

        await deleteForEveryone(message, del);

        deletes.delete(del.envelopeId);
        del.removeFromMessageReceiverCache();
      })
    );
  } catch (error) {
    log.error(`${logId}: error`, Errors.toLogFormat(error));
  }
}
