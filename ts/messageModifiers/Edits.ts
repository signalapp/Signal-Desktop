// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { MessageAttributesType } from '../model-types.d';
import type { MessageModel } from '../models/messages';
import type { ProcessedDataMessage } from '../textsecure/Types.d';
import * as Errors from '../types/errors';
import * as log from '../logging/log';
import { drop } from '../util/drop';
import { filter, size } from '../util/iterables';
import { getContactId } from '../messages/helpers';
import { handleEditMessage } from '../util/handleEditMessage';

export type EditAttributesType = {
  dataMessage: ProcessedDataMessage;
  fromId: string;
  message: MessageAttributesType;
  targetSentTimestamp: number;
};

const edits = new Set<EditAttributesType>();

export function forMessage(message: MessageModel): Array<EditAttributesType> {
  const matchingEdits = filter(edits, item => {
    return (
      item.targetSentTimestamp === message.get('sent_at') &&
      item.fromId === getContactId(message.attributes)
    );
  });

  if (size(matchingEdits) > 0) {
    log.info('Edits.forMessage: Found early edit for message');
    filter(matchingEdits, item => edits.delete(item));
    return Array.from(matchingEdits);
  }

  return [];
}

export async function onEdit(edit: EditAttributesType): Promise<void> {
  edits.add(edit);

  try {
    // The conversation the edited message was in; we have to find it in the database
    //   to to figure that out.
    const targetConversation =
      await window.ConversationController.getConversationForTargetMessage(
        edit.fromId,
        edit.targetSentTimestamp
      );

    if (!targetConversation) {
      log.info(
        'No target conversation for edit',
        edit.fromId,
        edit.targetSentTimestamp
      );

      return;
    }

    // Do not await, since this can deadlock the queue
    drop(
      targetConversation.queueJob('Edits.onEdit', async () => {
        log.info('Handling edit for', {
          targetSentTimestamp: edit.targetSentTimestamp,
          sentAt: edit.dataMessage.timestamp,
        });

        const messages = await window.Signal.Data.getMessagesBySentAt(
          edit.targetSentTimestamp
        );

        // Verify authorship
        const targetMessage = messages.find(
          m =>
            edit.message.conversationId === m.conversationId &&
            edit.fromId === getContactId(m)
        );

        if (!targetMessage) {
          log.info(
            'No message for edit',
            edit.fromId,
            edit.targetSentTimestamp
          );

          return;
        }

        const message = window.MessageController.register(
          targetMessage.id,
          targetMessage
        );

        await handleEditMessage(message.attributes, edit);

        edits.delete(edit);
      })
    );
  } catch (error) {
    log.error('Edits.onEdit error:', Errors.toLogFormat(error));
  }
}
