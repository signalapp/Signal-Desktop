// Copyright 2017-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable max-classes-per-file */

import { Collection, Model } from 'backbone';

import type { MessageModel } from '../models/messages';
import { isIncoming } from '../state/selectors/message';
import { isMessageUnread } from '../util/isMessageUnread';
import { notificationService } from '../services/notifications';
import * as log from '../logging/log';

export type ReadSyncAttributesType = {
  senderId: string;
  sender?: string;
  senderUuid: string;
  timestamp: number;
  readAt: number;
};

class ReadSyncModel extends Model<ReadSyncAttributesType> {}

let singleton: ReadSyncs | undefined;

async function maybeItIsAReactionReadSync(sync: ReadSyncModel): Promise<void> {
  const readReaction = await window.Signal.Data.markReactionAsRead(
    sync.get('senderUuid'),
    Number(sync.get('timestamp'))
  );

  if (!readReaction) {
    log.info(
      'Nothing found for read sync',
      sync.get('senderId'),
      sync.get('sender'),
      sync.get('senderUuid'),
      sync.get('timestamp')
    );
    return;
  }

  notificationService.removeBy({
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
    const sender = window.ConversationController.lookupOrCreate({
      e164: message.get('source'),
      uuid: message.get('sourceUuid'),
    });
    const sync = this.find(item => {
      return (
        item.get('senderId') === sender?.id &&
        item.get('timestamp') === message.get('sent_at')
      );
    });
    if (sync) {
      log.info(`Found early read sync for message ${sync.get('timestamp')}`);
      this.remove(sync);
      return sync;
    }

    return null;
  }

  async onSync(sync: ReadSyncModel): Promise<void> {
    try {
      const messages = await window.Signal.Data.getMessagesBySentAt(
        sync.get('timestamp')
      );

      const found = messages.find(item => {
        const sender = window.ConversationController.lookupOrCreate({
          e164: item.source,
          uuid: item.sourceUuid,
        });

        return isIncoming(item) && sender?.id === sync.get('senderId');
      });

      if (!found) {
        await maybeItIsAReactionReadSync(sync);
        return;
      }

      notificationService.removeBy({ messageId: found.id });

      const message = window.MessageController.register(found.id, found);
      const readAt = Math.min(sync.get('readAt'), Date.now());

      // If message is unread, we mark it read. Otherwise, we update the expiration
      //   timer to the time specified by the read sync if it's earlier than
      //   the previous read time.
      if (isMessageUnread(message.attributes)) {
        // TODO DESKTOP-1509: use MessageUpdater.markRead once this is TS
        message.markRead(readAt, { skipSave: true });

        const updateConversation = () => {
          // onReadMessage may result in messages older than this one being
          //   marked read. We want those messages to have the same expire timer
          //   start time as this one, so we pass the readAt value through.
          message.getConversation()?.onReadMessage(message, readAt);
        };

        if (window.startupProcessingQueue) {
          const conversation = message.getConversation();
          if (conversation) {
            window.startupProcessingQueue.add(
              conversation.get('id'),
              message.get('sent_at'),
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
      }

      window.Signal.Util.queueUpdateMessage(message.attributes);

      this.remove(sync);
    } catch (error) {
      log.error(
        'ReadSyncs.onSync error:',
        error && error.stack ? error.stack : error
      );
    }
  }
}
