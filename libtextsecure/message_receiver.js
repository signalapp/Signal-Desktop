/*
 * vim: ts=4:sw=4:expandtab
 */

;(function () {
    'use strict';
    window.textsecure = window.textsecure || {};

    function MessageReceiver(url, username, password, signalingKey, eventTarget) {
        if (eventTarget instanceof EventTarget) {
            this.target = eventTarget;
            this.url = url;
            this.signalingKey = signalingKey;
            this.username = username;
            this.password = password;

            var unencoded = textsecure.utils.unencodeNumber(username);
            this.number = unencoded[0];
            this.deviceId = unencoded[1];
        } else {
            throw new TypeError('MessageReceiver expected an EventTarget');
        }
        this.connect();
    }

    MessageReceiver.prototype = {
        constructor: MessageReceiver,
        connect: function() {
            // initialize the socket and start listening for messages
            if (this.socket && this.socket.readyState !== WebSocket.CLOSED) {
                socket.close();
            }
            this.socket = new WebSocket(
                this.url.replace('https://', 'wss://').replace('http://', 'ws://')
                    + '/v1/websocket/?login=' + encodeURIComponent(this.username)
                    + '&password=' + encodeURIComponent(this.password)
            );

            this.socket.onclose = this.onclose.bind(this);
            this.socket.onerror = this.onerror.bind(this);
            this.wsr = new WebSocketResource(this.socket, {
                handleRequest: this.handleRequest.bind(this),
                keepalive: { path: '/v1/keepalive', disconnect: true }
            });
        },
        onerror: function(error) {
            console.log('websocket error', error);
            this.socketError = error;
        },
        onclose: function(ev) {
            var eventTarget = this.target;
            console.log('websocket closed', ev.code);
            // possible 403 or network issue. Make an request to confirm
            TextSecureServer(this.url).getDevices(this.number).
                then(this.connect.bind(this)). // No HTTP error? Reconnect
                catch(function(e) {
                    var ev = new Event('textsecure:error');
                    ev.error = e;
                    eventTarget.dispatchEvent(ev);
                });
        },
        handleRequest: function(request) {
            this.wsr.resetKeepAliveTimer();
            // TODO: handle different types of requests. for now we only expect
            // PUT /messages <encrypted IncomingPushMessageSignal>
            textsecure.crypto.decryptWebsocketMessage(request.body, this.signalingKey).then(function(plaintext) {
                var envelope = textsecure.protobuf.Envelope.decode(plaintext);
                // After this point, decoding errors are not the server's
                // fault, and we should handle them gracefully and tell the
                // user they received an invalid message
                request.respond(200, 'OK');

                if (envelope.type === textsecure.protobuf.Envelope.Type.RECEIPT) {
                    this.onDeliveryReceipt(envelope);
                } else if (envelope.content) {
                    this.handleContentMessage(envelope);
                } else if (envelope.legacyMessage) {
                    this.handleLegacyMessage(envelope);
                } else {
                    throw new Error('Received message with no content and no legacyMessage');
                }

            }.bind(this)).catch(function(e) {
                request.respond(500, 'Bad encrypted websocket message');
                console.log("Error handling incoming message:", e);
                var ev = new Event('textsecure:error');
                ev.error = e;
                this.target.dispatchEvent(ev);
            }.bind(this));
        },
        getStatus: function() {
            if (this.socket) {
                return this.socket.readyState;
            } else {
                return -1;
            }
        },
        onDeliveryReceipt: function (envelope) {
            var ev = new Event('textsecure:receipt');
            ev.proto = envelope;
            this.target.dispatchEvent(ev);
        },
        decrypt: function(envelope, ciphertext) {
            return textsecure.protocol_wrapper.decrypt(
                envelope.source,
                envelope.sourceDevice,
                envelope.type,
                ciphertext
            ).catch(function(error) {
                var ev = new Event('textsecure:error');
                ev.error = error;
                ev.proto = envelope;
                this.target.dispatchEvent(ev);
                throw error; // reject this promise
            }.bind(this));
        },
        handleSentMessage: function(destination, timestamp, message) {
            return processDecrypted(message, this.number).then(function(message) {
                var ev = new Event('textsecure:sent');
                ev.data = {
                    destination : destination,
                    timestamp   : timestamp.toNumber(),
                    message     : message
                };
                this.target.dispatchEvent(ev);
            }.bind(this));
        },
        handleDataMessage: function(envelope, message, close_session) {
            if ((message.flags & textsecure.protobuf.DataMessage.Flags.END_SESSION)
                == textsecure.protobuf.DataMessage.Flags.END_SESSION ) {
                close_session();
            }
            return processDecrypted(message, envelope.source).then(function(message) {
                var ev = new Event('textsecure:message');
                ev.data = {
                    source    : envelope.source,
                    timestamp : envelope.timestamp.toNumber(),
                    message   : message
                };
                this.target.dispatchEvent(ev);
            }.bind(this));
        },
        handleLegacyMessage: function (envelope) {
            return this.decrypt(envelope, envelope.legacyMessage).then(function(result) {
                var plaintext = result[0]; // array buffer
                var close_session = result[1]; // function
                var message = textsecure.protobuf.DataMessage.decode(plaintext);
                return this.handleDataMessage(envelope, message, close_session);
            }.bind(this));
        },
        handleContentMessage: function (envelope) {
            return this.decrypt(envelope, envelope.content).then(function(result) {
                var plaintext = result[0]; // array buffer
                var close_session = result[1]; // function
                var content = textsecure.protobuf.Content.decode(plaintext);
                if (content.syncMessage) {
                    return this.handleSyncMessage(envelope, content.syncMessage);
                } else if (content.dataMessage) {
                    return this.handleDataMessage(envelope, content.dataMessage, close_session);
                } else {
                    throw new Error('Got Content message with no dataMessage and no syncMessage');
                }
            }.bind(this));
        },
        handleSyncMessage: function(envelope, syncMessage) {
            if (envelope.source !== this.number) {
                throw new Error('Received sync message from another number');
            }
            if (envelope.sourceDevice == this.deviceId) {
                throw new Error('Received sync message from our own device');
            }
            if (syncMessage.sent) {
                var sentMessage = syncMessage.sent;
                return this.handleSentMessage(
                        sentMessage.destination,
                        sentMessage.timestamp,
                        sentMessage.message
                );
            } else if (syncMessage.contacts) {
                this.handleContacts(syncMessage.contacts);
            } else if (syncMessage.groups) {
                this.handleGroups(syncMessage.groups);
            } else {
                throw new Error('Got SyncMessage with no sent, contacts, or groups');
            }
        },
        handleContacts: function(contacts) {
            var eventTarget = this.target;
            var attachmentPointer = contacts.blob;
            return handleAttachment(attachmentPointer).then(function() {
                var contactBuffer = new ContactBuffer(attachmentPointer.data);
                var contactDetails = contactBuffer.next();
                while (contactDetails !== undefined) {
                    var ev = new Event('textsecure:contact');
                    ev.contactDetails = contactDetails;
                    eventTarget.dispatchEvent(ev);
                    contactDetails = contactBuffer.next();
                }
                eventTarget.dispatchEvent(new Event('textsecure:contactsync'));
            });
        },
        handleGroups: function(groups) {
            var eventTarget = this.target;
            var attachmentPointer = groups.blob;
            return handleAttachment(attachmentPointer).then(function() {
                var groupBuffer = new GroupBuffer(attachmentPointer.data);
                var groupDetails = groupBuffer.next();
                while (groupDetails !== undefined) {
                    (function(groupDetails) {
                        groupDetails.id = getString(groupDetails.id);
                        textsecure.storage.groups.getGroup(groupDetails.id).
                        then(function(existingGroup) {
                            if (existingGroup === undefined) {
                                return textsecure.storage.groups.createNewGroup(
                                    groupDetails.members, groupDetails.id
                                );
                            } else {
                                return textsecure.storage.groups.updateNumbers(
                                    groupDetails.id, groupDetails.members
                                );
                            }
                        }).then(function() {
                            var ev = new Event('textsecure:group');
                            ev.groupDetails = groupDetails;
                            eventTarget.dispatchEvent(ev);
                        });
                    })(groupDetails);
                    groupDetails = groupBuffer.next();
                }
            });
        }
    };

    textsecure.MessageReceiver = function(url, username, password, signalingKey, eventTarget) {
        var messageReceiver = new MessageReceiver(url, username, password, signalingKey, eventTarget);
        this.getStatus = function() {
            return messageReceiver.getStatus();
        }
    }

    textsecure.MessageReceiver.prototype = {
        constructor: textsecure.MessageReceiver
    };

}());
