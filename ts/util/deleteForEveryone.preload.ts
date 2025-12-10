// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { DeleteAttributesType } from '../messageModifiers/Deletes.preload.js';
import type { MessageModel } from '../models/messages.preload.js';
import { createLogger } from '../logging/log.std.js';
import { isMe } from './whatTypeOfConversation.dom.js';
import { getAuthorId } from '../messages/sources.preload.js';
import { isStory } from '../state/selectors/message.preload.js';
import { isTooOldToModifyMessage } from './isTooOldToModifyMessage.std.js';
import { eraseMessageContents } from './cleanup.preload.js';
import { notificationService } from '../services/notifications.preload.js';
import { DataWriter } from '../sql/Client.preload.js';

const log = createLogger('deleteForEveryone');

export async function deleteForEveryone(
  message: MessageModel,
  doe: Pick<
    DeleteAttributesType,
    'fromId' | 'targetSentTimestamp' | 'serverTimestamp'
  >,
  { shouldPersist = true }: { shouldPersist?: boolean } = {}
): Promise<void> {
  if (isDeletionByMe(message, doe)) {
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

    await handleDeleteForEveryone(message, doe, { shouldPersist });
    return;
  }

  if (isTooOldToModifyMessage(doe.serverTimestamp, message.attributes)) {
    log.warn('Received late DOE. Dropping.', {
      fromId: doe.fromId,
      targetSentTimestamp: doe.targetSentTimestamp,
      messageServerTimestamp: message.get('serverTimestamp'),
      messageSentAt: message.get('sent_at'),
      deleteServerTimestamp: doe.serverTimestamp,
    });
    return;
  }

  await handleDeleteForEveryone(message, doe, { shouldPersist });
}

function isDeletionByMe(
  message: Readonly<MessageModel>,
  doe: Pick<DeleteAttributesType, 'fromId'>
): boolean {
  const ourConversationId =
    window.ConversationController.getOurConversationIdOrThrow();
  return (
    getAuthorId(message.attributes) === ourConversationId &&
    doe.fromId === ourConversationId
  );
}

export async function handleDeleteForEveryone(
  message: MessageModel,
  del: Pick<
    DeleteAttributesType,
    'fromId' | 'targetSentTimestamp' | 'serverTimestamp'
  >,
  { shouldPersist = true }: { shouldPersist?: boolean }
): Promise<void> {
  if (message.deletingForEveryone || message.get('deletedForEveryone')) {
    return;
  }

  log.info('Handling DOE.', {
    messageId: message.id,
    fromId: del.fromId,
    targetSentTimestamp: del.targetSentTimestamp,
    messageServerTimestamp: message.get('serverTimestamp'),
    deleteServerTimestamp: del.serverTimestamp,
  });

  try {
    // eslint-disable-next-line no-param-reassign
    message.deletingForEveryone = true;

    // Remove any notifications for this message
    notificationService.removeBy({ messageId: message.get('id') });

    // Erase the contents of this message
    await eraseMessageContents(message, 'delete-for-everyone', {
      deletedForEveryone: true,
      reactions: [],
    });

    if (shouldPersist) {
      // We delete the message first, before re-saving it -- this causes any foreign key
      // ON DELETE CASCADE and messages_on_delete triggers to run, which is important
      await DataWriter.removeMessage(message.attributes.id, {
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
