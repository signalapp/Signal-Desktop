// Copyright 2016 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { groupBy } from 'lodash';

import type { MessageModel } from '../models/messages';
import type { MessageAttributesType } from '../model-types.d';
import type { SendStateByConversationId } from '../messages/MessageSendState';
import { isOutgoing, isStory } from '../state/selectors/message';
import { getOwn } from '../util/getOwn';
import { missingCaseError } from '../util/missingCaseError';
import { createWaitBatcher } from '../util/waitBatcher';
import type { ServiceIdString } from '../types/ServiceId';
import {
  SendActionType,
  SendStatus,
  UNDELIVERED_SEND_STATUSES,
  sendStateReducer,
} from '../messages/MessageSendState';
import type { DeleteSentProtoRecipientOptionsType } from '../sql/Interface';
import dataInterface from '../sql/Client';
import * as log from '../logging/log';
import { getSourceServiceId } from '../messages/helpers';
import { getMessageSentTimestamp } from '../util/getMessageSentTimestamp';
import { getMessageIdForLogging } from '../util/idForLogging';
import { generateCacheKey } from './generateCacheKey';
import { getPropForTimestamp } from '../util/editHelpers';
import {
  DELETE_SENT_PROTO_BATCHER_WAIT_MS,
  RECEIPT_BATCHER_WAIT_MS,
} from '../types/Receipt';
import { drop } from '../util/drop';

const { deleteSentProtoRecipient } = dataInterface;

export enum MessageReceiptType {
  Delivery = 'Delivery',
  Read = 'Read',
  View = 'View',
}

export type MessageReceiptAttributesType = {
  envelopeId: string;
  messageSentAt: number;
  receiptTimestamp: number;
  removeFromMessageReceiverCache: () => void;
  sourceConversationId: string;
  sourceDevice: number;
  sourceServiceId: ServiceIdString;
  type: MessageReceiptType;
  wasSentEncrypted: boolean;
};

function getReceiptCacheKey(receipt: MessageReceiptAttributesType): string {
  return generateCacheKey({
    sender: receipt.sourceServiceId,
    timestamp: receipt.messageSentAt,
    type: receipt.type,
  });
}

const cachedReceipts = new Map<string, MessageReceiptAttributesType>();

const processReceiptBatcher = createWaitBatcher({
  name: 'processReceiptBatcher',
  wait: RECEIPT_BATCHER_WAIT_MS,
  maxSize: 250,
  async processBatch(receipts: Array<MessageReceiptAttributesType>) {
    // First group by sentAt, so that we can find the target message
    const receiptsByMessageSentAt = groupBy(
      receipts,
      receipt => receipt.messageSentAt
    );

    // Once we find the message, we'll group them by messageId to process
    // all receipts for a given message
    const receiptsByMessageId: Map<
      string,
      Array<MessageReceiptAttributesType>
    > = new Map();

    function addReceiptAndTargetMessage(
      message: MessageAttributesType,
      receipt: MessageReceiptAttributesType
    ): void {
      const existing = receiptsByMessageId.get(message.id);
      if (!existing) {
        window.MessageCache.toMessageAttributes(message);
        receiptsByMessageId.set(message.id, [receipt]);
      } else {
        existing.push(receipt);
      }
    }

    for (const receiptsForMessageSentAt of Object.values(
      receiptsByMessageSentAt
    )) {
      if (!receiptsForMessageSentAt.length) {
        continue;
      }
      // All receipts have the same sentAt, so we can grab it from the first
      const sentAt = receiptsForMessageSentAt[0].messageSentAt;

      const messagesMatchingTimestamp =
        // eslint-disable-next-line no-await-in-loop
        await window.Signal.Data.getMessagesBySentAt(sentAt);

      if (messagesMatchingTimestamp.length === 0) {
        // eslint-disable-next-line no-await-in-loop
        const reaction = await window.Signal.Data.getReactionByTimestamp(
          window.ConversationController.getOurConversationIdOrThrow(),
          sentAt
        );

        if (reaction) {
          for (const receipt of receiptsForMessageSentAt) {
            log.info(
              'MesageReceipts.processReceiptBatcher: Got receipt for reaction',
              receipt.messageSentAt,
              receipt.type,
              receipt.sourceConversationId,
              receipt.sourceServiceId
            );
            remove(receipt);
          }
          continue;
        }
      }

      for (const receipt of receiptsForMessageSentAt) {
        const targetMessage = getTargetMessage({
          sourceConversationId: receipt.sourceConversationId,
          targetTimestamp: sentAt,
          messagesMatchingTimestamp,
        });

        if (targetMessage) {
          addReceiptAndTargetMessage(targetMessage, receipt);
        } else {
          // We didn't find any messages but maybe it's a story sent message
          const targetMessages = messagesMatchingTimestamp.filter(
            item =>
              item.storyDistributionListId &&
              item.sendStateByConversationId &&
              !item.deletedForEveryone &&
              Boolean(
                item.sendStateByConversationId[receipt.sourceConversationId]
              )
          );

          if (targetMessages.length) {
            targetMessages.forEach(msg =>
              addReceiptAndTargetMessage(msg, receipt)
            );
          } else {
            // Nope, no target message was found
            log.info(
              'MessageReceipts.processReceiptBatcher: No message for receipt',
              receipt.messageSentAt,
              receipt.type,
              receipt.sourceConversationId,
              receipt.sourceServiceId
            );
          }
        }
      }
    }

    await Promise.all(
      [...receiptsByMessageId.entries()].map(
        ([messageId, receiptsForMessage]) => {
          return processReceiptsForMessage(messageId, receiptsForMessage);
        }
      )
    );
  },
});

