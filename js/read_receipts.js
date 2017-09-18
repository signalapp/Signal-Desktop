/*
 * vim: ts=4:sw=4:expandtab
 */
;(function() {
    'use strict';
    window.Whisper = window.Whisper || {};
    Whisper.ReadSyncs = new (Backbone.Collection.extend({
        forMessage: function(message) {
            var receipt = this.findWhere({
                sender: message.get('source'),
                timestamp: message.get('sent_at')
            });
            if (receipt) {
                console.log('Found early read sync for message');
                this.remove(receipt);
                return receipt;
            }
        },
        onReceipt: function(receipt) {
            var messages  = new Whisper.MessageCollection();
            return messages.fetchSentAt(receipt.get('timestamp')).then(function() {
                var message = messages.find(function(message) {
                    return (message.isIncoming() && message.isUnread() &&
                            message.get('source') === receipt.get('sender'));
                });
                if (message) {
                    return message.markRead(receipt.get('read_at')).then(function() {
                        this.notifyConversation(message);
                        this.remove(receipt);
                    }.bind(this));
                } else {
                    console.log(
                        'No message for read sync',
                        receipt.get('sender'), receipt.get('timestamp')
                    );
                }
            }.bind(this));
        },
        notifyConversation: function(message) {
            var conversation = ConversationController.get({
                id: message.get('conversationId')
            });

            if (conversation) {
                conversation.onReadMessage(message);
            }
        },
    }))();

    Whisper.ReadReceipts = new (Backbone.Collection.extend({
        forMessage: function(conversation, message) {
            if (!message.isOutgoing()) {
                return [];
            }
            var ids = [];
            if (conversation.isPrivate()) {
                ids = [conversation.id];
            } else {
                ids = conversation.get('members');
            }
            var receipts = this.filter(function(receipt) {
                return receipt.get('timestamp') === message.get('sent_at')
                  &&  _.contains(ids, receipt.get('reader'));
            });
            if (receipts.length) {
                console.log('Found early read receipts for message');
                this.remove(receipts);
            }
            return receipts;
        },
        onReceipt: function(receipt) {
            var messages  = new Whisper.MessageCollection();
            return messages.fetchSentAt(receipt.get('timestamp')).then(function() {
                if (messages.length === 0) { return; }
                var message = messages.find(function(message) {
                    return (message.isOutgoing() && receipt.get('reader') === message.get('conversationId'));
                });
                if (message) { return message; }

                var groups = new Whisper.GroupCollection();
                return groups.fetchGroups(receipt.get('reader')).then(function() {
                    var ids = groups.pluck('id');
                    ids.push(receipt.get('reader'));
                    return messages.find(function(message) {
                        return (message.isOutgoing() &&
                                _.contains(ids, message.get('conversationId')));
                    });
                });
            }).then(function(message) {
                if (message) {
                    var read_by = message.get('read_by') || [];
                    read_by.push(receipt.get('reader'));
                    return new Promise(function(resolve, reject) {
                        message.save({ read_by: read_by }).then(function() {
                            // notify frontend listeners
                            var conversation = ConversationController.get(
                                message.get('conversationId')
                            );
                            if (conversation) {
                                conversation.trigger('read', message);
                            }

                            this.remove(receipt);
                            resolve();
                        }.bind(this), reject);
                    }.bind(this));
                } else {
                    console.log(
                        'No message for read receipt',
                        receipt.get('reader'),
                        receipt.get('timestamp')
                    );
                }
            }.bind(this)).catch(function(error) {
                console.log(
                    'ReadReceipts.onReceipt error:',
                    error && error.stack ? error.stack : error
                );
            });
        },
    }))();
})();
