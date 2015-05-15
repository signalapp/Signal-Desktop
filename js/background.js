/* vim: ts=4:sw=4:expandtab
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

;(function() {
    'use strict';
    storage.fetch();
    storage.onready(function() {
        var messageReceiver;

        if (textsecure.registration.isDone()) {
            init();
        }
        extension.on('registration_done', init);

        window.getSocketStatus = function() {
            if (messageReceiver) {
                return messageReceiver.getStatus();
            } else {
                return -1;
            }
        };

        function init() {
            if (!textsecure.registration.isDone()) { return; }

            // initialize the socket and start listening for messages
            messageReceiver = new textsecure.MessageReceiver(window);
            window.addEventListener('signal', function(ev) {
                var proto = ev.proto;
                if (proto.type === textsecure.protobuf.IncomingPushMessageSignal.Type.RECEIPT) {
                    onDeliveryReceipt(proto);
                } else {
                    onMessageReceived(proto);
                }
            });
            messageReceiver.connect();
        }

        function onMessageReceived(pushMessage) {
            var now = new Date().getTime();
            var timestamp = pushMessage.timestamp.toNumber();

            var conversation = getConversation({
                id   : pushMessage.source,
                type : 'private'
            });

            conversation.fetch().always(function() {
                var message = conversation.messageCollection.add({
                    source         : pushMessage.source,
                    sourceDevice   : pushMessage.sourceDevice,
                    relay          : pushMessage.relay,
                    sent_at        : timestamp,
                    received_at    : now,
                    conversationId : pushMessage.source,
                    type           : 'incoming'
                });

                var newUnreadCount = storage.get("unreadCount", 0) + 1;
                storage.put("unreadCount", newUnreadCount);
                extension.navigator.setBadgeText(newUnreadCount);

                conversation.save().then(function() {
                    message.save().then(function() {
                        return new Promise(function(resolve) {
                            resolve(textsecure.protocol_wrapper.handleIncomingPushMessageProto(pushMessage).then(
                                function(pushMessageContent) {
                                    message.handlePushMessageContent(pushMessageContent);
                                }
                            ));
                        }).catch(function(e) {
                            if (e.name === 'IncomingIdentityKeyError') {
                                message.save({ errors : [e] }).then(function() {
                                    extension.trigger('message', message);
                                    notifyConversation(message);
                                });
                            } else if (e.message === 'Bad MAC') {
                                message.save({ errors : [ _.pick(e, ['name', 'message'])]}).then(function() {
                                    extension.trigger('message', message);
                                    notifyConversation(message);
                                });
                            } else {
                                console.log(e);
                                throw e;
                            }
                        });
                    });
                });
            });
        }

        function onDeliveryReceipt(pushMessage) {
            var timestamp = pushMessage.timestamp.toNumber();
            var messages  = new Whisper.MessageCollection();
            var groups    = new Whisper.ConversationCollection();
            console.log('delivery receipt', pushMessage.source, timestamp);
            messages.fetchSentAt(timestamp).then(function() {
                groups.fetchGroups(pushMessage.source).then(function() {
                    for (var i in messages.where({type: 'outgoing'})) {
                        var message = messages.at(i);
                        var deliveries     = message.get('delivered') || 0;
                        var conversationId = message.get('conversationId');
                        if (conversationId === pushMessage.source || groups.get(conversationId)) {
                            message.save({delivered: deliveries + 1}).then(
                                // notify frontend listeners
                                updateConversation.bind(window,conversationId)
                            );
                            return;
                            // TODO: consider keeping a list of numbers we've
                            // successfully delivered to?
                        }
                    }
                });
            }).fail(function() {
                console.log('got delivery receipt for unknown message', pushMessage.source, timestamp);
            });
        }
    });
})();
