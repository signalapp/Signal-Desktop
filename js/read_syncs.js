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
  Whisper.ReadSyncs = new (Backbone.Collection.extend({
    forMessage(message) {
      const receipt = this.findWhere({
        sender: message.get('source'),
        timestamp: message.get('sent_at'),
      });
      if (receipt) {
        window.log.info('Found early read sync for message');
        this.remove(receipt);
        return receipt;
      }

      return null;
    },
    async onReceipt(receipt) {
      try {
        const messages = await window.Signal.Data.getMessagesBySentAt(
          receipt.get('timestamp'),
          {
            MessageCollection: Whisper.MessageCollection,
          }
        );

        const found = messages.find(
          item =>
            item.isIncoming() && item.get('source') === receipt.get('sender')
        );
        const notificationForMessage = found
          ? Whisper.Notifications.findWhere({ messageId: found.id })
          : null;
        Whisper.Notifications.remove(notificationForMessage);

        if (!found) {
          window.log.info(
            'No message for read sync',
            receipt.get('sender'),
            receipt.get('timestamp')
          );
          return;
        }

        const message = MessageController.register(found.id, found);
        const readAt = receipt.get('read_at');

        // If message is unread, we mark it read. Otherwise, we update the expiration
        //   timer to the time specified by the read sync if it's earlier than
        //   the previous read time.
        if (message.isUnread()) {
          await message.markRead(readAt, { skipSave: true });

          // onReadMessage may result in messages older than this one being
          //   marked read. We want those messages to have the same expire timer
          //   start time as this one, so we pass the readAt value through.
          const conversation = message.getConversation();
          if (conversation) {
            conversation.onReadMessage(message, readAt);
          }
        } else {
          const now = Date.now();
          const existingTimestamp = message.get('expirationStartTimestamp');
          const expirationStartTimestamp = Math.min(
            now,
            Math.min(existingTimestamp || now, readAt || now)
          );
          message.set({ expirationStartTimestamp });

          const force = true;
          await message.setToExpire(force, { skipSave: true });

          const conversation = message.getConversation();
          if (conversation) {
            conversation.trigger('expiration-change', message);
          }
        }

        await window.Signal.Data.saveMessage(message.attributes, {
          Message: Whisper.Message,
        });

        this.remove(receipt);
      } catch (error) {
        window.log.error(
          'ReadSyncs.onReceipt error:',
          error && error.stack ? error.stack : error
        );
      }
    },
  }))();
})();
