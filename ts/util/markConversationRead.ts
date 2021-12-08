// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationAttributesType } from '../model-types.d';
import { hasErrors } from '../state/selectors/message';
import { readReceiptsJobQueue } from '../jobs/readReceiptsJobQueue';
import { readSyncJobQueue } from '../jobs/readSyncJobQueue';
import { notificationService } from '../services/notifications';
import * as log from '../logging/log';

export async function markConversationRead(
  conversationAttrs: ConversationAttributesType,
  newestUnreadAt: number,
  options: { readAt?: number; sendReadReceipts: boolean } = {
    sendReadReceipts: true,
  }
): Promise<boolean> {
  const { id: conversationId } = conversationAttrs;

  const [unreadMessages, unreadReactions] = await Promise.all([
    window.Signal.Data.getUnreadByConversationAndMarkRead({
      conversationId,
      newestUnreadAt,
      readAt: options.readAt,
    }),
    window.Signal.Data.getUnreadReactionsAndMarkRead({
      conversationId,
      newestUnreadAt,
    }),
  ]);

  log.info('markConversationRead', {
    conversationId,
    newestUnreadAt,
    unreadMessages: unreadMessages.length,
    unreadReactions: unreadReactions.length,
  });

  if (!unreadMessages.length && !unreadReactions.length) {
    return false;
  }

  notificationService.removeBy({ conversationId });

  const unreadReactionSyncData = new Map<
    string,
    {
      messageId?: string;
      senderUuid?: string;
      senderE164?: string;
      timestamp: number;
    }
  >();
  unreadReactions.forEach(reaction => {
    const targetKey = `${reaction.targetAuthorUuid}/${reaction.targetTimestamp}`;
    if (unreadReactionSyncData.has(targetKey)) {
      return;
    }
    unreadReactionSyncData.set(targetKey, {
      messageId: reaction.messageId,
      senderE164: undefined,
      senderUuid: reaction.targetAuthorUuid,
      timestamp: reaction.targetTimestamp,
    });
  });

  const allReadMessagesSync = unreadMessages.map(messageSyncData => {
    const message = window.MessageController.getById(messageSyncData.id);
    // we update the in-memory MessageModel with the fresh database call data
    if (message) {
      message.set(messageSyncData);
    }

    return {
      messageId: messageSyncData.id,
      senderE164: messageSyncData.source,
      senderUuid: messageSyncData.sourceUuid,
      senderId: window.ConversationController.ensureContactIds({
        e164: messageSyncData.source,
        uuid: messageSyncData.sourceUuid,
      }),
      timestamp: messageSyncData.sent_at,
      hasErrors: message ? hasErrors(message.attributes) : false,
    };
  });

  // Some messages we're marking read are local notifications with no sender
  // If a message has errors, we don't want to send anything out about it.
  //   read syncs - let's wait for a client that really understands the message
  //      to mark it read. we'll mark our local error read locally, though.
  //   read receipts - here we can run into infinite loops, where each time the
  //      conversation is viewed, another error message shows up for the contact
  const unreadMessagesSyncData = allReadMessagesSync.filter(
    item => Boolean(item.senderId) && !item.hasErrors
  );

  const readSyncs: Array<{
    messageId?: string;
    senderE164?: string;
    senderUuid?: string;
    senderId?: string;
    timestamp: number;
    hasErrors?: string;
  }> = [...unreadMessagesSyncData, ...unreadReactionSyncData.values()];

  if (readSyncs.length && options.sendReadReceipts) {
    log.info(`Sending ${readSyncs.length} read syncs`);
    // Because syncReadMessages sends to our other devices, and sendReadReceipts goes
    //   to a contact, we need accessKeys for both.
    if (window.ConversationController.areWePrimaryDevice()) {
      log.warn(
        'markConversationRead: We are primary device; not sending read syncs'
      );
    } else {
      readSyncJobQueue.add({ readSyncs });
    }

    await readReceiptsJobQueue.addIfAllowedByUser(
      window.storage,
      allReadMessagesSync
    );
  }

  window.Whisper.ExpiringMessagesListener.update();
  window.Whisper.TapToViewMessagesListener.update();

  return true;
}
