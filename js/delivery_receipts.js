/*
 * vim: ts=4:sw=4:expandtab
 */
;(function() {
    'use strict';
    window.Whisper = window.Whisper || {};

    var GroupCollection = Backbone.Collection.extend({
      database: Whisper.Database,
      storeName: 'conversations',
      model: Backbone.Model,
      fetchGroups: function(number) {
          return new Promise(function(resolve) {
              this.fetch({
                  index: {
                      name: 'group',
                      only: number
                  }
              }).always(resolve);
          }.bind(this));
      }
    });

    Whisper.DeliveryReceipts = new (Backbone.Collection.extend({
        initialize: function() {
            this.on('add', this.onReceipt);
        },
        forMessage: function(conversation, message) {
            var recipients;
            if (conversation.isPrivate()) {
                recipients = [ conversation.id ];
            } else {
                recipients = conversation.get('members') || [];
            }
            var receipts = this.filter(function(receipt) {
                return (receipt.get('timestamp') === message.get('sent_at')) &&
                    (recipients.indexOf(receipt.get('source')) > -1);
            });
            this.remove(receipts);
            return receipts;
        },
        onReceipt: function(receipt) {
            var messages  = new Whisper.MessageCollection();
            messages.fetchSentAt(receipt.get('timestamp')).then(function() {
                if (messages.length === 0) { return; }
                var message = messages.find(function(message) {
                    return (!message.isIncoming() && receipt.get('source') === message.get('conversationId'));
                });
                if (message) { return message; }

                var groups    = new GroupCollection();
                return groups.fetchGroups(receipt.get('source')).then(function() {
                    var ids = groups.pluck('id');
                    ids.push(receipt.get('source'));
                    return messages.find(function(message) {
                        return (!message.isIncoming() &&
                                _.contains(ids, message.get('conversationId')));
                    });
                });
            }).then(function(message) {
                if (message) {
                    this.remove(receipt);
                    var deliveries = message.get('delivered') || 0;
                    message.save({
                        delivered: deliveries + 1
                    }).then(function() {
                        // notify frontend listeners
                        var conversation = ConversationController.get(
                            message.get('conversationId')
                        );
                        if (conversation) {
                            conversation.trigger('delivered', message);
                        }
                    });
                    // TODO: consider keeping a list of numbers we've
                    // successfully delivered to?
                }
            }.bind(this));
        }
    }))();
})();
