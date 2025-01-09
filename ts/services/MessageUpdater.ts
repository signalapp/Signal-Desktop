// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { MessageAttributesType } from '../model-types.d';
import type { MessageModel } from '../models/messages';
import { ReadStatus, maxReadStatus } from '../messages/MessageReadStatus';
import { notificationService } from './notifications';
import { SeenStatus } from '../MessageSeenStatus';
import { queueUpdateMessage } from '../util/messageBatcher';
import * as Errors from '../types/errors';
import * as log from '../logging/log';
import { isValidTapToView } from '../util/isValidTapToView';
import { getMessageIdForLogging } from '../util/idForLogging';
import { eraseMessageContents } from '../util/cleanup';
import { getSource, getSourceServiceId } from '../messages/helpers';
import { isAciString } from '../util/isAciString';
import { viewOnceOpenJobQueue } from '../jobs/viewOnceOpenJobQueue';

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
    queueUpdateMessage(nextMessageAttributes);
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

  if (!isValidTapToView(message.attributes)) {
    log.warn(
      `markViewOnceMessageViewed: Message ${getMessageIdForLogging(message.attributes)} is not a valid tap to view message!`
    );
    return;
  }
  if (message.attributes.isErased) {
    log.warn(
      `markViewOnceMessageViewed: Message ${getMessageIdForLogging(message.attributes)} is already erased!`
    );
    return;
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
