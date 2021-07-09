// Copyright 2016-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable max-classes-per-file */

import { isEqual } from 'lodash';
import { Collection, Model } from 'backbone';

import { ConversationModel } from '../models/conversations';
import { MessageModel } from '../models/messages';
import { MessageModelCollectionType } from '../model-types.d';
import { isOutgoing } from '../state/selectors/message';
import { getOwn } from '../util/getOwn';
import { SendActionType, sendStateReducer } from '../messages/MessageSendState';

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
    const reader = receipt.get('reader');
    const timestamp = receipt.get('timestamp');

    try {
      const messages = await window.Signal.Data.getMessagesBySentAt(timestamp, {
        MessageCollection: window.Whisper.MessageCollection,
      });

      const message = await getTargetMessage(receipt.get('reader'), messages);

      if (!message) {
        window.log.info('No message for read receipt', reader, timestamp);
        return;
      }

      const oldSendStateByConversationId =
        message.get('sendStateByConversationId') || {};
      const oldSendState = getOwn(oldSendStateByConversationId, reader);
      if (oldSendState) {
        const newSendState = sendStateReducer(oldSendState, {
          type: SendActionType.GotReadReceipt,
          updatedAt: timestamp,
        });

        // The send state may not change. This can happen if we get read receipts after
        //   we get viewed receipts, or if we get double read receipts, or things like
        //   that.
        if (!isEqual(oldSendState, newSendState)) {
          message.set('sendStateByConversationId', {
            ...oldSendStateByConversationId,
            [reader]: newSendState,
          });

          await window.Signal.Data.updateMessageSendState({
            messageId: message.id,
            destinationConversationId: reader,
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
          `Got a read receipt from someone (${reader}), but the message (sent at ${message.get(
            'sent_at'
          )}) wasn't sent to them. It was sent to ${
            Object.keys(oldSendStateByConversationId).length
          } recipients`
        );
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
