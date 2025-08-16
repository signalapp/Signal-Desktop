// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { chunk, map } from 'lodash';
import type { LoggerType } from '../types/Logging';
import type { Receipt } from '../types/Receipt';
import { ReceiptType } from '../types/Receipt';
import { getSendOptions } from './getSendOptions';
import { handleMessageSend } from './handleMessageSend';
import { isConversationAccepted } from './isConversationAccepted';
import { isConversationUnregistered } from './isConversationUnregistered';
import { missingCaseError } from './missingCaseError';
import type { ConversationModel } from '../models/conversations';
import { mapEmplace } from './mapEmplace';
import { isSignalConversation } from './isSignalConversation';

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

  log.info(`Starting receipt send of type ${type}`);

  type ConversationSenderReceiptGroup = {
    conversationId: string;
    sender: ConversationModel;
    receipts: Array<Receipt>;
  };
  const groupsByConversation = new Map<
    string,
    Map<string, ConversationSenderReceiptGroup>
  >();

  const allGroups = new Set<ConversationSenderReceiptGroup>();

  for (const receipt of receipts) {
    const { senderE164, senderAci, conversationId } = receipt;
    if (!senderE164 && !senderAci) {
      log.error('no sender E164 or Service Id. Skipping this receipt');
      continue;
    }

    const sender = window.ConversationController.lookupOrCreate({
      e164: senderE164,
      serviceId: senderAci,
      reason: 'sendReceipts',
    });

    if (!sender) {
      throw new Error(
        'no conversation found with that E164/Service Id. Cannot send this receipt'
      );
    }

    const groupsBySender = mapEmplace(groupsByConversation, conversationId, {
      insert: () => new Map(),
    });
    const group = mapEmplace(groupsBySender, sender.id, {
      insert: () => ({ conversationId, sender, receipts: [] }),
    });

    allGroups.add(group);
    group.receipts.push(receipt);
  }

  await window.ConversationController.load();

  await Promise.all(
    Array.from(allGroups.values(), async group => {
      const { conversationId, sender, receipts: receiptsForSender } = group;

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
      if (isSignalConversation(sender.attributes)) {
        log.info(
          `conversation ${sender.idForLogging()} is Signal conversation; refusing to send`
        );
        return;
      }
      log.info(`Sending receipt of type ${type} to ${sender.idForLogging()}`);

      const conversation = window.ConversationController.get(conversationId);
      const groupId = conversation?.get('groupId');

      const sendOptions = await getSendOptions(sender.attributes, {
        groupId,
      });

      const batches = chunk(receiptsForSender, CHUNK_SIZE);
      await Promise.all(
        map(batches, async batch => {
          const timestamps = batch.map(receipt => receipt.timestamp);
          const messageIds = batch.map(receipt => receipt.messageId);
          const isDirectConversation = batch.some(
            receipt => receipt.isDirectConversation
          );

          const senderAci = sender.getCheckedAci('sendReceipts');

          await handleMessageSend(
            messaging[methodName]({
              senderAci,
              isDirectConversation,
              timestamps,
              options: sendOptions,
            }),
            { messageIds, sendType: type }
          );

          window.SignalCI?.handleEvent('receipts', {
            type,
            timestamps,
          });
        })
      );
    })
  );
}
