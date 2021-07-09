// Copyright 2016-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable max-classes-per-file */

import { isEqual } from 'lodash';
import { Collection, Model } from 'backbone';

import { ConversationModel } from '../models/conversations';
import { MessageModel } from '../models/messages';
import { MessageModelCollectionType } from '../model-types.d';
import { isIncoming } from '../state/selectors/message';
import { getOwn } from '../util/getOwn';
import { SendActionType, sendStateReducer } from '../messages/MessageSendState';

type DeliveryReceiptAttributesType = {
  timestamp: number;
  deliveredTo: string;
};

class DeliveryReceiptModel extends Model<DeliveryReceiptAttributesType> {}

let singleton: DeliveryReceipts | undefined;

async function getTargetMessage(
  sourceId: string,
  messages: MessageModelCollectionType
): Promise<MessageModel | null> {
  if (messages.length === 0) {
    return null;
  }
  const message = messages.find(
    item =>
      !isIncoming(item.attributes) && sourceId === item.get('conversationId')
  );
  if (message) {
    return window.MessageController.register(message.id, message);
  }

  const groups = await window.Signal.Data.getAllGroupsInvolvingId(sourceId, {
    ConversationCollection: window.Whisper.ConversationCollection,
  });

  const ids = groups.pluck('id');
  ids.push(sourceId);

  const target = messages.find(
    item =>
      !isIncoming(item.attributes) && ids.includes(item.get('conversationId'))
  );
  if (!target) {
    return null;
  }

  return window.MessageController.register(target.id, target);
}

export class DeliveryReceipts extends Collection<DeliveryReceiptModel> {
  static getSingleton(): DeliveryReceipts {
    if (!singleton) {
      singleton = new DeliveryReceipts();
    }

    return singleton;
  }

  forMessage(
    conversation: ConversationModel,
    message: MessageModel
  ): Array<DeliveryReceiptModel> {
    let recipients: Array<string>;
    if (conversation.isPrivate()) {
      recipients = [conversation.id];
    } else {
      recipients = conversation.getMemberIds();
    }
    const receipts = this.filter(
      receipt =>
        receipt.get('timestamp') === message.get('sent_at') &&
        recipients.indexOf(receipt.get('deliveredTo')) > -1
    );
    this.remove(receipts);
    return receipts;
  }

  async onReceipt(receipt: DeliveryReceiptModel): Promise<void> {
    const deliveredTo = receipt.get('deliveredTo');
    const timestamp = receipt.get('timestamp');

    try {
      const messages = await window.Signal.Data.getMessagesBySentAt(timestamp, {
        MessageCollection: window.Whisper.MessageCollection,
      });

      const message = await getTargetMessage(deliveredTo, messages);
      if (!message) {
        window.log.info(
          'No message for delivery receipt',
          deliveredTo,
          timestamp
        );
        return;
      }

      const oldSendStateByConversationId =
        message.get('sendStateByConversationId') || {};
      const oldSendState = getOwn(oldSendStateByConversationId, deliveredTo);
      if (oldSendState) {
        const newSendState = sendStateReducer(oldSendState, {
          type: SendActionType.GotDeliveryReceipt,
          updatedAt: timestamp,
        });

        // The send state may not change. This can happen if the message was marked read
        //   before we got the delivery receipt, or if we got double delivery receipts, or
        //   things like that.
        if (!isEqual(oldSendState, newSendState)) {
          message.set('sendStateByConversationId', {
            ...oldSendStateByConversationId,
            [deliveredTo]: newSendState,
          });

          await window.Signal.Data.updateMessageSendState({
            messageId: message.id,
            destinationConversationId: deliveredTo,
            ...newSendState,
          });

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
      } else {
        window.log.warn(
          `Got a delivery receipt from someone (${deliveredTo}), but the message (sent at ${message.get(
            'sent_at'
          )}) wasn't sent to them. It was sent to ${
            Object.keys(oldSendStateByConversationId).length
          } recipients`
        );
      }

      this.remove(receipt);
    } catch (error) {
      window.log.error(
        'DeliveryReceipts.onReceipt error:',
        error && error.stack ? error.stack : error
      );
    }
  }
}
