/*
 * vim: ts=4:sw=4:expandtab
 */
;(function() {
    'use strict';
    window.Whisper = window.Whisper || {};
    Whisper.ReadReceipts = new (Backbone.Collection.extend({
        initialize: function() {
            this.on('add', this.onReceipt);
        },
        forMessage: function(message) {
            var receipt = this.findWhere({
                sender: message.get('source'),
                timestamp: message.get('sent_at')
            });
            if (receipt) {
                console.log('Found early read receipt for message');
                this.remove(receipt);
                return receipt;
            }
        },
        onReceipt: function(receipt) {
            var messages  = new Whisper.MessageCollection();
            messages.fetchSentAt(receipt.get('timestamp')).then(function() {
                var message = messages.find(function(message) {
                    return (message.isIncoming() && message.isUnread() &&
                            message.get('source') === receipt.get('sender'));
                });
                if (message) {
                    this.remove(receipt);
                    message.markRead(receipt.get('read_at')).then(function() {
                        var conversation = ConversationController.get({
                            id: message.get('conversationId')
                        });

                        if (conversation) {
                            // notify frontend listeners
                            conversation.trigger('read', message);
                        }
                    });
                } else {
                    console.log('No message for read receipt');
                }
            }.bind(this));
        }
    }))();
})();
