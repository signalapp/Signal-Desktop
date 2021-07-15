// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { groupBy, map } from 'lodash';
import { ConversationAttributesType } from '../model-types.d';
import { getSendOptions } from './getSendOptions';
import { handleMessageSend } from './handleMessageSend';
import { isConversationAccepted } from './isConversationAccepted';

type ReceiptSpecType = {
  messageId: string;
  senderE164?: string;
  senderUuid?: string;
  senderId?: string;
  timestamp: number;
  hasErrors: boolean;
};

export async function sendReadReceiptsFor(
  conversationAttrs: ConversationAttributesType,
  items: Array<ReceiptSpecType>
): Promise<void> {
  // Only send read receipts for accepted conversations
  if (
    window.storage.get('read-receipt-setting') &&
    isConversationAccepted(conversationAttrs)
  ) {
    window.log.info(`Sending ${items.length} read receipts`);
    const sendOptions = await getSendOptions(conversationAttrs);
    const receiptsBySender = groupBy(items, 'senderId');

    await Promise.all(
      map(receiptsBySender, async (receipts, senderId) => {
        const timestamps = map(receipts, item => item.timestamp);
        const messageIds = map(receipts, item => item.messageId);
        const conversation = window.ConversationController.get(senderId);

        if (conversation) {
          await handleMessageSend(
            window.textsecure.messaging.sendReadReceipts({
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              senderE164: conversation.get('e164')!,
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              senderUuid: conversation.get('uuid')!,
              timestamps,
              options: sendOptions,
            }),
            { messageIds, sendType: 'readReceipt' }
          );
        }
      })
    );
  }
}
