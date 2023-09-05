// Copyright 2017 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { AciString } from '../types/ServiceId';
import type { MessageModel } from '../models/messages';
import * as Errors from '../types/errors';
import * as log from '../logging/log';
import { StartupQueue } from '../util/StartupQueue';
import { getMessageIdForLogging } from '../util/idForLogging';
import { getMessageSentTimestamp } from '../util/getMessageSentTimestamp';
import { isIncoming } from '../state/selectors/message';
import { isMessageUnread } from '../util/isMessageUnread';
import { notificationService } from '../services/notifications';
import { queueUpdateMessage } from '../util/messageBatcher';

export type ReadSyncAttributesType = {
  envelopeId: string;
  readAt: number;
  removeFromMessageReceiverCache: () => unknown;
  sender?: string;
  senderAci: AciString;
  senderId: string;
  timestamp: number;
};

const readSyncs = new Map<number, ReadSyncAttributesType>();

function remove(sync: ReadSyncAttributesType): void {
  readSyncs.delete(sync.timestamp);
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

  if (!readReaction) {
    log.info(`${logId}: ReadSync-3 ${sync.envelopeId}`);
    log.info(`${logId} not found:`, sync.senderId, sync.sender, sync.senderAci);
    return;
  }

  log.info(`${logId}: ReadSync-4 ${sync.envelopeId}`);

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
  readSyncs.set(sync.timestamp, sync);

  const logId = `ReadSyncs.onSync(timestamp=${sync.timestamp})`;

  log.info(`${logId}: ReadSync-1 ${sync.envelopeId}`);

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
      log.info(`${logId}: ReadSync-2 ${sync.envelopeId}`);
      await maybeItIsAReactionReadSync(sync);
      return;
    }

    log.info(`${logId}: ReadSync-5 ${sync.envelopeId}`);

    notificationService.removeBy({ messageId: found.id });

    const message = window.MessageController.register(found.id, found);
    const readAt = Math.min(sync.readAt, Date.now());

    // If message is unread, we mark it read. Otherwise, we update the expiration
    //   timer to the time specified by the read sync if it's earlier than
    //   the previous read time.
    if (isMessageUnread(message.attributes)) {
      log.info(`${logId}: ReadSync-6 ${sync.envelopeId}`);
      // TODO DESKTOP-1509: use MessageUpdater.markRead once this is TS
      message.markRead(readAt, { skipSave: true });

      const updateConversation = async () => {
        log.info(`${logId}: ReadSync-7 ${sync.envelopeId}`);
        // onReadMessage may result in messages older than this one being
        //   marked read. We want those messages to have the same expire timer
        //   start time as this one, so we pass the readAt value through.
        void message.getConversation()?.onReadMessage(message, readAt);
      };

      // only available during initialization
      if (StartupQueue.isAvailable()) {
        log.info(`${logId}: ReadSync-8 ${sync.envelopeId}`);
        const conversation = message.getConversation();
        if (conversation) {
          log.info(`${logId}: ReadSync-9 ${sync.envelopeId}`);
          StartupQueue.add(
            conversation.get('id'),
            message.get('sent_at'),
            updateConversation
          );
        }
      } else {
        log.info(`${logId}: ReadSync-10 ${sync.envelopeId}`);
        // not awaiting since we don't want to block work happening in the
        // eventHandlerQueue
        void updateConversation();
      }
    } else {
      log.info(`${logId}: ReadSync-11 ${sync.envelopeId}`);
      const now = Date.now();
      const existingTimestamp = message.get('expirationStartTimestamp');
      const expirationStartTimestamp = Math.min(
        now,
        Math.min(existingTimestamp || now, readAt || now)
      );
      message.set({ expirationStartTimestamp });
    }

    log.info(`${logId}: ReadSync-12 ${sync.envelopeId}`);
    queueUpdateMessage(message.attributes);

    remove(sync);
  } catch (error) {
    log.info(`${logId}: ReadSync-13 ${sync.envelopeId}`);
    remove(sync);
    log.error(`${logId} error:`, Errors.toLogFormat(error));
  }
}
