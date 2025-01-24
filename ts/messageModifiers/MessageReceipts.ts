// Copyright 2016 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { z } from 'zod';
import { groupBy } from 'lodash';

import type {
  MessageAttributesType,
  ReadonlyMessageAttributesType,
} from '../model-types.d';
import type { SendStateByConversationId } from '../messages/MessageSendState';
import { isOutgoing, isStory } from '../state/selectors/message';
import { getOwn } from '../util/getOwn';
import { missingCaseError } from '../util/missingCaseError';
import { createWaitBatcher } from '../util/waitBatcher';
import { isServiceIdString } from '../types/ServiceId';
import {
  SendActionType,
  SendStatus,
  UNDELIVERED_SEND_STATUSES,
  sendStateReducer,
} from '../messages/MessageSendState';
import { DataReader, DataWriter } from '../sql/Client';
import type { DeleteSentProtoRecipientOptionsType } from '../sql/Interface';
import * as log from '../logging/log';
import { getSourceServiceId } from '../messages/helpers';
import { getMessageSentTimestamp } from '../util/getMessageSentTimestamp';
import { getMessageIdForLogging } from '../util/idForLogging';
import { getPropForTimestamp } from '../util/editHelpers';
import {
  DELETE_SENT_PROTO_BATCHER_WAIT_MS,
  RECEIPT_BATCHER_WAIT_MS,
} from '../types/Receipt';
import { drop } from '../util/drop';
import { getMessageById } from '../messages/getMessageById';
import { MessageModel } from '../models/messages';

const { deleteSentProtoRecipient, removeSyncTaskById } = DataWriter;

export const messageReceiptTypeSchema = z.enum(['Delivery', 'Read', 'View']);

export type MessageReceiptType = z.infer<typeof messageReceiptTypeSchema>;

export const receiptSyncTaskSchema = z.object({
  messageSentAt: z.number(),
  receiptTimestamp: z.number(),
  sourceConversationId: z.string(),
  sourceDevice: z.number(),
  sourceServiceId: z.string().refine(isServiceIdString),
  type: messageReceiptTypeSchema,
  wasSentEncrypted: z.boolean(),
});

export type ReceiptSyncTaskType = z.infer<typeof receiptSyncTaskSchema>;

export type MessageReceiptAttributesType = {
  envelopeId: string;
  syncTaskId: string;
  receiptSync: ReceiptSyncTaskType;
};

const cachedReceipts = new Map<string, MessageReceiptAttributesType>();

