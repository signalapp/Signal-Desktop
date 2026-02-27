// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { DeleteAttributesType } from '../messageModifiers/Deletes.preload.js';
import type { MessageAttributesType } from '../model-types.d.ts';
import type { MessageModel } from '../models/messages.preload.js';
import { createLogger } from '../logging/log.std.js';
import { isMe } from './whatTypeOfConversation.dom.js';
import { getSourceServiceId } from '../messages/sources.preload.js';
import { isStory } from '../state/selectors/message.preload.js';
import { canReceiveDeleteForEveryone } from './canDeleteForEveryone.preload.js';
import { isAciString } from './isAciString.std.js';
import { eraseMessageContents } from './cleanup.preload.js';
import { notificationService } from '../services/notifications.preload.js';
import { DataWriter } from '../sql/Client.preload.js';

const log = createLogger('deleteForEveryone');

/**
 * Receive path: validate an incoming delete-for-everyone, then apply it.
 */
export async function receiveDeleteForEveryone(
  message: MessageModel,
  doe: Pick<
    DeleteAttributesType,
    | 'isAdminDelete'
    | 'targetSentTimestamp'
    | 'deleteServerTimestamp'
    | 'deleteSentByAci'
    | 'targetConversationId'
  >,
  { shouldPersist = true }: { shouldPersist?: boolean } = {}
): Promise<void> {
  const conversation = window.ConversationController.get(
    message.get('conversationId')
  );

  // Our 1:1 stories are deleted through ts/util/onStoryRecipientUpdate.ts
  if (
    isStory(message.attributes) &&
    conversation &&
    isMe(conversation.attributes)
  ) {
    return;
  }

  const messageAuthorAci = getSourceServiceId(message.attributes);
  if (!messageAuthorAci || !isAciString(messageAuthorAci)) {
    log.warn('receiveDeleteForEveryone: Cannot determine message author ACI');
    return;
  }

  if (!conversation) {
    log.warn('receiveDeleteForEveryone: No conversation found');
    return;
  }

  const result = canReceiveDeleteForEveryone({
    isAdminDelete: doe.isAdminDelete,
    targetMessage: message.attributes,
    targetConversation: conversation.attributes,
    deleteSentByAci: doe.deleteSentByAci,
    deleteServerTimestamp: doe.deleteServerTimestamp,
  });

  if (!result.ok) {
    log.warn('receiveDeleteForEveryone: Rejected.', {
      reason: result.reason,
      targetConversationId: doe.targetConversationId,
      targetSentTimestamp: doe.targetSentTimestamp,
      messageServerTimestamp: message.get('serverTimestamp'),
      messageSentAt: message.get('sent_at'),
      deleteServerTimestamp: doe.deleteServerTimestamp,
    });
    return;
  }

  await applyDeleteForEveryone(message, doe, { shouldPersist });
}

/**
 * Apply a delete-for-everyone to a message. No validation — caller is
 * responsible for checking canDeleteForEveryone first.
 */
export async function applyDeleteForEveryone(
  message: MessageModel,
  del: Pick<
    DeleteAttributesType,
    | 'isAdminDelete'
    | 'targetSentTimestamp'
    | 'deleteServerTimestamp'
    | 'deleteSentByAci'
    | 'targetConversationId'
  >,
  { shouldPersist = true }: { shouldPersist?: boolean } = {}
): Promise<void> {
  if (message.deletingForEveryone || message.get('deletedForEveryone')) {
    return;
  }

  log.info('Handling DOE.', {
    messageId: message.id,
    isAdminDelete: del.isAdminDelete,
    targetConversationId: del.targetConversationId,
    targetSentTimestamp: del.targetSentTimestamp,
    messageServerTimestamp: message.get('serverTimestamp'),
    deleteServerTimestamp: del.deleteServerTimestamp,
  });

  try {
    // eslint-disable-next-line no-param-reassign
    message.deletingForEveryone = true;

    // Remove any notifications for this message
    notificationService.removeBy({ messageId: message.get('id') });

    // Erase the contents of this message
    const additionalProps: Partial<MessageAttributesType> = {
      deletedForEveryone: true,
      reactions: [],
    };
    if (del.isAdminDelete) {
      additionalProps.deletedForEveryoneByAdminAci = del.deleteSentByAci;
    }
    await eraseMessageContents(message, 'delete-for-everyone', additionalProps);

    if (shouldPersist) {
      // We delete the message first, before re-saving it -- this causes any foreign key
      // ON DELETE CASCADE and messages_on_delete triggers to run, which is important
      await DataWriter.removeMessageById(message.attributes.id, {
        cleanupMessages: async () => {
          // We don't actually want to remove this message up from in-memory caches
        },
      });
      await window.MessageCache.saveMessage(message.attributes, {
        forceSave: true,
      });
    }
  } finally {
    // eslint-disable-next-line no-param-reassign
    message.deletingForEveryone = undefined;
  }
}
