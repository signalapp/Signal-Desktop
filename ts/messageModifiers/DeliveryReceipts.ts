// Copyright 2016-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable max-classes-per-file */

import { union } from 'lodash';
import { Collection, Model } from 'backbone';

import { ConversationModel } from '../models/conversations';
import { MessageModel } from '../models/messages';
import { MessageModelCollectionType } from '../model-types.d';
import { isIncoming } from '../state/selectors/message';

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
    try {
      const messages = await window.Signal.Data.getMessagesBySentAt(
        receipt.get('timestamp'),
        {
          MessageCollection: window.Whisper.MessageCollection,
        }
      );

      const message = await getTargetMessage(
        receipt.get('deliveredTo'),
        messages
      );
      if (!message) {
        window.log.info(
          'No message for delivery receipt',
          receipt.get('deliveredTo'),
          receipt.get('timestamp')
        );
        return;
      }

      const deliveries = message.get('delivered') || 0;
      const deliveredTo = message.get('delivered_to') || [];
      const expirationStartTimestamp = message.get('expirationStartTimestamp');
      message.set({
        delivered_to: union(deliveredTo, [receipt.get('deliveredTo')]),
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

      this.remove(receipt);
    } catch (error) {
      window.log.error(
        'DeliveryReceipts.onReceipt error:',
        error && error.stack ? error.stack : error
      );
    }
  }
}
