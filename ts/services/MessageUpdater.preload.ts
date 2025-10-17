// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { MessageAttributesType } from '../model-types.d.ts';
import type { MessageModel } from '../models/messages.preload.js';
import {
  ReadStatus,
  maxReadStatus,
} from '../messages/MessageReadStatus.std.js';
import { notificationService } from './notifications.preload.js';
import { SeenStatus } from '../MessageSeenStatus.std.js';
import { queueUpdateMessage } from '../util/messageBatcher.preload.js';
import * as Errors from '../types/errors.std.js';
import { createLogger } from '../logging/log.std.js';
import { isValidTapToView } from '../util/isValidTapToView.std.js';
import { getMessageIdForLogging } from '../util/idForLogging.preload.js';
import { eraseMessageContents } from '../util/cleanup.preload.js';
import { getSource, getSourceServiceId } from '../messages/sources.preload.js';
import { isAciString } from '../util/isAciString.std.js';
import { viewOnceOpenJobQueue } from '../jobs/viewOnceOpenJobQueue.preload.js';
import { drop } from '../util/drop.std.js';

const log = createLogger('MessageUpdater');

function markReadOrViewed(
  messageAttrs: Readonly<MessageAttributesType>,
  readStatus: ReadStatus.Read | ReadStatus.Viewed,
  timestamp: undefined | number,
  skipSave: boolean
): MessageAttributesType {
  const oldReadStatus = messageAttrs.readStatus ?? ReadStatus.Read;
  const newReadStatus = maxReadStatus(oldReadStatus, readStatus);

  const nextMessageAttributes: MessageAttributesType = {
    ...messageAttrs,
    readAt: timestamp,
    readStatus: newReadStatus,
    seenStatus: SeenStatus.Seen,
  };

  const { id: messageId, expireTimer, expirationStartTimestamp } = messageAttrs;

  if (expireTimer && !expirationStartTimestamp) {
    nextMessageAttributes.expirationStartTimestamp = Math.min(
      Date.now(),
      timestamp || Date.now()
    );
  }

  notificationService.removeBy({ messageId });

  if (!skipSave) {
    drop(queueUpdateMessage(nextMessageAttributes));
  }

  return nextMessageAttributes;
}

export const markRead = (
  messageAttrs: Readonly<MessageAttributesType>,
  readAt?: number,
  { skipSave = false } = {}
): MessageAttributesType =>
  markReadOrViewed(messageAttrs, ReadStatus.Read, readAt, skipSave);

export const markViewed = (
  messageAttrs: Readonly<MessageAttributesType>,
  viewedAt?: number,
  { skipSave = false } = {}
): MessageAttributesType =>
  markReadOrViewed(messageAttrs, ReadStatus.Viewed, viewedAt, skipSave);

export async function markViewOnceMessageViewed(
  message: MessageModel,
  options?: {
    fromSync?: boolean;
  }
): Promise<void> {
  const { fromSync } = options || {};

  if (message.attributes.isErased) {
    log.warn(
      `markViewOnceMessageViewed: Message ${getMessageIdForLogging(message.attributes)} is already erased!`
    );
    return;
  }
  if (!isValidTapToView(message.attributes)) {
    log.warn(
      `markViewOnceMessageViewed: Message ${getMessageIdForLogging(message.attributes)} is not a valid tap to view message!`
    );
  }

  if (message.get('readStatus') !== ReadStatus.Viewed) {
    message.set(markViewed(message.attributes));
  }

  await eraseMessageContents(message);

  if (!fromSync) {
    const senderE164 = getSource(message.attributes);
    const senderAci = getSourceServiceId(message.attributes);
    const timestamp = message.get('sent_at');

    if (senderAci === undefined || !isAciString(senderAci)) {
      throw new Error('markViewOnceMessageViewed: senderAci is undefined');
    }

    if (window.ConversationController.areWePrimaryDevice()) {
      log.warn(
        'markViewOnceMessageViewed: We are primary device; not sending view once open sync'
      );
      return;
    }

    try {
      await viewOnceOpenJobQueue.add({
        viewOnceOpens: [
          {
            senderE164,
            senderAci,
            timestamp,
          },
        ],
      });
    } catch (error) {
      log.error(
        'markViewOnceMessageViewed: Failed to queue view once open sync',
        Errors.toLogFormat(error)
      );
    }
  }
}
