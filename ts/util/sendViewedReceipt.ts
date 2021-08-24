// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationAttributesType } from '../model-types.d';
import { getSendOptions } from './getSendOptions';
import { handleMessageSend } from './handleMessageSend';
import { isConversationAccepted } from './isConversationAccepted';

export async function sendViewedReceipt({
  messageId,
  senderE164,
  senderUuid,
  timestamp,
}: Readonly<{
  messageId: string;
  senderE164?: string;
  senderUuid?: string;
  timestamp: number;
}>): Promise<void> {
  if (!window.storage.get('read-receipt-setting')) {
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
