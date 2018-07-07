/* global Backbone: false */
/* global Whisper: false */
/* global ConversationController: false */
/* global _: false */

/* eslint-disable more/no-then */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  Whisper.DeliveryReceipts = new (Backbone.Collection.extend({
    forMessage(conversation, message) {
      let recipients;
      if (conversation.isPrivate()) {
        recipients = [conversation.id];
      } else {
        recipients = conversation.get('members') || [];
      }
      const receipts = this.filter(
        receipt =>
          receipt.get('timestamp') === message.get('sent_at') &&
          recipients.indexOf(receipt.get('source')) > -1
      );
      this.remove(receipts);
      return receipts;
    },
    onReceipt(receipt) {
      const messages = new Whisper.MessageCollection();
      return messages
        .fetchSentAt(receipt.get('timestamp'))
        .then(() => {
          if (messages.length === 0) {
            return null;
          }
          const message = messages.find(
            item =>
              !item.isIncoming() &&
              receipt.get('source') === item.get('conversationId')
          );
          if (message) {
            return message;
          }

          const groups = new Whisper.GroupCollection();
          return groups.fetchGroups(receipt.get('source')).then(() => {
            const ids = groups.pluck('id');
            ids.push(receipt.get('source'));
            return messages.find(
              item =>
                !item.isIncoming() &&
                _.contains(ids, item.get('conversationId'))
            );
          });
        })
        .then(message => {
          if (message) {
            const deliveries = message.get('delivered') || 0;
            const deliveredTo = message.get('delivered_to') || [];
            return new Promise((resolve, reject) => {
              message
                .save({
                  delivered_to: _.union(deliveredTo, [receipt.get('source')]),
                  delivered: deliveries + 1,
                })
                .then(() => {
                  // notify frontend listeners
                  const conversation = ConversationController.get(
                    message.get('conversationId')
                  );
                  if (conversation) {
                    conversation.trigger('delivered', message);
                  }

                  this.remove(receipt);
                  resolve();
                }, reject);
            });
            // TODO: consider keeping a list of numbers we've
            // successfully delivered to?
          }
          console.log(
            'No message for delivery receipt',
            receipt.get('source'),
            receipt.get('timestamp')
          );

          return null;
        })
        .catch(error => {
          console.log(
            'DeliveryReceipts.onReceipt error:',
            error && error.stack ? error.stack : error
          );
        });
    },
  }))();
})();
