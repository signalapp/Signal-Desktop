(function() {
  'use strict';
  window.Whisper = window.Whisper || {};
  Whisper.ReadSyncs = new (Backbone.Collection.extend({
    forMessage: function(message) {
      var receipt = this.findWhere({
        sender: message.get('source'),
        timestamp: message.get('sent_at'),
      });
      if (receipt) {
        console.log('Found early read sync for message');
        this.remove(receipt);
        return receipt;
      }
    },
    onReceipt: function(receipt) {
      var messages = new Whisper.MessageCollection();
      return messages.fetchSentAt(receipt.get('timestamp')).then(
        function() {
          var message = messages.find(function(message) {
            return (
              message.isIncoming() &&
              message.isUnread() &&
              message.get('source') === receipt.get('sender')
            );
          });
          if (message) {
            Whisper.Notifications.remove(message);
            return message.markRead(receipt.get('read_at')).then(
              function() {
                this.notifyConversation(message);
                this.remove(receipt);
              }.bind(this)
            );
          } else {
            console.log(
              'No message for read sync',
              receipt.get('sender'),
              receipt.get('timestamp')
            );
          }
        }.bind(this)
      );
    },
    notifyConversation: function(message) {
      var conversation = ConversationController.get({
        id: message.get('conversationId'),
      });

      if (conversation) {
        conversation.onReadMessage(message);
      }
    },
  }))();
})();
