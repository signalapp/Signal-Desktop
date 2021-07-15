// Copyright 2016-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable max-classes-per-file */

import { union } from 'lodash';
import { Collection, Model } from 'backbone';

import { ConversationModel } from '../models/conversations';
import { MessageModel } from '../models/messages';
import { MessageModelCollectionType } from '../model-types.d';
import { isIncoming } from '../state/selectors/message';
import { isDirectConversation } from '../util/whatTypeOfConversation';
import dataInterface from '../sql/Client';

const { deleteSentProtoRecipient } = dataInterface;

type DeliveryReceiptAttributesType = {
  timestamp: number;
  deliveredTo: string;
  deliveredToDevice: number;
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
    if (isDirectConversation(conversation.attributes)) {
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
    const timestamp = receipt.get('timestamp');
    const deliveredTo = receipt.get('deliveredTo');

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

      const deliveries = message.get('delivered') || 0;
      const originalDeliveredTo = message.get('delivered_to') || [];
      const expirationStartTimestamp = message.get('expirationStartTimestamp');
      message.set({
        delivered_to: union(originalDeliveredTo, [deliveredTo]),
        delivered: deliveries + 1,
        expirationStartTimestamp: expirationStartTimestamp || Date.now(),
        sent: true,
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

      const unidentifiedLookup = (
        message.get('unidentifiedDeliveries') || []
      ).reduce((accumulator: Record<string, boolean>, identifier: string) => {
        const id = window.ConversationController.getConversationId(identifier);
        if (id) {
          accumulator[id] = true;
        }
        return accumulator;
      }, Object.create(null) as Record<string, boolean>);
      const recipient = window.ConversationController.get(deliveredTo);
      if (recipient && unidentifiedLookup[recipient.id]) {
        const recipientUuid = recipient?.get('uuid');
        const deviceId = receipt.get('deliveredToDevice');

        if (recipientUuid && deviceId) {
          await deleteSentProtoRecipient({
            timestamp,
            recipientUuid,
            deviceId,
          });
        } else {
          window.log.warn(
            `DeliveryReceipts.onReceipt: Missing uuid or deviceId for deliveredTo ${deliveredTo}`
          );
        }
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
