// Copyright 2019-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable max-classes-per-file */

import { Collection, Model } from 'backbone';
import type { MessageModel } from '../models/messages';
import * as log from '../logging/log';

export type ViewOnceOpenSyncAttributesType = {
  source?: string;
  sourceUuid: string;
  timestamp: number;
};

class ViewOnceOpenSyncModel extends Model<ViewOnceOpenSyncAttributesType> {}

let singleton: ViewOnceOpenSyncs | undefined;

export class ViewOnceOpenSyncs extends Collection<ViewOnceOpenSyncModel> {
  static getSingleton(): ViewOnceOpenSyncs {
    if (!singleton) {
      singleton = new ViewOnceOpenSyncs();
    }

    return singleton;
  }

  forMessage(message: MessageModel): ViewOnceOpenSyncModel | null {
    const syncBySourceUuid = this.find(item => {
      return (
        item.get('sourceUuid') === message.get('sourceUuid') &&
        item.get('timestamp') === message.get('sent_at')
      );
    });
    if (syncBySourceUuid) {
      log.info('Found early view once open sync for message');
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
      log.info('Found early view once open sync for message');
      this.remove(syncBySource);
      return syncBySource;
    }

    return null;
  }

  async onSync(sync: ViewOnceOpenSyncModel): Promise<void> {
    try {
      const messages = await window.Signal.Data.getMessagesBySentAt(
        sync.get('timestamp')
      );

      const found = messages.find(item => {
        const itemSourceUuid = item.sourceUuid;
        const syncSourceUuid = sync.get('sourceUuid');
        const itemSource = item.source;
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
      log.info('Receive view once open sync:', {
        syncSource,
        syncSourceUuid,
        syncTimestamp,
        wasMessageFound,
      });

      if (!found) {
        return;
      }

      const message = window.MessageController.register(found.id, found);
      await message.markViewOnceMessageViewed({ fromSync: true });

      this.remove(sync);
    } catch (error) {
      log.error(
        'ViewOnceOpenSyncs.onSync error:',
        error && error.stack ? error.stack : error
      );
    }
  }
}
