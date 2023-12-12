// Copyright 2017 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { AciString } from '../types/ServiceId';
import type { MessageModel } from '../models/messages';
import * as Errors from '../types/errors';
import * as log from '../logging/log';
import { StartupQueue } from '../util/StartupQueue';
import { drop } from '../util/drop';
import { getMessageIdForLogging } from '../util/idForLogging';
import { getMessageSentTimestamp } from '../util/getMessageSentTimestamp';
import { isIncoming } from '../state/selectors/message';
import { isMessageUnread } from '../util/isMessageUnread';
import { notificationService } from '../services/notifications';
import { queueUpdateMessage } from '../util/messageBatcher';
import { strictAssert } from '../util/assert';
import { generateCacheKey } from './generateCacheKey';

export type ReadSyncAttributesType = {
  envelopeId: string;
  readAt: number;
  removeFromMessageReceiverCache: () => unknown;
  sender?: string;
  senderAci: AciString;
  senderId: string;
  timestamp: number;
};

const readSyncs = new Map<string, ReadSyncAttributesType>();

function remove(sync: ReadSyncAttributesType): void {
  readSyncs.delete(
    generateCacheKey({
      sender: sync.senderId,
      timestamp: sync.timestamp,
      type: 'readsync',
    })
  );
  sync.removeFromMessageReceiverCache();
}

async function maybeItIsAReactionReadSync(
  sync: ReadSyncAttributesType
): Promise<void> {
  const logId = `ReadSyncs.onSync(timestamp=${sync.timestamp})`;

  const readReaction = await window.Signal.Data.markReactionAsRead(
    sync.senderAci,
    Number(sync.timestamp)
  );

  if (
    !readReaction ||
    readReaction?.targetAuthorAci !== window.storage.user.getCheckedAci()
  ) {
    log.info(`${logId} not found:`, sync.senderId, sync.sender, sync.senderAci);
    return;
  }

  log.info(
    `${logId} read reaction sync found:`,
    readReaction.conversationId,
    sync.senderId,
    sync.sender,
    sync.senderAci
  );

  remove(sync);

  notificationService.removeBy({
    conversationId: readReaction.conversationId,
    emoji: readReaction.emoji,
    targetAuthorAci: readReaction.targetAuthorAci,
    targetTimestamp: readReaction.targetTimestamp,
  });
}

export function forMessage(
  message: MessageModel
): ReadSyncAttributesType | null {
  const logId = `ReadSyncs.forMessage(${getMessageIdForLogging(
    message.attributes
  )})`;

  const sender = window.ConversationController.lookupOrCreate({
    e164: message.get('source'),
    serviceId: message.get('sourceServiceId'),
    reason: logId,
  });
  const messageTimestamp = getMessageSentTimestamp(message.attributes, {
    log,
  });
  const readSyncValues = Array.from(readSyncs.values());
  const foundSync = readSyncValues.find(item => {
    return item.senderId === sender?.id && item.timestamp === messageTimestamp;
  });
  if (foundSync) {
    log.info(
      `${logId}: Found early read sync for message ${foundSync.timestamp}`
    );
    remove(foundSync);
    return foundSync;
  }

  return null;
}

export async function onSync(sync: ReadSyncAttributesType): Promise<void> {
  readSyncs.set(
    generateCacheKey({
      sender: sync.senderId,
      timestamp: sync.timestamp,
      type: 'readsync',
    }),
    sync
  );

  const logId = `ReadSyncs.onSync(timestamp=${sync.timestamp})`;

  try {
    const messages = await window.Signal.Data.getMessagesBySentAt(
      sync.timestamp
    );

    const found = messages.find(item => {
      const sender = window.ConversationController.lookupOrCreate({
        e164: item.source,
        serviceId: item.sourceServiceId,
        reason: logId,
      });

      return isIncoming(item) && sender?.id === sync.senderId;
    });

    if (!found) {
      await maybeItIsAReactionReadSync(sync);
      return;
    }

    notificationService.removeBy({ messageId: found.id });

    const message = window.MessageCache.__DEPRECATED$register(
      found.id,
      found,
      'ReadSyncs.onSync'
    );
    const readAt = Math.min(sync.readAt, Date.now());
    const newestSentAt = sync.timestamp;

    // If message is unread, we mark it read. Otherwise, we update the expiration
    //   timer to the time specified by the read sync if it's earlier than
    //   the previous read time.
    if (isMessageUnread(message.attributes)) {
      // TODO DESKTOP-1509: use MessageUpdater.markRead once this is TS
      message.markRead(readAt, { skipSave: true });

      const updateConversation = async () => {
        const conversation = message.getConversation();
        strictAssert(conversation, `${logId}: conversation not found`);
        // onReadMessage may result in messages older than this one being
        //   marked read. We want those messages to have the same expire timer
        //   start time as this one, so we pass the readAt value through.
        drop(conversation.onReadMessage(message, readAt, newestSentAt));
      };

      // only available during initialization
      if (StartupQueue.isAvailable()) {
        const conversation = message.getConversation();
        strictAssert(
          conversation,
          `${logId}: conversation not found (StartupQueue)`
        );
        StartupQueue.add(
          conversation.get('id'),
          message.get('sent_at'),
          updateConversation
        );
      } else {
        // not awaiting since we don't want to block work happening in the
        // eventHandlerQueue
        drop(updateConversation());
      }
    } else {
      log.info(`${logId}: updating expiration`);
      const now = Date.now();
      const existingTimestamp = message.get('expirationStartTimestamp');
      const expirationStartTimestamp = Math.min(
        now,
        Math.min(existingTimestamp || now, readAt || now)
      );
      message.set({ expirationStartTimestamp });
    }

    queueUpdateMessage(message.attributes);

    remove(sync);
  } catch (error) {
    remove(sync);
    log.error(`${logId} error:`, Errors.toLogFormat(error));
  }
}