async function processReceiptsForMessage(
  messageId: string,
  receipts: Array<MessageReceiptAttributesType>
) {
  if (!receipts.length) {
    return;
  }

  // Get message from cache or DB
  const message = await window.MessageCache.resolveAttributes(
    'processReceiptsForMessage',
    messageId
  );

  const { updatedMessage, validReceipts } = updateMessageWithReceipts(
    message,
    receipts
  );

  // Save it to cache & to DB
  await window.MessageCache.setAttributes({
    messageId,
    messageAttributes: updatedMessage,
    skipSaveToDatabase: false,
  });

  // Confirm/remove receipts, and delete sent protos
  for (const receipt of validReceipts) {
    remove(receipt);
    drop(addToDeleteSentProtoBatcher(receipt, updatedMessage));
  }

  // notify frontend listeners
  const conversation = window.ConversationController.get(
    message.conversationId
  );
  conversation?.debouncedUpdateLastMessage?.();
}

function updateMessageWithReceipts(
  message: MessageAttributesType,
  receipts: Array<MessageReceiptAttributesType>
): {
  updatedMessage: MessageAttributesType;
  validReceipts: Array<MessageReceiptAttributesType>;
} {
  const logId = `updateMessageWithReceipts(timestamp=${message.timestamp})`;

  const receiptsToProcess = receipts.filter(receipt => {
    if (shouldDropReceipt(receipt, message)) {
      log.info(
        `${logId}: Dropping a receipt ${receipt.type} for sentAt=${receipt.messageSentAt}`
      );
      remove(receipt);
      return false;
    }

    if (!cachedReceipts.has(getReceiptCacheKey(receipt))) {
      // Between the time it was received and now, this receipt has already been handled!
      return false;
    }

    return true;
  });

  log.info(
    `${logId}: batch processing ${receipts.length}` +
      ` receipt${receipts.length === 1 ? '' : 's'}`
  );

  // Generate the updated message synchronously
  let updatedMessage: MessageAttributesType = { ...message };
  for (const receipt of receiptsToProcess) {
    updatedMessage = {
      ...updatedMessage,
      ...updateMessageSendStateWithReceipt(updatedMessage, receipt),
    };
  }
  return { updatedMessage, validReceipts: receiptsToProcess };
}

