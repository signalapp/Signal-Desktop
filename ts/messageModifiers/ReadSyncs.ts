// Copyright 2017-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable max-classes-per-file */

import { Collection, Model } from 'backbone';

import { MessageModel } from '../models/messages';
import { isIncoming } from '../state/selectors/message';

type ReadSyncAttributesType = {
  senderId: string;
  sender: string;
  senderUuid: string;
  timestamp: number;
  readAt: number;
};

class ReadSyncModel extends Model<ReadSyncAttributesType> {}

let singleton: ReadSyncs | undefined;

async function maybeItIsAReactionReadSync(
  receipt: ReadSyncModel
): Promise<void> {
  const readReaction = await window.Signal.Data.markReactionAsRead(
    receipt.get('senderUuid'),
    Number(receipt.get('timestamp'))
  );

  if (!readReaction) {
    window.log.info(
      'Nothing found for read sync',
      receipt.get('senderId'),
      receipt.get('sender'),
      receipt.get('senderUuid'),
      receipt.get('timestamp')
    );
    return;
  }

  window.Whisper.Notifications.removeBy({
    conversationId: readReaction.conversationId,
    emoji: readReaction.emoji,
    targetAuthorUuid: readReaction.targetAuthorUuid,
    targetTimestamp: readReaction.targetTimestamp,
  });
}

export class ReadSyncs extends Collection {
  static getSingleton(): ReadSyncs {
    if (!singleton) {
      singleton = new ReadSyncs();
    }

    return singleton;
  }

  forMessage(message: MessageModel): ReadSyncModel | null {
    const senderId = window.ConversationController.ensureContactIds({
      e164: message.get('source'),
      uuid: message.get('sourceUuid'),
    });
    const receipt = this.find(item => {
      return (
        item.get('senderId') === senderId &&
        item.get('timestamp') === message.get('sent_at')
      );
    });
    if (receipt) {
      window.log.info('Found early read sync for message');
      this.remove(receipt);
      return receipt;
    }

    return null;
  }

  async onReceipt(receipt: ReadSyncModel): Promise<void> {
    try {
      const messages = await window.Signal.Data.getMessagesBySentAt(
        receipt.get('timestamp'),
        {
          MessageCollection: window.Whisper.MessageCollection,
        }
      );

      const found = messages.find(item => {
        const senderId = window.ConversationController.ensureContactIds({
          e164: item.get('source'),
          uuid: item.get('sourceUuid'),
        });

        return (
          isIncoming(item.attributes) && senderId === receipt.get('senderId')
        );
      });

      if (!found) {
        await maybeItIsAReactionReadSync(receipt);
        return;
      }

      window.Whisper.Notifications.removeBy({ messageId: found.id });

      const message = window.MessageController.register(found.id, found);
      const readAt = receipt.get('readAt');

      // If message is unread, we mark it read. Otherwise, we update the expiration
      //   timer to the time specified by the read sync if it's earlier than
      //   the previous read time.
      if (message.isUnread()) {
        // TODO DESKTOP-1509: use MessageUpdater.markRead once this is TS
        message.markRead(readAt, { skipSave: true });

        const updateConversation = () => {
          // onReadMessage may result in messages older than this one being
          //   marked read. We want those messages to have the same expire timer
          //   start time as this one, so we pass the readAt value through.
          const conversation = message.getConversation();
          if (conversation) {
            conversation.onReadMessage(message, readAt);
          }
        };

        if (window.startupProcessingQueue) {
          const conversation = message.getConversation();
          if (conversation) {
            window.startupProcessingQueue.add(
              conversation.get('id'),
              updateConversation
            );
          }
        } else {
          updateConversation();
        }
      } else {
        const now = Date.now();
        const existingTimestamp = message.get('expirationStartTimestamp');
        const expirationStartTimestamp = Math.min(
          now,
          Math.min(existingTimestamp || now, readAt || now)
        );
        message.set({ expirationStartTimestamp });

        const conversation = message.getConversation();
        if (conversation) {
          conversation.trigger('expiration-change', message);
        }
      }

      window.Signal.Util.queueUpdateMessage(message.attributes);

      this.remove(receipt);
    } catch (error) {
      window.log.error(
        'ReadSyncs.onReceipt error:',
        error && error.stack ? error.stack : error
      );
    }
  }
}
