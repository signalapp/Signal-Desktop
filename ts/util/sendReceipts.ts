// Copyright 2021-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { chunk } from 'lodash';
import type { LoggerType } from '../types/Logging';
import type { Receipt } from '../types/Receipt';
import { ReceiptType } from '../types/Receipt';
import { getSendOptions } from './getSendOptions';
import { handleMessageSend } from './handleMessageSend';
import { isConversationAccepted } from './isConversationAccepted';
import { isConversationUnregistered } from './isConversationUnregistered';
import { map } from './iterables';
import { missingCaseError } from './missingCaseError';

const CHUNK_SIZE = 100;

export async function sendReceipts({
  log,
  receipts,
  type,
}: Readonly<{
  log: LoggerType;
  receipts: ReadonlyArray<Receipt>;
  type: ReceiptType;
}>): Promise<void> {
  let requiresUserSetting: boolean;
  let methodName:
    | 'sendDeliveryReceipt'
    | 'sendReadReceipt'
    | 'sendViewedReceipt';
  switch (type) {
    case ReceiptType.Delivery:
      requiresUserSetting = false;
      methodName = 'sendDeliveryReceipt';
      break;
    case ReceiptType.Read:
      requiresUserSetting = true;
      methodName = 'sendReadReceipt';
      break;
    case ReceiptType.Viewed:
      requiresUserSetting = true;
      methodName = 'sendViewedReceipt';
      break;
    default:
      throw missingCaseError(type);
  }

  const { messaging } = window.textsecure;
  if (!messaging) {
    throw new Error('messaging is not available!');
  }

  if (requiresUserSetting && !window.storage.get('read-receipt-setting')) {
    log.info('requires user setting. Not sending these receipts');
    return;
  }

  const receiptsBySenderId: Map<string, Array<Receipt>> = receipts.reduce(
    (result, receipt) => {
      const { senderE164, senderUuid } = receipt;
      if (!senderE164 && !senderUuid) {
        log.error('no sender E164 or UUID. Skipping this receipt');
        return result;
      }

      const sender = window.ConversationController.lookupOrCreate({
        e164: senderE164,
        uuid: senderUuid,
      });
      if (!sender) {
        throw new Error(
          'no conversation found with that E164/UUID. Cannot send this receipt'
        );
      }

      const existingGroup = result.get(sender.id);
      if (existingGroup) {
        existingGroup.push(receipt);
      } else {
        result.set(sender.id, [receipt]);
      }

      return result;
    },
    new Map()
  );

  await window.ConversationController.load();

  await Promise.all(
    map(receiptsBySenderId, async ([senderId, receiptsForSender]) => {
      const sender = window.ConversationController.get(senderId);
      if (!sender) {
        throw new Error(
          'despite having a conversation ID, no conversation was found'
        );
      }

      if (!isConversationAccepted(sender.attributes)) {
        log.info(
          `conversation ${sender.idForLogging()} is not accepted; refusing to send`
        );
        return;
      }
      if (isConversationUnregistered(sender.attributes)) {
        log.info(
          `conversation ${sender.idForLogging()} is unregistered; refusing to send`
        );
        return;
      }
      if (sender.isBlocked()) {
        log.info(
          `conversation ${sender.idForLogging()} is blocked; refusing to send`
        );
        return;
      }

      const sendOptions = await getSendOptions(sender.attributes);

      const batches = chunk(receiptsForSender, CHUNK_SIZE);
      await Promise.all(
        map(batches, async batch => {
          const timestamps = batch.map(receipt => receipt.timestamp);
          const messageIds = batch.map(receipt => receipt.messageId);

          await handleMessageSend(
            messaging[methodName]({
              senderE164: sender.get('e164'),
              senderUuid: sender.get('uuid'),
              timestamps,
              options: sendOptions,
            }),
            { messageIds, sendType: type }
          );
        })
      );
    })
  );
}
