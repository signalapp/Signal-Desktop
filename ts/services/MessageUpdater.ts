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
  const expireTimerMs = messageAttrs.expireTimer * 1000;
  return messageAttrs.expirationStartTimestamp
    ? messageAttrs.expirationStartTimestamp + expireTimerMs
    : undefined;
}

export function setToExpire(
  messageAttrs: MessageAttributesType,
  { force = false, skipSave = false } = {}
): MessageAttributesType {
  if (!isExpiring(messageAttrs) || (!force && messageAttrs.expires_at)) {
    return messageAttrs;
  }

  const expiresAt = getExpiresAt(messageAttrs);

  if (!expiresAt) {
    return messageAttrs;
  }

  const nextMessageAttributes = {
    ...messageAttrs,
    expires_at: expiresAt,
  };

  window.log.info('Set message expiration', {
    start: messageAttrs.expirationStartTimestamp,
    expiresAt,
    sentAt: messageAttrs.sent_at,
  });

  if (messageAttrs.id && !skipSave) {
    window.Signal.Util.queueUpdateMessage(nextMessageAttributes);
  }

  return nextMessageAttributes;
}

function isExpiring(
  messageAttrs: Pick<
    MessageAttributesType,
    'expireTimer' | 'expirationStartTimestamp'
  >
): boolean {
  return Boolean(
    messageAttrs.expireTimer && messageAttrs.expirationStartTimestamp
  );
}
