// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationAttributesType } from '../model-types.d';
import type { LoggerType } from '../types/Logging';
import { getSendOptions } from './getSendOptions';
import { handleMessageSend } from './handleMessageSend';
import { isConversationAccepted } from './isConversationAccepted';

export async function sendViewedReceipt(
  {
    messageId,
    senderE164,
    senderUuid,
    timestamp,
  }: Readonly<{
    messageId: string;
    senderE164?: string;
    senderUuid?: string;
    timestamp: number;
  }>,
  log: LoggerType
): Promise<void> {
  if (!window.storage.get('read-receipt-setting')) {
    return;
  }

  // We introduced a bug in `75f0cd50beff73885ebae92e4ac977de9f56d6c9` where we'd enqueue
  //   jobs that had no sender information. These jobs cannot possibly succeed. This
  //   removes them from the queue to avoid constantly retrying something.
  //
  // We should be able to safely remove this check after the fix has been present for
  //   awhile. Probably ~40 days from when this is first deployed (30 days to unlink + 10
  //   days of buffer).
  if (!senderE164 && !senderUuid) {
    log.error(
      'sendViewedReceipt: no sender E164 or UUID. Cannot possibly complete this job. Giving up'
    );
    return;
  }

  const conversationId = window.ConversationController.ensureContactIds({
    e164: senderE164,
    uuid: senderUuid,
  });
  if (!conversationId) {
    throw new Error(
      'sendViewedReceipt: no conversation found with that E164/UUID'
    );
  }

  const conversation = window.ConversationController.get(conversationId);
  if (!conversation) {
    throw new Error(
      'sendViewedReceipt: no conversation found with that conversation ID, even though we found the ID with E164/UUID?'
    );
  }

  const conversationAttrs: ConversationAttributesType = conversation.attributes;
  if (!isConversationAccepted(conversationAttrs)) {
    return;
  }

  await handleMessageSend(
    window.textsecure.messaging.sendViewedReceipts({
      senderE164,
      senderUuid,
      timestamps: [timestamp],
      options: await getSendOptions(conversationAttrs),
    }),
    { messageIds: [messageId], sendType: 'viewedReceipt' }
  );
}
