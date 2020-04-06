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
      const sync = this.findWhere({
        conversationId: message.get('conversationId'),
        timestamp: message.get('sent_at'),
      });
      if (sync) {
        window.log.info('Found early view sync for message');
        this.remove(sync);
        return sync;
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

        const found = messages.find(
          item => item.get('conversationId') === sync.get('conversationId')
        );
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