const deleteSentProtoBatcher = createWaitBatcher({
  name: 'deleteSentProtoBatcher',
  wait: DELETE_SENT_PROTO_BATCHER_WAIT_MS,
  maxSize: 30,
  async processBatch(items: Array<DeleteSentProtoRecipientOptionsType>) {
    log.info(
      `MessageReceipts: Batching ${items.length} sent proto recipients deletes`
    );
    const { successfulPhoneNumberShares } = await deleteSentProtoRecipient(
      items
    );

    for (const serviceId of successfulPhoneNumberShares) {
      const convo = window.ConversationController.get(serviceId);
      if (!convo) {
        continue;
      }

      log.info(
        'MessageReceipts: unsetting shareMyPhoneNumber ' +
          `for ${convo.idForLogging()}`
      );

      // `deleteSentProtoRecipient` has already updated the database so there
      // is no need in calling `updateConversation`
      convo.unset('shareMyPhoneNumber');
    }
  },
});

function remove(receipt: MessageReceiptAttributesType): void {
  cachedReceipts.delete(getReceiptCacheKey(receipt));
  receipt.removeFromMessageReceiverCache();
}

function getTargetMessage({
  sourceConversationId,
  messagesMatchingTimestamp,
  targetTimestamp,
}: {
  sourceConversationId: string;
  messagesMatchingTimestamp: ReadonlyArray<MessageAttributesType>;
  targetTimestamp: number;
}): MessageAttributesType | null {
  if (messagesMatchingTimestamp.length === 0) {
    return null;
  }

  const matchingMessages = messagesMatchingTimestamp
    .filter(msg => isOutgoing(msg) || isStory(msg))
    .filter(msg => {
      const sendStateByConversationId = getPropForTimestamp({
        message: msg,
        prop: 'sendStateByConversationId',
        targetTimestamp,
        log,
      });

      const isRecipient = Object.hasOwn(
        sendStateByConversationId ?? {},
        sourceConversationId
      );
      if (!isRecipient) {
        return false;
      }

      const sendStatus =
        sendStateByConversationId?.[sourceConversationId]?.status;

      if (
        sendStatus === undefined ||
        UNDELIVERED_SEND_STATUSES.includes(sendStatus)
      ) {
        log.warn(
          'MessageReceipts.getTargetMessage: received receipt for undelivered message, ' +
            `status: ${sendStatus}, ` +
            `sourceConversationId: ${sourceConversationId}, ` +
            `message: ${getMessageIdForLogging(msg)}.`
        );
        return false;
      }

      return true;
    });

  if (matchingMessages.length === 0) {
    return null;
  }

  if (matchingMessages.length > 1) {
    log.warn(`
      MessageReceipts.getTargetMessage: multiple (${matchingMessages.length}) 
      matching messages for receipt, 
      sentAt=${targetTimestamp}, 
      sourceConversationId=${sourceConversationId}
    `);
  }

  const message = matchingMessages[0];
  return window.MessageCache.toMessageAttributes(message);
}
const wasDeliveredWithSealedSender = (
  conversationId: string,
  message: MessageAttributesType
): boolean =>
  (message.unidentifiedDeliveries || []).some(
    identifier =>
      window.ConversationController.getConversationId(identifier) ===
      conversationId
  );

const shouldDropReceipt = (
  receipt: MessageReceiptAttributesType,
  message: MessageAttributesType
): boolean => {
  const { type } = receipt;
  switch (type) {
    case MessageReceiptType.Delivery:
      return false;
    case MessageReceiptType.Read:
      return !window.storage.get('read-receipt-setting');
    case MessageReceiptType.View:
      if (isStory(message)) {
        return !window.Events.getStoryViewReceiptsEnabled();
      }
      return !window.storage.get('read-receipt-setting');
    default:
      throw missingCaseError(type);
  }
};

