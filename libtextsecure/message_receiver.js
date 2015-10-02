/*
 * vim: ts=4:sw=4:expandtab
 */

function MessageReceiver(url, username, password, signalingKey) {
    this.url = url;
    this.signalingKey = signalingKey;
    this.username = username;
    this.password = password;
    this.server = new TextSecureServer(url, username, password);

    var unencoded = textsecure.utils.unencodeNumber(username);
    this.number = unencoded[0];
    this.deviceId = unencoded[1];
}
MessageReceiver.prototype = {
    constructor: MessageReceiver,
    connect: function() {
        if (this.socket && this.socket.readyState !== WebSocket.CLOSED) {
            this.socket.close();
        }
        console.log('opening websocket');
        // initialize the socket and start listening for messages
        this.socket = this.server.getMessageSocket();
        this.socket.onclose = this.onclose.bind(this);
        this.socket.onerror = this.onerror.bind(this);
        this.socket.onopen = this.onopen.bind(this);
        this.wsr = new WebSocketResource(this.socket, {
            handleRequest: this.handleRequest.bind(this),
            keepalive: { path: '/v1/keepalive', disconnect: true }
        });
    },
    close: function() {
        this.wsr.close();
        delete this.listeners;
    },
    onopen: function() {
        console.log('websocket open');
    },
    onerror: function(error) {
        console.log('websocket error');
    },
    onclose: function(ev) {
        var eventTarget = this;
        console.log('websocket closed', ev.code);
        // possible 403 or network issue. Make an request to confirm
        this.server.getDevices(this.number).
            then(this.connect.bind(this)). // No HTTP error? Reconnect
            catch(function(e) {
                var ev = new Event('error');
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
            var ev = new Event('error');
            ev.error = e;
            this.dispatchEvent(ev);
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
        var ev = new Event('receipt');
        ev.proto = envelope;
        this.dispatchEvent(ev);
    },
    decrypt: function(envelope, ciphertext) {
        var fromAddress = [envelope.source , (envelope.sourceDevice || 0)].join('.');
        var promise;
        switch(envelope.type) {
            case textsecure.protobuf.Envelope.Type.CIPHERTEXT:
                promise = textsecure.protocol_wrapper.decryptWhisperMessage(fromAddress, ciphertext);
                break;
            case textsecure.protobuf.Envelope.Type.PREKEY_BUNDLE:
                promise = textsecure.protocol_wrapper.handlePreKeyWhisperMessage(fromAddress, ciphertext);
                break;
            default:
                promise = Promise.reject(new Error("Unknown message type"));
        }
        return promise.catch(function(error) {
            var ev = new Event('error');
            ev.error = error;
            ev.proto = envelope;
            this.dispatchEvent(ev);
            throw error; // reject this promise
        }.bind(this));
    },
    handleSentMessage: function(destination, timestamp, message) {
        return this.processDecrypted(message, this.number).then(function(message) {
            var ev = new Event('sent');
            ev.data = {
                destination : destination,
                timestamp   : timestamp.toNumber(),
                message     : message
            };
            this.dispatchEvent(ev);
        }.bind(this));
    },
    handleDataMessage: function(envelope, message, close_session) {
        if ((message.flags & textsecure.protobuf.DataMessage.Flags.END_SESSION) ==
                textsecure.protobuf.DataMessage.Flags.END_SESSION ) {
            close_session();
        }
        return this.processDecrypted(message, envelope.source).then(function(message) {
            var ev = new Event('message');
            ev.data = {
                source    : envelope.source,
                timestamp : envelope.timestamp.toNumber(),
                message   : message
            };
            this.dispatchEvent(ev);
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
        var eventTarget = this;
        var attachmentPointer = contacts.blob;
        return this.handleAttachment(attachmentPointer).then(function() {
            var contactBuffer = new ContactBuffer(attachmentPointer.data);
            var contactDetails = contactBuffer.next();
            while (contactDetails !== undefined) {
                var ev = new Event('contact');
                ev.contactDetails = contactDetails;
                eventTarget.dispatchEvent(ev);
                contactDetails = contactBuffer.next();
            }
            eventTarget.dispatchEvent(new Event('contactsync'));
        });
    },
    handleGroups: function(groups) {
        var eventTarget = this;
        var attachmentPointer = groups.blob;
        return this.handleAttachment(attachmentPointer).then(function() {
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
                        var ev = new Event('group');
                        ev.groupDetails = groupDetails;
                        eventTarget.dispatchEvent(ev);
                    });
                })(groupDetails);
                groupDetails = groupBuffer.next();
            }
        });
    },
    handleAttachment: function(attachment) {
        function decryptAttachment(encrypted) {
            return textsecure.crypto.decryptAttachment(
                encrypted,
                attachment.key.toArrayBuffer()
            );
        }

        function updateAttachment(data) {
            attachment.data = data;
        }

        return this.server.getAttachment(attachment.id.toString()).
        then(decryptAttachment).
        then(updateAttachment);
    },
    tryMessageAgain: function(from, encodedMessage) {
        var bytes = dcodeIO.ByteBuffer.wrap(encodedMessage);
        return textsecure.protocol_wrapper.handlePreKeyWhisperMessage(from, bytes).then(function(res) {
            var finalMessage = textsecure.protobuf.DataMessage.decode(res[0]);

            if ((finalMessage.flags & textsecure.protobuf.DataMessage.Flags.END_SESSION)
                    == textsecure.protobuf.DataMessage.Flags.END_SESSION &&
                    finalMessage.sync !== null)
                res[1]();

            return this.processDecrypted(finalMessage);
        }.bind(this));
    },
    processDecrypted: function(decrypted, source) {
        // Now that its decrypted, validate the message and clean it up for consumer processing
        // Note that messages may (generally) only perform one action and we ignore remaining fields
        // after the first action.

        if (decrypted.flags == null)
            decrypted.flags = 0;

        if ((decrypted.flags & textsecure.protobuf.DataMessage.Flags.END_SESSION)
                    == textsecure.protobuf.DataMessage.Flags.END_SESSION) {
            decrypted.body = null;
            decrypted.attachments = [];
            decrypted.group = null;
            return Promise.resolve(decrypted);
        }
        if (decrypted.flags != 0) {
            throw new Error("Unknown flags in message");
        }

        var promises = [];

        if (decrypted.group !== null) {
            decrypted.group.id = getString(decrypted.group.id);

            if (decrypted.group.type == textsecure.protobuf.GroupContext.Type.UPDATE) {
                if (decrypted.group.avatar !== null) {
                    promises.push(this.handleAttachment(decrypted.group.avatar));
                }
            }

            promises.push(textsecure.storage.groups.getNumbers(decrypted.group.id).then(function(existingGroup) {
                if (existingGroup === undefined) {
                    if (decrypted.group.type != textsecure.protobuf.GroupContext.Type.UPDATE) {
                        throw new Error("Got message for unknown group");
                    }
                    return textsecure.storage.groups.createNewGroup(decrypted.group.members, decrypted.group.id);
                } else {
                    var fromIndex = existingGroup.indexOf(source);

                    if (fromIndex < 0) {
                        //TODO: This could be indication of a race...
                        console.log("Sender was not a member of the group they were sending from");
                    }

                    switch(decrypted.group.type) {
                    case textsecure.protobuf.GroupContext.Type.UPDATE:
                        return textsecure.storage.groups.updateNumbers(
                            decrypted.group.id, decrypted.group.members
                        ).then(function(added) {
                            decrypted.group.added = added;

                            if (decrypted.group.avatar === null &&
                                decrypted.group.added.length == 0 &&
                                decrypted.group.name === null) {
                                return;
                            }

                            decrypted.body = null;
                            decrypted.attachments = [];
                        });

                        break;
                    case textsecure.protobuf.GroupContext.Type.QUIT:
                        decrypted.body = null;
                        decrypted.attachments = [];
                        return textsecure.storage.groups.removeNumber(decrypted.group.id, source);
                    case textsecure.protobuf.GroupContext.Type.DELIVER:
                        decrypted.group.name = null;
                        decrypted.group.members = [];
                        decrypted.group.avatar = null;

                        break;
                    default:
                        throw new Error("Unknown group message type");
                    }
                }
            }));
        }

        for (var i in decrypted.attachments) {
            promises.push(this.handleAttachment(decrypted.attachments[i]));
        }
        return Promise.all(promises).then(function() {
            return decrypted;
        });
    },

    /* Implements EventTarget */
    dispatchEvent: function(ev) {
        if (!(ev instanceof Event)) {
            throw new Error('Expects an event');
        }
        if (this.listeners === null || typeof this.listeners !== 'object') {
            this.listeners = {};
        }
        var listeners = this.listeners[ev.type];
        if (typeof listeners === 'object') {
            for (var i=0; i < listeners.length; ++i) {
                if (typeof listeners[i] === 'function') {
                    listeners[i].call(null, ev);
                }
            }
        }
    },
    addEventListener: function(eventName, callback) {
        if (typeof eventName !== 'string') {
            throw new Error('First argument expects a string');
        }
        if (typeof callback !== 'function') {
            throw new Error('Second argument expects a function');
        }
        if (this.listeners === null || typeof this.listeners !== 'object') {
            this.listeners = {};
        }
        var listeners = this.listeners[eventName];
        if (typeof listeners !== 'object') {
            listeners = [];
        }
        listeners.push(callback);
        this.listeners[eventName] = listeners;
    },
    removeEventListener: function(eventName, callback) {
        if (typeof eventName !== 'string') {
            throw new Error('First argument expects a string');
        }
        if (typeof callback !== 'function') {
            throw new Error('Second argument expects a function');
        }
        if (this.listeners === null || typeof this.listeners !== 'object') {
            this.listeners = {};
        }
        var listeners = this.listeners[eventName];
        for (var i=0; i < listeners.length; ++ i) {
            if (listeners[i] === callback) {
                listeners.splice(i, 1);
                return;
            }
        }
        this.listeners[eventName] = listeners;
    }

};

window.textsecure = window.textsecure || {};

textsecure.MessageReceiver = function(url, username, password, signalingKey) {
    var messageReceiver = new MessageReceiver(url, username, password, signalingKey);
    this.addEventListener    = messageReceiver.addEventListener.bind(messageReceiver);
    this.removeEventListener = messageReceiver.removeEventListener.bind(messageReceiver);
    this.getStatus           = messageReceiver.getStatus.bind(messageReceiver);
    this.close               = messageReceiver.close.bind(messageReceiver);
    messageReceiver.connect();

    textsecure.replay.registerFunction(messageReceiver.tryMessageAgain.bind(messageReceiver), textsecure.replay.Type.INIT_SESSION);
};

textsecure.MessageReceiver.prototype = {
    constructor: textsecure.MessageReceiver
};

