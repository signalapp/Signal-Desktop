// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { AciString } from '../types/ServiceId';
import type { MessageModel } from '../models/messages';
import * as Errors from '../types/errors';
import * as log from '../logging/log';
import { GiftBadgeStates } from '../components/conversation/Message';
import { ReadStatus } from '../messages/MessageReadStatus';
import { getMessageIdForLogging } from '../util/idForLogging';
import { getMessageSentTimestamp } from '../util/getMessageSentTimestamp';
import { isDownloaded } from '../types/Attachment';
import { isIncoming } from '../state/selectors/message';
import { markViewed } from '../services/MessageUpdater';
import { notificationService } from '../services/notifications';
import { queueAttachmentDownloads } from '../util/queueAttachmentDownloads';
import { queueUpdateMessage } from '../util/messageBatcher';
import { generateCacheKey } from './generateCacheKey';

export type ViewSyncAttributesType = {
  envelopeId: string;
  removeFromMessageReceiverCache: () => unknown;
  senderAci: AciString;
  senderE164?: string;
  senderId: string;
  timestamp: number;
  viewedAt: number;
};

const viewSyncs = new Map<string, ViewSyncAttributesType>();

function remove(sync: ViewSyncAttributesType): void {
  viewSyncs.delete(
    generateCacheKey({
      sender: sync.senderId,
      timestamp: sync.timestamp,
      type: 'viewsync',
    })
  );
  sync.removeFromMessageReceiverCache();
}

export function forMessage(
  message: MessageModel
): Array<ViewSyncAttributesType> {
  const logId = `ViewSyncs.forMessage(${getMessageIdForLogging(
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

  const viewSyncValues = Array.from(viewSyncs.values());

  const matchingSyncs = viewSyncValues.filter(item => {
    return item.senderId === sender?.id && item.timestamp === messageTimestamp;
  });

  if (matchingSyncs.length > 0) {
    log.info(
      `${logId}: Found ${matchingSyncs.length} early view sync(s) for message ${messageTimestamp}`
    );
  }
  matchingSyncs.forEach(sync => {
    remove(sync);
  });

  return matchingSyncs;
}

export async function onSync(sync: ViewSyncAttributesType): Promise<void> {
  viewSyncs.set(
    generateCacheKey({
      sender: sync.senderId,
      timestamp: sync.timestamp,
      type: 'viewsync',
    }),
    sync
  );

  const logId = `ViewSyncs.onSync(timestamp=${sync.timestamp})`;

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

      return sender?.id === sync.senderId;
    });

    if (!found) {
      log.info(
        `${logId}: nothing found`,
        sync.senderId,
        sync.senderE164,
        sync.senderAci
      );
      return;
    }

    notificationService.removeBy({ messageId: found.id });

    const message = window.MessageCache.__DEPRECATED$register(
      found.id,
      found,
      'ViewSyncs.onSync'
    );
    let didChangeMessage = false;

    if (message.get('readStatus') !== ReadStatus.Viewed) {
      didChangeMessage = true;
      message.set(markViewed(message.attributes, sync.viewedAt));

      const attachments = message.get('attachments');
      if (!attachments?.every(isDownloaded)) {
        const updatedFields = await queueAttachmentDownloads(
          message.attributes
        );
        if (updatedFields) {
          message.set(updatedFields);
        }
      }
    }

    const giftBadge = message.get('giftBadge');
    if (giftBadge) {
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
      queueUpdateMessage(message.attributes);
    }

    remove(sync);
  } catch (error) {
    remove(sync);
    log.error(`${logId} error:`, Errors.toLogFormat(error));
  }
}
