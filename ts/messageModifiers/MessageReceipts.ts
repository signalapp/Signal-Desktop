// Copyright 2016 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable max-classes-per-file */

import { isEqual } from 'lodash';
import { Collection, Model } from 'backbone';

import type { MessageModel } from '../models/messages';
import type { MessageAttributesType } from '../model-types.d';
import { isOutgoing, isStory } from '../state/selectors/message';
import { getOwn } from '../util/getOwn';
import { missingCaseError } from '../util/missingCaseError';
import { createWaitBatcher } from '../util/waitBatcher';
import type { UUIDStringType } from '../types/UUID';
import * as Errors from '../types/errors';
import {
  SendActionType,
  SendStatus,
  sendStateReducer,
} from '../messages/MessageSendState';
import type { DeleteSentProtoRecipientOptionsType } from '../sql/Interface';
import dataInterface from '../sql/Client';
import * as log from '../logging/log';
import { getSourceUuid } from '../messages/helpers';

const { deleteSentProtoRecipient } = dataInterface;

export enum MessageReceiptType {
  Delivery = 'Delivery',
  Read = 'Read',
  View = 'View',
}

export type MessageReceiptAttributesType = {
  messageSentAt: number;
  receiptTimestamp: number;
  sourceUuid: UUIDStringType;
  sourceConversationId: string;
  sourceDevice: number;
  type: MessageReceiptType;
  wasSentEncrypted: boolean;
};

class MessageReceiptModel extends Model<MessageReceiptAttributesType> {}

let singleton: MessageReceipts | undefined;

