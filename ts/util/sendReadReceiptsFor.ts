// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { chunk, groupBy, map } from 'lodash';
import { ConversationAttributesType } from '../model-types.d';
import { getSendOptions } from './getSendOptions';
import { handleMessageSend } from './handleMessageSend';
import { isConversationAccepted } from './isConversationAccepted';
import * as log from '../logging/log';

type ReceiptSpecType = {
  messageId: string;
  senderE164?: string;
  senderUuid?: string;
  senderId?: string;
  timestamp: number;
  hasErrors: boolean;
};

const CHUNK_SIZE = 100;

export async function sendReadReceiptsFor(
  conversationAttrs: ConversationAttributesType,
  items: Array<ReceiptSpecType>
): Promise<void> {
  // Only send read receipts for accepted conversations
  if (
    window.Events.getReadReceiptSetting() &&
    isConversationAccepted(conversationAttrs)
  ) {
    log.info(`Sending ${items.length} read receipts`);
    const sendOptions = await getSendOptions(conversationAttrs);
    const receiptsBySender = groupBy(items, 'senderId');

    await Promise.all(
      map(receiptsBySender, async (receipts, senderId) => {
        const conversation = window.ConversationController.get(senderId);

        if (!conversation) {
          return;
        }

        const batches = chunk(receipts, CHUNK_SIZE);
        await Promise.all(
          batches.map(batch => {
            const timestamps = map(batch, item => item.timestamp);
            const messageIds = map(batch, item => item.messageId);

            return handleMessageSend(
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
          })
        );
      })
    );
  }
}
