/* global Backbone, Whisper, ConversationController */

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
        console.log('Found early read sync for message');
        this.remove(receipt);
        return receipt;
      }

      return null;
    },
    onReceipt(receipt) {
      const messages = new Whisper.MessageCollection();
      return messages.fetchSentAt(receipt.get('timestamp')).then(() => {
        const message = messages.find(
          item =>
            item.isIncoming() &&
            item.isUnread() &&
            item.get('source') === receipt.get('sender')
        );
        const notificationForMessage = message
          ? Whisper.Notifications.findWhere({ messageId: message.id })
          : null;
        const removedNotification = Whisper.Notifications.remove(
          notificationForMessage
        );
        const receiptSender = receipt.get('sender');
        const receiptTimestamp = receipt.get('timestamp');
        const wasMessageFound = Boolean(message);
        const wasNotificationFound = Boolean(notificationForMessage);
        const wasNotificationRemoved = Boolean(removedNotification);
        console.log('Receive read sync:', {
          receiptSender,
          receiptTimestamp,
          wasMessageFound,
          wasNotificationFound,
          wasNotificationRemoved,
        });
        return message
          ? message.markRead(receipt.get('read_at')).then(() => {
              // This notification may result in messages older than this one being
              //   marked read. We want those messages to have the same expire timer
              //   start time as this one, so we pass the read_at value through.
              this.notifyConversation(message, receipt.get('read_at'));
              this.remove(receipt);
            })
          : Promise.resolve();
      });
    },
    notifyConversation(message, readAt) {
      const conversation = ConversationController.get({
        id: message.get('conversationId'),
      });

      if (conversation) {
        conversation.onReadMessage(message, readAt);
      }
    },
  }))();
})();