const deleteSentProtoBatcher = createWaitBatcher({
  name: 'deleteSentProtoBatcher',
  wait: 250,
  maxSize: 30,
  async processBatch(items: Array<DeleteSentProtoRecipientOptionsType>) {
    log.info(
      `MessageReceipts: Batching ${items.length} sent proto recipients deletes`
    );
    const { successfulPhoneNumberShares } = await deleteSentProtoRecipient(
      items
    );

    for (const uuid of successfulPhoneNumberShares) {
      const convo = window.ConversationController.get(uuid);
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

async function getTargetMessage(
  sourceId: string,
  sourceUuid: UUIDStringType,
  messages: ReadonlyArray<MessageAttributesType>
): Promise<MessageModel | null> {
  if (messages.length === 0) {
    return null;
  }
  const message = messages.find(
    item =>
      (isOutgoing(item) || isStory(item)) && sourceId === item.conversationId
  );
  if (message) {
    return window.MessageController.register(message.id, message);
  }

  const groups = await window.Signal.Data.getAllGroupsInvolvingUuid(sourceUuid);

  const ids = groups.map(item => item.id);
  ids.push(sourceId);

  const target = messages.find(
    item =>
      (isOutgoing(item) || isStory(item)) && ids.includes(item.conversationId)
  );
  if (!target) {
    return null;
  }

  return window.MessageController.register(target.id, target);
}

const wasDeliveredWithSealedSender = (
  conversationId: string,
  message: MessageModel
): boolean =>
  (message.get('unidentifiedDeliveries') || []).some(
    identifier =>
      window.ConversationController.getConversationId(identifier) ===
      conversationId
  );

const shouldDropReceipt = (
  receipt: MessageReceiptModel,
  message: MessageModel
): boolean => {
  const type = receipt.get('type');
  switch (type) {
    case MessageReceiptType.Delivery:
      return false;
    case MessageReceiptType.Read:
      return !window.storage.get('read-receipt-setting');
    case MessageReceiptType.View:
      if (isStory(message.attributes)) {
        return !window.Events.getStoryViewReceiptsEnabled();
      }
      return !window.storage.get('read-receipt-setting');
    default:
      throw missingCaseError(type);
  }
};

export class MessageReceipts extends Collection<MessageReceiptModel> {
  static getSingleton(): MessageReceipts {
    if (!singleton) {
      singleton = new MessageReceipts();
    }

    return singleton;
  }

  forMessage(message: MessageModel): Array<MessageReceiptModel> {
    if (!isOutgoing(message.attributes) && !isStory(message.attributes)) {
      return [];
    }

    const ourUuid = window.textsecure.storage.user.getCheckedUuid().toString();
    const sourceUuid = getSourceUuid(message.attributes);
    if (ourUuid !== sourceUuid) {
      return [];
    }

    const sentAt = message.get('sent_at');
    const receipts = this.filter(
      receipt => receipt.get('messageSentAt') === sentAt
    );
    if (receipts.length) {
      log.info(`MessageReceipts: found early receipts for message ${sentAt}`);
      this.remove(receipts);
    }
    return receipts.filter(receipt => {
      if (shouldDropReceipt(receipt, message)) {
        log.info(
          `MessageReceipts: Dropping an early receipt ${receipt.get('type')} ` +
            `for message ${sentAt}`
        );
        return false;
      }

      return true;
    });
  }

  private async updateMessageSendState(
    receipt: MessageReceiptModel,
    message: MessageModel
  ): Promise<void> {
    const messageSentAt = receipt.get('messageSentAt');

    if (shouldDropReceipt(receipt, message)) {
      log.info(
        `MessageReceipts: Dropping a receipt ${receipt.get('type')} ` +
          `for message ${messageSentAt}`
      );
      return;
    }

    const receiptTimestamp = receipt.get('receiptTimestamp');
    const sourceConversationId = receipt.get('sourceConversationId');
    const type = receipt.get('type');

    const oldSendStateByConversationId =
      message.get('sendStateByConversationId') || {};
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

    // The send state may not change. For example, this can happen if we get a read
    //   receipt before a delivery receipt.
    if (!isEqual(oldSendState, newSendState)) {
      message.set('sendStateByConversationId', {
        ...oldSendStateByConversationId,
        [sourceConversationId]: newSendState,
      });

      window.Signal.Util.queueUpdateMessage(message.attributes);

      // notify frontend listeners
      const conversation = window.ConversationController.get(
        message.get('conversationId')
      );
      const updateLeftPane = conversation
        ? conversation.debouncedUpdateLastMessage
        : undefined;
      if (updateLeftPane) {
        updateLeftPane();
      }
    }

    if (
      (type === MessageReceiptType.Delivery &&
        wasDeliveredWithSealedSender(sourceConversationId, message) &&
        receipt.get('wasSentEncrypted')) ||
      type === MessageReceiptType.Read
    ) {
      const recipient = window.ConversationController.get(sourceConversationId);
      const recipientUuid = recipient?.get('uuid');
      const deviceId = receipt.get('sourceDevice');

      if (recipientUuid && deviceId) {
        await Promise.all([
          deleteSentProtoBatcher.add({
            timestamp: messageSentAt,
            recipientUuid,
            deviceId,
          }),

          // We want the above call to not be delayed when testing with
          // CI.
          window.SignalCI
            ? deleteSentProtoBatcher.flushAndWait()
            : Promise.resolve(),
        ]);
      } else {
        log.warn(
          `MessageReceipts.onReceipt: Missing uuid or deviceId for deliveredTo ${sourceConversationId}`
        );
      }
    }
  }

  async onReceipt(receipt: MessageReceiptModel): Promise<void> {
    const messageSentAt = receipt.get('messageSentAt');
    const sourceConversationId = receipt.get('sourceConversationId');
    const sourceUuid = receipt.get('sourceUuid');
    const type = receipt.get('type');

    try {
      const messages = await window.Signal.Data.getMessagesBySentAt(
        messageSentAt
      );

      const message = await getTargetMessage(
        sourceConversationId,
        sourceUuid,
        messages
      );

      if (message) {
        await this.updateMessageSendState(receipt, message);
      } else {
        // We didn't find any messages but maybe it's a story sent message
        const targetMessages = messages.filter(
          item =>
            item.storyDistributionListId &&
            item.sendStateByConversationId &&
            !item.deletedForEveryone &&
            Boolean(item.sendStateByConversationId[sourceConversationId])
        );

        // Nope, no target message was found
        if (!targetMessages.length) {
          log.info(
            'MessageReceipts: No message for receipt',
            type,
            sourceConversationId,
            sourceUuid,
            messageSentAt
          );
          return;
        }

        await Promise.all(
          targetMessages.map(msg => {
            const model = window.MessageController.register(msg.id, msg);
            return this.updateMessageSendState(receipt, model);
          })
        );
      }

      this.remove(receipt);
    } catch (error) {
      log.error('MessageReceipts.onReceipt error:', Errors.toLogFormat(error));
    }
  }
}
