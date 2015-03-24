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
    var socket;

    if (!localStorage.getItem('first_install_ran')) {
        localStorage.setItem('first_install_ran', 1);
        extension.navigator.tabs.create("options.html");
    }

    if (textsecure.registration.isDone()) {
        init();
    }
    extension.on('registration_done', init);

    window.getSocketStatus = function() {
        if (socket) {
            return socket.getStatus();
        } else {
            return WebSocket.CONNECTING;
        }
    };

    function init() {
        if (!textsecure.registration.isDone()) { return; }

        // initialize the socket and start listening for messages
        socket = textsecure.api.getMessageWebsocket();

        new WebSocketResource(socket, function(request) {
            // TODO: handle different types of requests. for now we only expect
            // PUT /messages <encrypted IncomingPushMessageSignal>
            textsecure.crypto.decryptWebsocketMessage(request.body).then(function(plaintext) {
                var proto = textsecure.protobuf.IncomingPushMessageSignal.decode(plaintext);
                // After this point, decoding errors are not the server's
                // fault, and we should handle them gracefully and tell the
                // user they received an invalid message
                request.respond(200, 'OK');

                if (proto.type === textsecure.protobuf.IncomingPushMessageSignal.Type.RECEIPT) {
                    onDeliveryReceipt(proto);
                } else {
                    onMessageReceived(proto);
                }

            }).catch(function(e) {
                console.log("Error handling incoming message:", e);
                extension.trigger('error', e);
                request.respond(500, 'Bad encrypted websocket message');
            });
        });

        extension.browserAction(window.openInbox);

        // refresh views
        var views = extension.windows.getViews();
        for (var i = 0; i < views.length; ++i) {
            if (views[i] !== window) {
                views[i].location.reload();
            }
        }
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

            var newUnreadCount = textsecure.storage.get("unreadCount", 0) + 1;
            textsecure.storage.put("unreadCount", newUnreadCount);
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
})();
