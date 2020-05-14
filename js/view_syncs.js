/* global
  Backbone,
  Whisper,
  MessageController
*/

/* eslint-disable more/no-then */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};
  Whisper.ViewSyncs = new (Backbone.Collection.extend({
    forMessage(message) {
      const syncBySourceUuid = this.findWhere({
        sourceUuid: message.get('sourceUuid'),
        timestamp: message.get('sent_at'),
      });
      if (syncBySourceUuid) {
        window.log.info('Found early view sync for message');
        this.remove(syncBySourceUuid);
        return syncBySourceUuid;
      }

      const syncBySource = this.findWhere({
        source: message.get('source'),
        timestamp: message.get('sent_at'),
      });
      if (syncBySource) {
        window.log.info('Found early view sync for message');
        this.remove(syncBySource);
        return syncBySource;
      }

      return null;
    },
    async onSync(sync) {
      try {
        const messages = await window.Signal.Data.getMessagesBySentAt(
          sync.get('timestamp'),
          {
            MessageCollection: Whisper.MessageCollection,
          }
        );

        const found = messages.find(item => {
          const itemSourceUuid = item.get('sourceUuid');
          const syncSourceUuid = sync.get('sourceUuid');
          const itemSource = item.get('source');
          const syncSource = sync.get('source');

          return (
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

        const message = MessageController.register(found.id, found);
        await message.markViewed({ fromSync: true });

        this.remove(sync);
      } catch (error) {
        window.log.error(
          'ViewSyncs.onSync error:',
          error && error.stack ? error.stack : error
        );
      }
    },
  }))();
})();
