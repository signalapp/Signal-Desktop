/*
 * vim: ts=4:sw=4:expandtab
 */
;(function() {
    'use strict';
    window.Whisper = window.Whisper || {};

    Whisper.DeliveryReceipts = new (Backbone.Collection.extend({
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
            return messages.fetchSentAt(receipt.get('timestamp')).then(function() {
                if (messages.length === 0) { return; }
                var message = messages.find(function(message) {
                    return (!message.isIncoming() && receipt.get('source') === message.get('conversationId'));
                });
                if (message) { return message; }

                var groups = new Whisper.GroupCollection();
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
                    var deliveries = message.get('delivered') || 0;
                    var delivered_to = message.get('delivered_to') || [];
                    return new Promise(function(resolve, reject) {
                        message.save({
                            delivered_to: _.union(delivered_to, [receipt.get('source')]),
                            delivered: deliveries + 1
                        }).then(function() {
                            // notify frontend listeners
                            var conversation = ConversationController.get(
                                message.get('conversationId')
                            );
                            if (conversation) {
                                conversation.trigger('delivered', message);
                            }

                            this.remove(receipt);
                            resolve();
                        }.bind(this), reject);
                    }.bind(this));
                    // TODO: consider keeping a list of numbers we've
                    // successfully delivered to?
                } else {
                    console.log(
                        'No message for delivery receipt',
                        receipt.get('source'),
                        receipt.get('timestamp')
                    );
                    resolve();
                }
            }.bind(this)).catch(function(error) {
                console.log(
                    'DeliveryReceipts.onReceipt error:',
                    error && error.stack ? error.stack : error
                );
            });
        }
    }))();
})();
