/* global Whisper, Backbone, _, ConversationController */

/* eslint-disable more/no-then */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};
  Whisper.ReadReceipts = new (Backbone.Collection.extend({
    forMessage(conversation, message) {
      if (!message.isOutgoing()) {
        return [];
      }
      let ids = [];
      if (conversation.isPrivate()) {
        ids = [conversation.id];
      } else {
        ids = conversation.get('members');
      }
      const receipts = this.filter(
        receipt =>
          receipt.get('timestamp') === message.get('sent_at') &&
          _.contains(ids, receipt.get('reader'))
      );
      if (receipts.length) {
        window.log.info('Found early read receipts for message');
        this.remove(receipts);
      }
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
              item.isOutgoing() &&
              receipt.get('reader') === item.get('conversationId')
          );
          if (message) {
            return message;
          }

          const groups = new Whisper.GroupCollection();
          return groups.fetchGroups(receipt.get('reader')).then(() => {
            const ids = groups.pluck('id');
            ids.push(receipt.get('reader'));
            return messages.find(
              item =>
                item.isOutgoing() && _.contains(ids, item.get('conversationId'))
            );
          });
        })
        .then(message => {
          if (message) {
            const readBy = message.get('read_by') || [];
            readBy.push(receipt.get('reader'));
            return new Promise((resolve, reject) => {
              message.save({ read_by: readBy }).then(() => {
                // notify frontend listeners
                const conversation = ConversationController.get(
                  message.get('conversationId')
                );
                if (conversation) {
                  conversation.trigger('read', message);
                }

                this.remove(receipt);
                resolve();
              }, reject);
            });
          }
          window.log.info(
            'No message for read receipt',
            receipt.get('reader'),
            receipt.get('timestamp')
          );

          return null;
        })
        .catch(error => {
          window.log.error(
            'ReadReceipts.onReceipt error:',
            error && error.stack ? error.stack : error
          );
        });
    },
  }))();
})();