export function forMessage(
  message: MessageModel
): Array<MessageReceiptAttributesType> {
  if (!isOutgoing(message.attributes) && !isStory(message.attributes)) {
    return [];
  }

  const logId = `MessageReceipts.forMessage(${getMessageIdForLogging(
    message.attributes
  )})`;

  const ourAci = window.textsecure.storage.user.getCheckedAci();
  const sourceServiceId = getSourceServiceId(message.attributes);
  if (ourAci !== sourceServiceId) {
    return [];
  }

  const receiptValues = Array.from(cachedReceipts.values());

  const sentAt = getMessageSentTimestamp(message.attributes, { log });
  const result = receiptValues.filter(item => item.messageSentAt === sentAt);
  if (result.length > 0) {
    log.info(`${logId}: found early receipts for message ${sentAt}`);
    result.forEach(receipt => {
      remove(receipt);
    });
  }

  return result.filter(receipt => {
    if (shouldDropReceipt(receipt, message.attributes)) {
      log.info(
        `${logId}: Dropping an early receipt ${receipt.type} for message ${sentAt}`
      );
      remove(receipt);
      return false;
    }

    return true;
  });
}

function getNewSendStateByConversationId(
  oldSendStateByConversationId: SendStateByConversationId,
  receipt: MessageReceiptAttributesType
): SendStateByConversationId {
  const { receiptTimestamp, sourceConversationId, type } = receipt;
  const oldSendState = getOwn(
    oldSendStateByConversationId,
    sourceConversationId
  ) ?? { status: SendStatus.Sent, updatedAt: undefined };

  let sendActionType: SendActionType;
  switch (type) {
    case MessageReceiptType.Delivery:
      sendActionType = SendActionType.GotDeliveryReceipt;
      break;
    case MessageReceiptType.Read:
      sendActionType = SendActionType.GotReadReceipt;
      break;
    case MessageReceiptType.View:
      sendActionType = SendActionType.GotViewedReceipt;
      break;
    default:
      throw missingCaseError(type);
  }
  const newSendState = sendStateReducer(oldSendState, {
    type: sendActionType,
    updatedAt: receiptTimestamp,
  });
  return {
    ...oldSendStateByConversationId,
    [sourceConversationId]: newSendState,
  };
}

function updateMessageSendStateWithReceipt(
  message: MessageAttributesType,
  receipt: MessageReceiptAttributesType
): Partial<MessageAttributesType> {
  const { messageSentAt } = receipt;

  const newAttributes: Partial<MessageAttributesType> = {};

  const newEditHistory = (message.editHistory ?? []).map(edit => {
    if (messageSentAt !== edit.timestamp) {
      return edit;
    }

    const newSendStateByConversationId = getNewSendStateByConversationId(
      edit.sendStateByConversationId ?? {},
      receipt
    );

    return {
      ...edit,
      sendStateByConversationId: newSendStateByConversationId,
    };
  });

  if (message.editHistory?.length) {
    newAttributes.editHistory = newEditHistory;
  }

  const { editMessageTimestamp, timestamp } = message;
  if (
    (!editMessageTimestamp && messageSentAt === timestamp) ||
    messageSentAt === editMessageTimestamp
  ) {
    const newSendStateByConversationId = getNewSendStateByConversationId(
      message.sendStateByConversationId ?? {},
      receipt
    );
    newAttributes.sendStateByConversationId = newSendStateByConversationId;
  }

  return newAttributes;
}

async function addToDeleteSentProtoBatcher(
  receipt: MessageReceiptAttributesType,
  message: MessageAttributesType
) {
  const { sourceConversationId, type } = receipt;

  if (
    (type === MessageReceiptType.Delivery &&
      wasDeliveredWithSealedSender(sourceConversationId, message) &&
      receipt.wasSentEncrypted) ||
    type === MessageReceiptType.Read
  ) {
    const recipient = window.ConversationController.get(sourceConversationId);
    const recipientServiceId = recipient?.getServiceId();
    const deviceId = receipt.sourceDevice;

    if (recipientServiceId && deviceId) {
      await deleteSentProtoBatcher.add({
        timestamp: receipt.messageSentAt,
        recipientServiceId,
        deviceId,
      });
    } else {
      log.warn(
        `MessageReceipts.deleteSentProto(sentAt=${receipt.messageSentAt}): ` +
          `Missing serviceId or deviceId for deliveredTo ${sourceConversationId}`
      );
    }
  }
}

export async function onReceipt(
  receipt: MessageReceiptAttributesType
): Promise<void> {
  cachedReceipts.set(getReceiptCacheKey(receipt), receipt);
  await processReceiptBatcher.add(receipt);
}
