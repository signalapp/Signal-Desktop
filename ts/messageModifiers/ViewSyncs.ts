// Copyright 2019-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable max-classes-per-file */

import { Collection, Model } from 'backbone';
import { MessageModel } from '../models/messages';

type ViewSyncAttributesType = {
  source?: string;
  sourceUuid: string;
  timestamp: number;
};

class ViewSyncModel extends Model<ViewSyncAttributesType> {}

let singleton: ViewSyncs | undefined;

export class ViewSyncs extends Collection<ViewSyncModel> {
  static getSingleton(): ViewSyncs {
    if (!singleton) {
      singleton = new ViewSyncs();
    }

    return singleton;
  }

  forMessage(message: MessageModel): ViewSyncModel | null {
    const syncBySourceUuid = this.find(item => {
      return (
        item.get('sourceUuid') === message.get('sourceUuid') &&
        item.get('timestamp') === message.get('sent_at')
      );
    });
    if (syncBySourceUuid) {
      window.log.info('Found early view sync for message');
      this.remove(syncBySourceUuid);
      return syncBySourceUuid;
    }

    const syncBySource = this.find(item => {
      return (
        item.get('source') === message.get('source') &&
        item.get('timestamp') === message.get('sent_at')
      );
    });
    if (syncBySource) {
      window.log.info('Found early view sync for message');
      this.remove(syncBySource);
      return syncBySource;
    }

    return null;
  }

  async onSync(sync: ViewSyncModel): Promise<void> {
    try {
      const messages = await window.Signal.Data.getMessagesBySentAt(
        sync.get('timestamp'),
        {
          MessageCollection: window.Whisper.MessageCollection,
        }
      );

      const found = messages.find(item => {
        const itemSourceUuid = item.get('sourceUuid');
        const syncSourceUuid = sync.get('sourceUuid');
        const itemSource = item.get('source');
        const syncSource = sync.get('source');

        return Boolean(
          (itemSourceUuid &&
            syncSourceUuid &&
            itemSourceUuid === syncSourceUuid) ||
            (itemSource && syncSource && itemSource === syncSource)
        );
      });

      const syncSource = sync.get('source');
      const syncSourceUuid = sync.get('sourceUuid');
      const syncTimestamp = sync.get('timestamp');
      const wasMessageFound = Boolean(found);
      window.log.info('Receive view sync:', {
        syncSource,
        syncSourceUuid,
        syncTimestamp,
        wasMessageFound,
      });

      if (!found) {
        return;
      }

      const message = window.MessageController.register(found.id, found);
      await message.markViewed({ fromSync: true });

      this.remove(sync);
    } catch (error) {
      window.log.error(
        'ViewSyncs.onSync error:',
        error && error.stack ? error.stack : error
      );
    }
  }
}
