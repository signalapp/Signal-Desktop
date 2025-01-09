// Copyright 2017 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { z } from 'zod';

import type { ReadonlyMessageAttributesType } from '../model-types.d';
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
import { isAciString } from '../util/isAciString';
import { DataReader, DataWriter } from '../sql/Client';
import { markRead } from '../services/MessageUpdater';
import { MessageModel } from '../models/messages';

const { removeSyncTaskById } = DataWriter;

export const readSyncTaskSchema = z.object({
  type: z.literal('ReadSync').readonly(),
  readAt: z.number(),
  sender: z.string().optional(),
  senderAci: z.string().refine(isAciString),
  senderId: z.string(),
  timestamp: z.number(),
});

export type ReadSyncTaskType = z.infer<typeof readSyncTaskSchema>;

export type ReadSyncAttributesType = {
  envelopeId: string;
  syncTaskId: string;
  readSync: ReadSyncTaskType;
};

const readSyncs = new Map<string, ReadSyncAttributesType>();

async function remove(sync: ReadSyncAttributesType): Promise<void> {
  const { syncTaskId } = sync;
  readSyncs.delete(syncTaskId);
  await removeSyncTaskById(syncTaskId);
}

async function maybeItIsAReactionReadSync(
  sync: ReadSyncAttributesType
): Promise<void> {
  const { readSync } = sync;
  const logId = `ReadSyncs.onSync(timestamp=${readSync.timestamp})`;

  const readReaction = await DataWriter.markReactionAsRead(
    readSync.senderAci,
    Number(readSync.timestamp)
  );

  if (
    !readReaction ||
    readReaction?.targetAuthorAci !== window.storage.user.getCheckedAci()
  ) {
    log.info(
      `${logId} not found:`,
      readSync.senderId,
      readSync.sender,
      readSync.senderAci
    );
    return;
  }

  log.info(
    `${logId} read reaction sync found:`,
    readReaction.conversationId,
    readSync.senderId,
    readSync.sender,
    readSync.senderAci
  );

  await remove(sync);

  notificationService.removeBy({
    conversationId: readReaction.conversationId,
    emoji: readReaction.emoji,
    targetAuthorAci: readReaction.targetAuthorAci,
    targetTimestamp: readReaction.targetTimestamp,
  });
}

export async function forMessage(
  message: ReadonlyMessageAttributesType
): Promise<ReadSyncAttributesType | null> {
  const logId = `ReadSyncs.forMessage(${getMessageIdForLogging(message)})`;

  const sender = window.ConversationController.lookupOrCreate({
    e164: message.source,
    serviceId: message.sourceServiceId,
    reason: logId,
  });
  const messageTimestamp = getMessageSentTimestamp(message, {
    log,
  });
  const readSyncValues = Array.from(readSyncs.values());
  const foundSync = readSyncValues.find(item => {
    const { readSync } = item;
    return (
      readSync.senderId === sender?.id &&
      readSync.timestamp === messageTimestamp
    );
  });
  if (foundSync) {
    log.info(
      `${logId}: Found early read sync for message ${foundSync.readSync.timestamp}`
    );
    await remove(foundSync);
    return foundSync;
  }

  return null;
}

export async function onSync(sync: ReadSyncAttributesType): Promise<void> {
  const { readSync, syncTaskId } = sync;

  readSyncs.set(syncTaskId, sync);

  const logId = `ReadSyncs.onSync(timestamp=${readSync.timestamp})`;

  try {
    const messages = await DataReader.getMessagesBySentAt(readSync.timestamp);

    const found = messages.find(item => {
      const sender = window.ConversationController.lookupOrCreate({
        e164: item.source,
        serviceId: item.sourceServiceId,
        reason: logId,
      });

      return isIncoming(item) && sender?.id === readSync.senderId;
    });

    if (!found) {
      await maybeItIsAReactionReadSync(sync);
      return;
    }

    notificationService.removeBy({ messageId: found.id });

    const message = window.MessageCache.register(new MessageModel(found));
    const readAt = Math.min(readSync.readAt, Date.now());
    const newestSentAt = readSync.timestamp;

    // If message is unread, we mark it read. Otherwise, we update the expiration
    //   timer to the time specified by the read sync if it's earlier than
    //   the previous read time.
    if (isMessageUnread(message.attributes)) {
      message.set(markRead(message.attributes, readAt, { skipSave: true }));

      const updateConversation = async () => {
        const conversation = window.ConversationController.get(
          message.get('conversationId')
        );
        strictAssert(conversation, `${logId}: conversation not found`);
        // onReadMessage may result in messages older than this one being
        //   marked read. We want those messages to have the same expire timer
        //   start time as this one, so we pass the readAt value through.
        drop(
          conversation.onReadMessage(message.attributes, readAt, newestSentAt)
        );
      };

      // only available during initialization
      if (StartupQueue.isAvailable()) {
        const conversation = window.ConversationController.get(
          message.get('conversationId')
        );
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

    await remove(sync);
  } catch (error) {
    log.error(`${logId} error:`, Errors.toLogFormat(error));
    await remove(sync);
  }
}
