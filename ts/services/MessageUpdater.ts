// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { MessageAttributesType } from '../model-types.d';
import { ReadStatus, maxReadStatus } from '../messages/MessageReadStatus';
import { notificationService } from './notifications';
import { SeenStatus } from '../MessageSeenStatus';

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
    window.Signal.Util.queueUpdateMessage(nextMessageAttributes);
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
