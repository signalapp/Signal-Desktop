// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { MessageAttributesType } from '../model-types.d';
import * as Errors from '../types/errors';
import * as log from '../logging/log';
import { drop } from '../util/drop';
import { filter, size } from '../util/iterables';
import { getContactId } from '../messages/helpers';
import { handleEditMessage } from '../util/handleEditMessage';
import { getMessageSentTimestamp } from '../util/getMessageSentTimestamp';

export type EditAttributesType = {
  conversationId: string;
  envelopeId: string;
  fromId: string;
  fromDevice: number;
  message: MessageAttributesType;
  targetSentTimestamp: number;
  removeFromMessageReceiverCache: () => unknown;
};

const edits = new Map<string, EditAttributesType>();

export function forMessage(
  messageAttributes: Pick<
    MessageAttributesType,
    | 'editMessageTimestamp'
    | 'sent_at'
    | 'source'
    | 'sourceUuid'
    | 'timestamp'
    | 'type'
  >
): Array<EditAttributesType> {
  const sentAt = getMessageSentTimestamp(messageAttributes, { log });
  const matchingEdits = filter(edits, ([_envelopeId, item]) => {
    return (
      item.targetSentTimestamp === sentAt &&
      item.fromId === getContactId(messageAttributes)
    );
  });

  if (size(matchingEdits) > 0) {
    const result: Array<EditAttributesType> = [];
    const editsLogIds: Array<number> = [];

    Array.from(matchingEdits).forEach(([envelopeId, item]) => {
      result.push(item);
      editsLogIds.push(item.message.sent_at);
      edits.delete(envelopeId);
      item.removeFromMessageReceiverCache();
    });

    log.info(
      `Edits.forMessage(${messageAttributes.sent_at}): ` +
        `Found early edits for message ${editsLogIds.join(', ')}`
    );
    return result;
  }

  return [];
}

export async function onEdit(edit: EditAttributesType): Promise<void> {
  edits.set(edit.envelopeId, edit);

  const logId = `Edits.onEdit(timestamp=${edit.message.timestamp};target=${edit.targetSentTimestamp})`;

  try {
    // The conversation the edited message was in; we have to find it in the database
    //   to to figure that out.
    const targetConversation =
      await window.ConversationController.getConversationForTargetMessage(
        edit.fromId,
        edit.targetSentTimestamp
      );

    if (!targetConversation) {
      log.info(`${logId}: No message found`);
      return;
    }

    // Do not await, since this can deadlock the queue
    drop(
      targetConversation.queueJob('Edits.onEdit', async () => {
        log.info(`${logId}: Handling edit`);

        const messages = await window.Signal.Data.getMessagesBySentAt(
          edit.targetSentTimestamp
        );

        // Verify authorship
        const targetMessage = messages.find(
          m =>
            edit.conversationId === m.conversationId &&
            edit.fromId === getContactId(m)
        );

        if (!targetMessage) {
          log.info(`${logId}: No message`);

          return;
        }

        const message = window.MessageController.register(
          targetMessage.id,
          targetMessage
        );

        await handleEditMessage(message.attributes, edit);

        edits.delete(edit.envelopeId);
        edit.removeFromMessageReceiverCache();
      })
    );
  } catch (error) {
    log.error(`${logId} error:`, Errors.toLogFormat(error));
  }
}