const processReceiptBatcher = createWaitBatcher({
  name: 'processReceiptBatcher',
  wait: RECEIPT_BATCHER_WAIT_MS,
  maxSize: 250,
  async processBatch(receipts: Array<MessageReceiptAttributesType>) {
    // First group by sentAt, so that we can find the target message
    const receiptsByMessageSentAt = groupBy(
      receipts,
      receipt => receipt.receiptSync.messageSentAt
    );

    // Once we find the message, we'll group them by messageId to process
    // all receipts for a given message
    const receiptsByMessageId: Map<
      string,
      Array<MessageReceiptAttributesType>
    > = new Map();

    function addReceiptAndTargetMessage(
      message: MessageModel,
      receipt: MessageReceiptAttributesType
    ): void {
      const existing = receiptsByMessageId.get(message.id);
      if (!existing) {
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
      const sentAt = receiptsForMessageSentAt[0].receiptSync.messageSentAt;

      const messagesMatchingTimestamp =
        // eslint-disable-next-line no-await-in-loop
        await DataReader.getMessagesBySentAt(sentAt);

      if (messagesMatchingTimestamp.length === 0) {
        // eslint-disable-next-line no-await-in-loop
        const reaction = await DataReader.getReactionByTimestamp(
          window.ConversationController.getOurConversationIdOrThrow(),
          sentAt
        );

        if (reaction) {
          for (const receipt of receiptsForMessageSentAt) {
            const { receiptSync } = receipt;
            log.info(
              'MesageReceipts.processReceiptBatcher: Got receipt for reaction',
              receiptSync.messageSentAt,
              receiptSync.type,
              receiptSync.sourceConversationId,
              receiptSync.sourceServiceId
            );
            // eslint-disable-next-line no-await-in-loop
            await remove(receipt);
          }
          continue;
        }
      }

      for (const receipt of receiptsForMessageSentAt) {
        const targetMessage = getTargetMessage({
          sourceConversationId: receipt.receiptSync.sourceConversationId,
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
                item.sendStateByConversationId[
                  receipt.receiptSync.sourceConversationId
                ]
              )
          );

          if (targetMessages.length) {
            targetMessages.forEach(msg => {
              const model = window.MessageCache.register(new MessageModel(msg));
              addReceiptAndTargetMessage(model, receipt);
            });
          } else {
            // Nope, no target message was found
            const { receiptSync } = receipt;
            log.info(
              'MessageReceipts.processReceiptBatcher: No message for receipt',
              receiptSync.messageSentAt,
              receiptSync.type,
              receiptSync.sourceConversationId,
              receiptSync.sourceServiceId
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
  const message = await getMessageById(messageId);
  if (!message) {
    throw new Error(
      `processReceiptsForMessage: Failed to find message ${messageId}`
    );
  }

  const { validReceipts } = await updateMessageWithReceipts(message, receipts);

  await window.MessageCache.saveMessage(message.attributes);

  // Confirm/remove receipts, and delete sent protos
  for (const receipt of validReceipts) {
    // eslint-disable-next-line no-await-in-loop
    await remove(receipt);
    drop(addToDeleteSentProtoBatcher(receipt, message.attributes));
  }

  // notify frontend listeners
  const conversation = window.ConversationController.get(
    message.get('conversationId')
  );
  conversation?.debouncedUpdateLastMessage?.();
}

async function updateMessageWithReceipts(
  message: MessageModel,
  receipts: Array<MessageReceiptAttributesType>
): Promise<{
  validReceipts: Array<MessageReceiptAttributesType>;
}> {
  const logId = `updateMessageWithReceipts(timestamp=${message.get('timestamp')})`;

  const droppedReceipts: Array<MessageReceiptAttributesType> = [];
  const receiptsToProcess = receipts.filter(receipt => {
    if (shouldDropReceipt(receipt, message.attributes)) {
      const { receiptSync } = receipt;
      log.info(
        `${logId}: Dropping a receipt ${receiptSync.type} for sentAt=${receiptSync.messageSentAt}`
      );
      droppedReceipts.push(receipt);
      return false;
    }

    if (!cachedReceipts.has(receipt.syncTaskId)) {
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
  let { attributes } = message;
  for (const receipt of receiptsToProcess) {
    attributes = {
      ...attributes,
      ...updateMessageSendStateWithReceipt(attributes, receipt),
    };
  }
  message.set(attributes);

  return { validReceipts: receiptsToProcess };
}

const deleteSentProtoBatcher = createWaitBatcher({
  name: 'deleteSentProtoBatcher',
  wait: DELETE_SENT_PROTO_BATCHER_WAIT_MS,
  maxSize: 30,
  async processBatch(items: Array<DeleteSentProtoRecipientOptionsType>) {
    log.info(
      `MessageReceipts: Batching ${items.length} sent proto recipients deletes`
    );
    const { successfulPhoneNumberShares } =
      await deleteSentProtoRecipient(items);

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

async function remove(receipt: MessageReceiptAttributesType): Promise<void> {
  const { syncTaskId } = receipt;
  cachedReceipts.delete(syncTaskId);
  await removeSyncTaskById(syncTaskId);
}

function getTargetMessage({
  sourceConversationId,
  messagesMatchingTimestamp,
  targetTimestamp,
}: {
  sourceConversationId: string;
  messagesMatchingTimestamp: ReadonlyArray<MessageAttributesType>;
  targetTimestamp: number;
}): MessageModel | null {
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
  return window.MessageCache.register(new MessageModel(message));
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
  message: ReadonlyMessageAttributesType
): boolean => {
  const { type } = receipt.receiptSync;
  switch (type) {
    case messageReceiptTypeSchema.Enum.Delivery:
      return false;
    case messageReceiptTypeSchema.Enum.Read:
      return !window.storage.get('read-receipt-setting');
    case messageReceiptTypeSchema.Enum.View:
      if (isStory(message)) {
        return !window.Events.getStoryViewReceiptsEnabled();
      }
      return !window.storage.get('read-receipt-setting');
    default:
      throw missingCaseError(type);
  }
};

export async function forMessage(
  message: ReadonlyMessageAttributesType
): Promise<Array<MessageReceiptAttributesType>> {
  if (!isOutgoing(message) && !isStory(message)) {
    return [];
  }

  const logId = `MessageReceipts.forMessage(${getMessageIdForLogging(
    message
  )})`;

  const ourAci = window.textsecure.storage.user.getCheckedAci();
  const sourceServiceId = getSourceServiceId(message);
  if (ourAci !== sourceServiceId) {
    return [];
  }

  const receiptValues = Array.from(cachedReceipts.values());

  const sentAt = getMessageSentTimestamp(message, { log });
  const result = receiptValues.filter(
    item => item.receiptSync.messageSentAt === sentAt
  );
  if (result.length > 0) {
    log.info(`${logId}: found early receipts for message ${sentAt}`);
    await Promise.all(
      result.map(async receipt => {
        await remove(receipt);
      })
    );
  }

  return result.filter(receipt => {
    if (shouldDropReceipt(receipt, message)) {
      log.info(
        `${logId}: Dropping an early receipt ${receipt.receiptSync.type} for message ${sentAt}`
      );
      return false;
    }

    return true;
  });
}

function getNewSendStateByConversationId(
  oldSendStateByConversationId: SendStateByConversationId,
  receipt: MessageReceiptAttributesType
): SendStateByConversationId {
  const { receiptTimestamp, sourceConversationId, type } = receipt.receiptSync;
  const oldSendState = getOwn(
    oldSendStateByConversationId,
    sourceConversationId
  ) ?? { status: SendStatus.Sent, updatedAt: undefined };

  let sendActionType: SendActionType;
  switch (type) {
    case messageReceiptTypeSchema.enum.Delivery:
      sendActionType = SendActionType.GotDeliveryReceipt;
      break;
    case messageReceiptTypeSchema.enum.Read:
      sendActionType = SendActionType.GotReadReceipt;
      break;
    case messageReceiptTypeSchema.enum.View:
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
  const { messageSentAt } = receipt.receiptSync;

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
  const { receiptSync } = receipt;
  const {
    sourceConversationId,
    type,
    wasSentEncrypted,
    messageSentAt,
    sourceDevice,
  } = receiptSync;

  if (
    (type === messageReceiptTypeSchema.enum.Delivery &&
      wasDeliveredWithSealedSender(sourceConversationId, message) &&
      wasSentEncrypted) ||
    type === messageReceiptTypeSchema.enum.Read
  ) {
    const recipient = window.ConversationController.get(sourceConversationId);
    const recipientServiceId = recipient?.getServiceId();
    const deviceId = sourceDevice;

    if (recipientServiceId && deviceId) {
      await deleteSentProtoBatcher.add({
        timestamp: messageSentAt,
        recipientServiceId,
        deviceId,
      });
    } else {
      log.warn(
        `MessageReceipts.deleteSentProto(sentAt=${messageSentAt}): ` +
          `Missing serviceId or deviceId for deliveredTo ${sourceConversationId}`
      );
    }
  }
}

export async function onReceipt(
  receipt: MessageReceiptAttributesType
): Promise<void> {
  cachedReceipts.set(receipt.syncTaskId, receipt);
  await processReceiptBatcher.add(receipt);
}
