// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { MessageAttributesType } from '../model-types.d';

export function markRead(
  messageAttrs: MessageAttributesType,
  readAt?: number,
  { skipSave = false } = {}
): MessageAttributesType {
  const nextMessageAttributes = {
    ...messageAttrs,
    unread: false,
  };

  const { id: messageId, expireTimer, expirationStartTimestamp } = messageAttrs;

  if (expireTimer && !expirationStartTimestamp) {
    nextMessageAttributes.expirationStartTimestamp = Math.min(
      Date.now(),
      readAt || Date.now()
    );
  }

  window.Whisper.Notifications.removeBy({ messageId });

  if (!skipSave) {
    window.Signal.Util.queueUpdateMessage(nextMessageAttributes);
  }

  return nextMessageAttributes;
}

export function getExpiresAt(
  messageAttrs: Pick<
    MessageAttributesType,
    'expireTimer' | 'expirationStartTimestamp'
  >
): number | undefined {
  const { expireTimer, expirationStartTimestamp } = messageAttrs;
  return expirationStartTimestamp && expireTimer
    ? expirationStartTimestamp + expireTimer * 1000
    : undefined;
}
