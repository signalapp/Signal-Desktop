// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable max-classes-per-file */

import { Collection, Model } from 'backbone';

import type { MessageModel } from '../models/messages';
import { ReadStatus } from '../messages/MessageReadStatus';
import { markViewed } from '../services/MessageUpdater';
import { isIncoming } from '../state/selectors/message';
import { notificationService } from '../services/notifications';
import * as log from '../logging/log';
import { GiftBadgeStates } from '../components/conversation/Message';

export type ViewSyncAttributesType = {
  senderId: string;
  senderE164?: string;
  senderUuid: string;
  timestamp: number;
  viewedAt: number;
};

class ViewSyncModel extends Model<ViewSyncAttributesType> {}

let singleton: ViewSyncs | undefined;

export class ViewSyncs extends Collection {
  static getSingleton(): ViewSyncs {
    if (!singleton) {
      singleton = new ViewSyncs();
    }

    return singleton;
  }

  forMessage(message: MessageModel): Array<ViewSyncModel> {
    const sender = window.ConversationController.lookupOrCreate({
      e164: message.get('source'),
      uuid: message.get('sourceUuid'),
    });
    const syncs = this.filter(item => {
      return (
        item.get('senderId') === sender?.id &&
        item.get('timestamp') === message.get('sent_at')
      );
    });
    if (syncs.length) {
      log.info(
        `Found ${syncs.length} early view sync(s) for message ${message.get(
          'sent_at'
        )}`
      );
      this.remove(syncs);
    }
    return syncs;
  }

  async onSync(sync: ViewSyncModel): Promise<void> {
    try {
      const messages = await window.Signal.Data.getMessagesBySentAt(
        sync.get('timestamp')
      );

      const found = messages.find(item => {
        const sender = window.ConversationController.lookupOrCreate({
          e164: item.source,
          uuid: item.sourceUuid,
        });

        return sender?.id === sync.get('senderId');
      });

      if (!found) {
        log.info(
          'Nothing found for view sync',
          sync.get('senderId'),
          sync.get('senderE164'),
          sync.get('senderUuid'),
          sync.get('timestamp')
        );
        return;
      }

      notificationService.removeBy({ messageId: found.id });

      const message = window.MessageController.register(found.id, found);

      if (message.get('readStatus') !== ReadStatus.Viewed) {
        message.set(markViewed(message.attributes, sync.get('viewedAt')));
      }

      const giftBadge = message.get('giftBadge');
      if (giftBadge) {
        message.set({
          giftBadge: {
            ...giftBadge,
            state: isIncoming(message.attributes)
              ? GiftBadgeStates.Redeemed
              : GiftBadgeStates.Opened,
          },
        });
      }

      this.remove(sync);
    } catch (error) {
      log.error(
        'ViewSyncs.onSync error:',
        error && error.stack ? error.stack : error
      );
    }
  }
}
