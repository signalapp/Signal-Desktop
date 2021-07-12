// Copyright 2016-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable max-classes-per-file */

import { Collection, Model } from 'backbone';

import { ConversationModel } from '../models/conversations';
import { MessageModel } from '../models/messages';
import { MessageModelCollectionType } from '../model-types.d';
import { isOutgoing } from '../state/selectors/message';

type ReadReceiptAttributesType = {
  reader: string;
  timestamp: number;
  readAt: number;
};

class ReadReceiptModel extends Model<ReadReceiptAttributesType> {}

let singleton: ReadReceipts | undefined;

async function getTargetMessage(
  reader: string,
  messages: MessageModelCollectionType
): Promise<MessageModel | null> {
  if (messages.length === 0) {
    return null;
  }
  const message = messages.find(
    item => isOutgoing(item.attributes) && reader === item.get('conversationId')
  );
  if (message) {
    return window.MessageController.register(message.id, message);
  }

  const groups = await window.Signal.Data.getAllGroupsInvolvingId(reader, {
    ConversationCollection: window.Whisper.ConversationCollection,
  });
  const ids = groups.pluck('id');
  ids.push(reader);

  const target = messages.find(
    item =>
      isOutgoing(item.attributes) && ids.includes(item.get('conversationId'))
  );
  if (!target) {
    return null;
  }

  return window.MessageController.register(target.id, target);
}

export class ReadReceipts extends Collection<ReadReceiptModel> {
  static getSingleton(): ReadReceipts {
    if (!singleton) {
      singleton = new ReadReceipts();
    }

    return singleton;
  }

  forMessage(
    conversation: ConversationModel,
    message: MessageModel
  ): Array<ReadReceiptModel> {
    if (!isOutgoing(message.attributes)) {
      return [];
    }
    let ids: Array<string>;
    if (conversation.isPrivate()) {
      ids = [conversation.id];
    } else {
      ids = conversation.getMemberIds();
    }
    const receipts = this.filter(
      receipt =>
        receipt.get('timestamp') === message.get('sent_at') &&
        ids.includes(receipt.get('reader'))
    );
    if (receipts.length) {
      window.log.info('Found early read receipts for message');
      this.remove(receipts);
    }
    return receipts;
  }

  async onReceipt(receipt: ReadReceiptModel): Promise<void> {
    try {
      const messages = await window.Signal.Data.getMessagesBySentAt(
        receipt.get('timestamp'),
        {
          MessageCollection: window.Whisper.MessageCollection,
        }
      );

      const message = await getTargetMessage(receipt.get('reader'), messages);

      if (!message) {
        window.log.info(
          'No message for read receipt',
          receipt.get('reader'),
          receipt.get('timestamp')
        );
        return;
      }

      const readBy = message.get('read_by') || [];
      const expirationStartTimestamp = message.get('expirationStartTimestamp');

      readBy.push(receipt.get('reader'));
      message.set({
        read_by: readBy,
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
        'ReadReceipts.onReceipt error:',
        error && error.stack ? error.stack : error
      );
    }
  }
}
