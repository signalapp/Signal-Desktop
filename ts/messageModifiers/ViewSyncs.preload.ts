// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { z } from 'zod';

import type { ReadonlyMessageAttributesType } from '../model-types.d.ts';
import * as Errors from '../types/errors.std.js';
import { createLogger } from '../logging/log.std.js';
import { GiftBadgeStates } from '../types/GiftBadgeStates.std.js';
import { ReadStatus } from '../messages/MessageReadStatus.std.js';
import { getMessageIdForLogging } from '../util/idForLogging.preload.js';
import { getMessageSentTimestamp } from '../util/getMessageSentTimestamp.std.js';
import { isIncoming } from '../state/selectors/message.preload.js';
import { markViewed } from '../services/MessageUpdater.preload.js';
import { notificationService } from '../services/notifications.preload.js';
import { queueUpdateMessage } from '../util/messageBatcher.preload.js';
import { isAciString } from '../util/isAciString.std.js';
import { DataReader, DataWriter } from '../sql/Client.preload.js';
import { MessageModel } from '../models/messages.preload.js';
import { drop } from '../util/drop.std.js';

const log = createLogger('ViewSyncs');

export const viewSyncTaskSchema = z.object({
  type: z.literal('ViewSync').readonly(),
  senderAci: z.string().refine(isAciString),
  senderE164: z.string().optional(),
  senderId: z.string(),
  timestamp: z.number(),
  viewedAt: z.number(),
});

export type ViewSyncTaskType = z.infer<typeof viewSyncTaskSchema>;

export type ViewSyncAttributesType = {
  envelopeId: string;
  syncTaskId: string;
  viewSync: ViewSyncTaskType;
};

const viewSyncs = new Map<string, ViewSyncAttributesType>();

async function remove(sync: ViewSyncAttributesType): Promise<void> {
  const { syncTaskId } = sync;
  viewSyncs.delete(syncTaskId);
  await DataWriter.removeSyncTaskById(syncTaskId);
}

export async function forMessage(
  message: ReadonlyMessageAttributesType
): Promise<Array<ViewSyncAttributesType>> {
  const logId = `ViewSyncs.forMessage(${getMessageIdForLogging(message)})`;

  const sender = window.ConversationController.lookupOrCreate({
    e164: message.source,
    serviceId: message.sourceServiceId,
    reason: logId,
  });
  const messageTimestamp = getMessageSentTimestamp(message, {
    log,
  });

  const viewSyncValues = Array.from(viewSyncs.values());

  const matchingSyncs = viewSyncValues.filter(item => {
    const { viewSync } = item;
    return (
      viewSync.senderId === sender?.id &&
      viewSync.timestamp === messageTimestamp
    );
  });

  if (matchingSyncs.length > 0) {
    log.info(
      `${logId}: Found ${matchingSyncs.length} early view sync(s) for message ${messageTimestamp}`
    );
  }
  await Promise.all(
    matchingSyncs.map(async sync => {
      await remove(sync);
    })
  );

  return matchingSyncs;
}

export async function onSync(sync: ViewSyncAttributesType): Promise<void> {
  viewSyncs.set(sync.syncTaskId, sync);
  const { viewSync } = sync;

  const logId = `ViewSyncs.onSync(timestamp=${viewSync.timestamp})`;

  try {
    const messages = await DataReader.getMessagesBySentAt(viewSync.timestamp);

    const found = messages.find(item => {
      const sender = window.ConversationController.lookupOrCreate({
        e164: item.source,
        serviceId: item.sourceServiceId,
        reason: logId,
      });

      return sender?.id === viewSync.senderId;
    });

    if (!found) {
      log.info(
        `${logId}: nothing found`,
        viewSync.senderId,
        viewSync.senderE164,
        viewSync.senderAci
      );
      return;
    }

    notificationService.removeBy({ messageId: found.id });

    const message = window.MessageCache.register(new MessageModel(found));
    let didChangeMessage = false;

    if (message.get('readStatus') !== ReadStatus.Viewed) {
      didChangeMessage = true;
      message.set(markViewed(message.attributes, viewSync.viewedAt));
    }

    const giftBadge = message.get('giftBadge');
    if (giftBadge && giftBadge.state !== GiftBadgeStates.Failed) {
      didChangeMessage = true;
      message.set({
        giftBadge: {
          ...giftBadge,
          state: isIncoming(message.attributes)
            ? GiftBadgeStates.Redeemed
            : GiftBadgeStates.Opened,
        },
      });
    }

    if (didChangeMessage) {
      drop(queueUpdateMessage(message.attributes));
    }

    await remove(sync);
  } catch (error) {
    log.error(`${logId} error:`, Errors.toLogFormat(error));
    await remove(sync);
  }
}
