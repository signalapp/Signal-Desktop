// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { MessageAttributesType } from '../model-types.d.ts';
import type { AciString } from '../types/ServiceId.std.js';
import { getAuthorId } from '../messages/sources.preload.js';
import { DataReader } from '../sql/Client.preload.js';
import { createLogger } from '../logging/log.std.js';
import * as Errors from '../types/errors.std.js';
import { receiveDeleteForEveryone } from '../util/deleteForEveryone.preload.js';
import { drop } from '../util/drop.std.js';
import { getMessageSentTimestampSet } from '../util/getMessageSentTimestampSet.std.js';
import { MessageModel } from '../models/messages.preload.js';

const log = createLogger('Deletes');

export type DeleteAttributesType = Readonly<{
  envelopeId: string;
  isAdminDelete: boolean;
  targetSentTimestamp: number;
  targetAuthorAci: AciString;
  targetConversationId: string;
  deleteServerTimestamp: number;
  deleteSentByAci: AciString;
  removeFromMessageReceiverCache: () => unknown;
}>;

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
      item.targetConversationId === getAuthorId(messageAttributes) &&
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

  const logId = `Deletes.onDelete(timestamp=${del.targetSentTimestamp}, isAdminDelete=${del.isAdminDelete})`;

  try {
    // The conversation the deleted message was in; we have to find it in the database
    //   to to figure that out.
    const targetConversation =
      await window.ConversationController.getConversationForTargetMessage(
        del.targetConversationId,
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

        const targetMessage = messages.find(m => {
          return (
            del.targetConversationId === getAuthorId(m) && !m.deletedForEveryone
          );
        });

        if (!targetMessage) {
          log.info(`${logId}: No message for DOE 2`);
          return;
        }

        const message = window.MessageCache.register(
          new MessageModel(targetMessage)
        );

        await receiveDeleteForEveryone(message, del);

        remove(del);
      })
    );
  } catch (error) {
    remove(del);
    log.error(`${logId}: error`, Errors.toLogFormat(error));
  }
}
