/*
 * vim: ts=4:sw=4:expandtab
 */

var MAX_MESSAGE_ATTACHMENT_DOWNLOADS = 2;

function MessageReceiver(url, username, password, signalingKey, options) {
    options = options || {};

    this.count = 0;

    this.url = url;
    this.signalingKey = signalingKey;
    this.username = username;
    this.password = password;
    this.server = new TextSecureServer(url, username, password);

    var address = libsignal.SignalProtocolAddress.fromString(username);
    this.number = address.getName();
    this.deviceId = address.getDeviceId();

    this.pending = Promise.resolve();

    if (options.retryCached) {
        this.pending = this.queueAllCached();
    }

    // Note that this is not used for contact or group avatar attachments, just
    //   user-provided message attachments. Because we download them async, we don't want
    //   to kick off too many at once.
    this.messageAttachmentPool = window.pLimit(MAX_MESSAGE_ATTACHMENT_DOWNLOADS);
}

MessageReceiver.prototype = new textsecure.EventTarget();
MessageReceiver.prototype.extend({
    constructor: MessageReceiver,
    connect: function() {
        if (this.calledClose) {
            return;
        }

        this.hasConnected = true;

        if (this.socket && this.socket.readyState !== WebSocket.CLOSED) {
            this.socket.close();
            this.wsr.close();
        }
        // initialize the socket and start listening for messages
        this.socket = this.server.getMessageSocket();
        this.socket.onclose = this.onclose.bind(this);
        this.socket.onerror = this.onerror.bind(this);
        this.socket.onopen = this.onopen.bind(this);
        this.wsr = new WebSocketResource(this.socket, {
            handleRequest: this.handleRequest.bind(this),
            keepalive: {
                path: '/v1/keepalive',
                disconnect: true
            }
        });

        // Because sometimes the socket doesn't properly emit its close event
        this._onClose = this.onclose.bind(this)
        this.wsr.addEventListener('close', this._onClose);

        // Ensures that an immediate 'empty' event from the websocket will fire only after
        //   all cached envelopes are processed.
        this.incoming = [this.pending];
    },
    shutdown: function() {
        if (this.socket) {
            this.socket.onclose = null;
            this.socket.onerror = null;
            this.socket.onopen = null;
            this.socket = null;
        }

        if (this.wsr) {
            this.wsr.removeEventListener('close', this._onClose);
            this.wsr = null;
        }
    },
    close: function() {
        console.log('MessageReceiver.close()');
        this.calledClose = true;

        // Our WebSocketResource instance will close the socket and emit a 'close' event
        //   if the socket doesn't emit one quickly enough.
        if (this.wsr) {
            this.wsr.close(3000, 'called close');
        }

        return this.drain();
    },
    onopen: function() {
        console.log('websocket open');
    },
    onerror: function(error) {
        console.log('websocket error');
    },
    dispatchAndWait: function(event) {
        return Promise.all(this.dispatchEvent(event));
    },
    onclose: function(ev) {
        console.log(
            'websocket closed',
            ev.code,
            ev.reason || '',
            'calledClose:',
            this.calledClose
        );

        this.shutdown();

        if (this.calledClose) {
            return;
        }
        if (ev.code === 3000) {
            return;
        }
        if (ev.code === 3001) {
            this.onEmpty();
        }
        // possible 403 or network issue. Make an request to confirm
        return this.server.getDevices(this.number)
            .then(this.connect.bind(this)) // No HTTP error? Reconnect
            .catch(function(e) {
                var ev = new Event('error');
                ev.error = e;
                return this.dispatchAndWait(ev);
            }.bind(this));
    },
    handleRequest: function(request) {
        this.incoming = this.incoming || [];
        // We do the message decryption here, instead of in the ordered pending queue,
        // to avoid exposing the time it took us to process messages through the time-to-ack.

        // TODO: handle different types of requests.
        if (request.path !== '/api/v1/message') {
            console.log('got request', request.verb, request.path);
            request.respond(200, 'OK');

            if (request.verb === 'PUT' && request.path === '/api/v1/queue/empty') {
                this.onEmpty();
            }
            return;
        }

        this.incoming.push(textsecure.crypto.decryptWebsocketMessage(request.body, this.signalingKey).then(function(plaintext) {
            var envelope = textsecure.protobuf.Envelope.decode(plaintext);
            // After this point, decoding errors are not the server's
            //   fault, and we should handle them gracefully and tell the
            //   user they received an invalid message

            if (this.isBlocked(envelope.source)) {
                return request.respond(200, 'OK');
            }

            return this.addToCache(envelope, plaintext).then(function() {
                request.respond(200, 'OK');
                this.queueEnvelope(envelope);
            }.bind(this), function(error) {
                console.log(
                    'handleRequest error trying to add message to cache:',
                    error && error.stack ? error.stack : error
                );
            });
        }.bind(this)).catch(function(e) {
            request.respond(500, 'Bad encrypted websocket message');
            console.log("Error handling incoming message:", e && e.stack ? e.stack : e);
            var ev = new Event('error');
            ev.error = e;
            return this.dispatchAndWait(ev);
        }.bind(this)));
    },
    addToQueue: function(task) {
        var count = this.count += 1;
        var current = this.pending = this.pending.then(task, task);

        var cleanup = function() {
            this.updateProgress(count);
            // We want to clear out the promise chain whenever possible because it could
            //   lead to large memory usage over time:
            //   https://github.com/nodejs/node/issues/6673#issuecomment-244331609
            if (this.pending === current) {
                this.pending = Promise.resolve();
            }
        }.bind(this);

        current.then(cleanup, cleanup);

        return current;
    },
    onEmpty: function() {
        var incoming = this.incoming;
        this.incoming = [];

        var dispatchEmpty = function() {
            console.log('MessageReceiver: emitting \'empty\' event');
            var ev = new Event('empty');
            return this.dispatchAndWait(ev);
        }.bind(this);

        var queueDispatch = function() {
            // resetting count to zero so everything queued after this starts over again
            this.count = 0;

            this.addToQueue(dispatchEmpty);
        }.bind(this);

        // We first wait for all recently-received messages (this.incoming) to be queued,
        //   then we add a task to emit the 'empty' event to the queue, so all message
        //   processing is complete by the time it runs.
        Promise.all(incoming).then(queueDispatch, queueDispatch);
    },
    drain: function() {
        var incoming = this.incoming;
        this.incoming = [];

        var queueDispatch = function() {
            return this.addToQueue(function() {
              console.log('drained');
            });
        }.bind(this);

        // This promise will resolve when there are no more messages to be processed.
        return Promise.all(incoming).then(queueDispatch, queueDispatch);
    },
    updateProgress: function(count) {
        // count by 10s
        if (count % 10 !== 0) {
            return;
        }
        var ev = new Event('progress');
        ev.count = count;
        this.dispatchEvent(ev);
    },
    queueAllCached: function() {
        return this.getAllFromCache().then(function(items) {
            for (var i = 0, max = items.length; i < max; i += 1) {
                this.queueCached(items[i]);
            }
        }.bind(this));
    },
    queueCached: function(item) {
        try {
            var envelopePlaintext = item.envelope;

            // Up until 0.42.6 we stored envelope and decrypted as strings in IndexedDB,
            //   so we need to be ready for them.
            if (typeof envelopePlaintext === 'string') {
              envelopePlaintext = this.stringToArrayBuffer(envelopePlaintext);
            }
            var envelope = textsecure.protobuf.Envelope.decode(envelopePlaintext);

            var decrypted = item.decrypted;
            if (decrypted) {
                var payloadPlaintext = decrypted;
                if (typeof payloadPlaintext === 'string') {
                    payloadPlaintext = this.stringToArrayBuffer(payloadPlaintext);
                }
                this.queueDecryptedEnvelope(envelope, payloadPlaintext);
            } else {
                this.queueEnvelope(envelope);
            }
        }
        catch (error) {
            console.log('queueCached error handling item', item.id);
        }
    },
    getEnvelopeId: function(envelope) {
        return envelope.source + '.' + envelope.sourceDevice + ' ' + envelope.timestamp.toNumber();
    },
    stringToArrayBuffer: function(string) {
        return new dcodeIO.ByteBuffer.wrap(string, 'binary').toArrayBuffer();
    },
    getAllFromCache: function() {
        console.log('getAllFromCache');
        return textsecure.storage.unprocessed.getAll().then(function(items) {
            console.log('getAllFromCache loaded', items.length, 'saved envelopes');

            return Promise.all(_.map(items, function(item) {
                var attempts = 1 + (item.attempts || 0);
                if (attempts >= 5) {
                    console.log('getAllFromCache final attempt for envelope', item.id);
                    return textsecure.storage.unprocessed.remove(item.id);
                } else {
                    return textsecure.storage.unprocessed.update(item.id, {attempts: attempts});
                }
            }.bind(this))).then(function() {
                return items;
            }, function(error) {
                console.log(
                    'getAllFromCache error updating items after load:',
                    error && error.stack ? error.stack : error
                );
                return items;
            });
        }.bind(this));
    },
    addToCache: function(envelope, plaintext) {
        var id = this.getEnvelopeId(envelope);
        var data = {
            id: id,
            envelope: plaintext,
            timestamp: Date.now(),
            attempts: 1
        };
        return textsecure.storage.unprocessed.add(data);
    },
    updateCache: function(envelope, plaintext) {
        var id = this.getEnvelopeId(envelope);
        var data = {
            decrypted: plaintext
        };
        return textsecure.storage.unprocessed.update(id, data);
    },
    removeFromCache: function(envelope) {
        var id = this.getEnvelopeId(envelope);
        return textsecure.storage.unprocessed.remove(id);
    },
    queueDecryptedEnvelope: function(envelope, plaintext) {
        var id = this.getEnvelopeId(envelope);
        console.log('queueing decrypted envelope', id);

        var task = this.handleDecryptedEnvelope.bind(this, envelope, plaintext);
        var taskWithTimeout = textsecure.createTaskWithTimeout(task, 'queueEncryptedEnvelope ' + id);
        var promise = this.addToQueue(taskWithTimeout);

        return promise.catch(function(error) {
            console.log('queueDecryptedEnvelope error handling envelope', id, ':', error && error.stack ? error.stack : error);
        });
    },
    queueEnvelope: function(envelope) {
        var id = this.getEnvelopeId(envelope);
        console.log('queueing envelope', id);

        var task = this.handleEnvelope.bind(this, envelope);
        var taskWithTimeout = textsecure.createTaskWithTimeout(task, 'queueEnvelope ' + id);
        var promise = this.addToQueue(taskWithTimeout);

        return promise.catch(function(error) {
            console.log('queueEnvelope error handling envelope', id, ':', error && error.stack ? error.stack : error);
        });
    },
    // Same as handleEnvelope, just without the decryption step. Necessary for handling
    //   messages which were successfully decrypted, but application logic didn't finish
    //   processing.
    handleDecryptedEnvelope: function(envelope, plaintext) {
        // No decryption is required for delivery receipts, so the decrypted field of
        //   the Unprocessed model will never be set

        if (envelope.content) {
            return this.innerHandleContentMessage(envelope, plaintext);
        } else if (envelope.legacyMessage) {
            return this.innerHandleLegacyMessage(envelope, plaintext);
        } else {
            this.removeFromCache(envelope);
            throw new Error('Received message with no content and no legacyMessage');
        }
    },
    handleEnvelope: function(envelope) {
        if (envelope.type === textsecure.protobuf.Envelope.Type.RECEIPT) {
            return this.onDeliveryReceipt(envelope);
        }

        if (envelope.content) {
            return this.handleContentMessage(envelope);
        } else if (envelope.legacyMessage) {
            return this.handleLegacyMessage(envelope);
        } else {
            this.removeFromCache(envelope);
            throw new Error('Received message with no content and no legacyMessage');
        }
    },
    getStatus: function() {
        if (this.socket) {
            return this.socket.readyState;
        } else if (this.hasConnected) {
            return WebSocket.CLOSED;
        } else {
            return -1;
        }
    },
    onDeliveryReceipt: function (envelope) {
        return new Promise(function(resolve, reject) {
            var ev = new Event('delivery');
            ev.confirm = this.removeFromCache.bind(this, envelope);
            ev.deliveryReceipt = {
              timestamp    : envelope.timestamp.toNumber(),
              source       : envelope.source,
              sourceDevice : envelope.sourceDevice
            };
            this.dispatchAndWait(ev).then(resolve, reject);
        }.bind(this));
    },
    unpad: function(paddedPlaintext) {
        paddedPlaintext = new Uint8Array(paddedPlaintext);
        var plaintext;
        for (var i = paddedPlaintext.length - 1; i >= 0; i--) {
            if (paddedPlaintext[i] == 0x80) {
                plaintext = new Uint8Array(i);
                plaintext.set(paddedPlaintext.subarray(0, i));
                plaintext = plaintext.buffer;
                break;
            } else if (paddedPlaintext[i] !== 0x00) {
                throw new Error('Invalid padding');
            }
        }

        return plaintext;
    },
    decrypt: function(envelope, ciphertext) {
        var promise;
        var address = new libsignal.SignalProtocolAddress(envelope.source, envelope.sourceDevice);

        var ourNumber = textsecure.storage.user.getNumber();
        var number = address.toString().split('.')[0];
        var options = {};

        // No limit on message keys if we're communicating with our other devices
        if (ourNumber === number) {
            options.messageKeysLimit = false;
        }

        var sessionCipher = new libsignal.SessionCipher(textsecure.storage.protocol, address, options);
        switch(envelope.type) {
            case textsecure.protobuf.Envelope.Type.CIPHERTEXT:
                console.log('message from', this.getEnvelopeId(envelope));
                promise = sessionCipher.decryptWhisperMessage(ciphertext).then(this.unpad);
                break;
            case textsecure.protobuf.Envelope.Type.PREKEY_BUNDLE:
                console.log('prekey message from', this.getEnvelopeId(envelope));
                promise = this.decryptPreKeyWhisperMessage(ciphertext, sessionCipher, address);
                break;
            default:
                promise = Promise.reject(new Error("Unknown message type"));
        }
        return promise.then(function(plaintext) {
            return this.updateCache(envelope, plaintext).then(function() {
                return plaintext;
            }, function(error) {
                console.log(
                    'decrypt failed to save decrypted message contents to cache:',
                    error && error.stack ? error.stack : error
                );
                return plaintext;
            });
        }.bind(this)).catch(function(error) {
            if (error.message === 'Unknown identity key') {
                // create an error that the UI will pick up and ask the
                // user if they want to re-negotiate
                var buffer = dcodeIO.ByteBuffer.wrap(ciphertext);
                error = new textsecure.IncomingIdentityKeyError(
                    address.toString(),
                    buffer.toArrayBuffer(),
                    error.identityKey
                );
            }
            var ev = new Event('error');
            ev.error = error;
            ev.proto = envelope;
            ev.confirm = this.removeFromCache.bind(this, envelope);

            var returnError = function() {
                return Promise.reject(error);
            };
            return this.dispatchAndWait(ev).then(returnError, returnError);
        }.bind(this));
    },
    decryptPreKeyWhisperMessage: function(ciphertext, sessionCipher, address) {
        return sessionCipher.decryptPreKeyWhisperMessage(ciphertext).then(this.unpad).catch(function(e) {
            if (e.message === 'Unknown identity key') {
                // create an error that the UI will pick up and ask the
                // user if they want to re-negotiate
                var buffer = dcodeIO.ByteBuffer.wrap(ciphertext);
                throw new textsecure.IncomingIdentityKeyError(
                    address.toString(),
                    buffer.toArrayBuffer(),
                    e.identityKey
                );
            }
            throw e;
        });
    },
    handleSentMessage: function(envelope, destination, timestamp, message, expirationStartTimestamp) {
        var p = Promise.resolve();
        if ((message.flags & textsecure.protobuf.DataMessage.Flags.END_SESSION) ==
                textsecure.protobuf.DataMessage.Flags.END_SESSION ) {
            p = this.handleEndSession(destination);
        }
        return p.then(function() {
            return this.processDecrypted(envelope, message, this.number).then(function(message) {
                var ev = new Event('sent');
                ev.confirm = this.removeFromCache.bind(this, envelope);
                ev.data = {
                    destination              : destination,
                    timestamp                : timestamp.toNumber(),
                    device                   : envelope.sourceDevice,
                    message                  : message
                };
                if (expirationStartTimestamp) {
                  ev.data.expirationStartTimestamp = expirationStartTimestamp.toNumber();
                }
                return this.dispatchAndWait(ev);
            }.bind(this));
        }.bind(this));
    },
    handleDataMessage: function(envelope, message) {
        console.log('data message from', this.getEnvelopeId(envelope));
        var p = Promise.resolve();
        if ((message.flags & textsecure.protobuf.DataMessage.Flags.END_SESSION) ==
                textsecure.protobuf.DataMessage.Flags.END_SESSION ) {
            p = this.handleEndSession(envelope.source);
        }
        return p.then(function() {
            return this.processDecrypted(envelope, message, envelope.source).then(function(message) {
                var ev = new Event('message');
                ev.confirm = this.removeFromCache.bind(this, envelope);
                ev.data = {
                    source       : envelope.source,
                    sourceDevice : envelope.sourceDevice,
                    timestamp    : envelope.timestamp.toNumber(),
                    receivedAt   : envelope.receivedAt,
                    message      : message
                };
                return this.dispatchAndWait(ev);
            }.bind(this));
        }.bind(this));
    },
    handleLegacyMessage: function (envelope) {
        return this.decrypt(envelope, envelope.legacyMessage).then(function(plaintext) {
            return this.innerHandleLegacyMessage(envelope, plaintext);
        }.bind(this));
    },
    innerHandleLegacyMessage: function (envelope, plaintext) {
        var message = textsecure.protobuf.DataMessage.decode(plaintext);
        return this.handleDataMessage(envelope, message);
    },
    handleContentMessage: function (envelope) {
        return this.decrypt(envelope, envelope.content).then(function(plaintext) {
            return this.innerHandleContentMessage(envelope, plaintext);
        }.bind(this));
    },
    innerHandleContentMessage: function(envelope, plaintext) {
        var content = textsecure.protobuf.Content.decode(plaintext);
        if (content.syncMessage) {
            return this.handleSyncMessage(envelope, content.syncMessage);
        } else if (content.dataMessage) {
            return this.handleDataMessage(envelope, content.dataMessage);
        } else if (content.nullMessage) {
            return this.handleNullMessage(envelope, content.nullMessage);
        } else if (content.callMessage) {
            return this.handleCallMessage(envelope, content.callMessage);
        } else if (content.receiptMessage) {
            return this.handleReceiptMessage(envelope, content.receiptMessage);
        } else {
            this.removeFromCache(envelope);
            throw new Error('Unsupported content message');
        }
    },
    handleCallMessage: function(envelope, nullMessage) {
        console.log('call message from', this.getEnvelopeId(envelope));
        this.removeFromCache(envelope);
    },
    handleReceiptMessage: function(envelope, receiptMessage) {
        var results = [];
        if (receiptMessage.type === textsecure.protobuf.ReceiptMessage.Type.DELIVERY) {
            for (var i = 0; i < receiptMessage.timestamps.length; ++i) {
                var ev = new Event('delivery');
                ev.confirm = this.removeFromCache.bind(this, envelope);
                ev.deliveryReceipt = {
                  timestamp    : receiptMessage.timestamps[i].toNumber(),
                  source       : envelope.source,
                  sourceDevice : envelope.sourceDevice
                };
                results.push(this.dispatchAndWait(ev));
            }
        } else if (receiptMessage.type === textsecure.protobuf.ReceiptMessage.Type.READ) {
            for (var i = 0; i < receiptMessage.timestamps.length; ++i) {
                var ev = new Event('read');
                ev.confirm = this.removeFromCache.bind(this, envelope);
                ev.timestamp = envelope.timestamp.toNumber();
                ev.read = {
                    timestamp : receiptMessage.timestamps[i].toNumber(),
                    reader    : envelope.source
                }
                results.push(this.dispatchAndWait(ev));
            }
        }
        return Promise.all(results);
    },
    handleNullMessage: function(envelope, nullMessage) {
        console.log('null message from', this.getEnvelopeId(envelope));
        this.removeFromCache(envelope);
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
            console.log('sent message to',
                    sentMessage.destination,
                    sentMessage.timestamp.toNumber(),
                    'from',
                    this.getEnvelopeId(envelope)
            );
            return this.handleSentMessage(
                    envelope,
                    sentMessage.destination,
                    sentMessage.timestamp,
                    sentMessage.message,
                    sentMessage.expirationStartTimestamp
            );
        } else if (syncMessage.contacts) {
            return this.handleContacts(envelope, syncMessage.contacts);
        } else if (syncMessage.groups) {
            return this.handleGroups(envelope, syncMessage.groups);
        } else if (syncMessage.blocked) {
            return this.handleBlocked(envelope, syncMessage.blocked);
        } else if (syncMessage.request) {
            console.log('Got SyncMessage Request');
            return this.removeFromCache(envelope);
        } else if (syncMessage.read && syncMessage.read.length) {
            console.log('read messages',
                    'from', envelope.source + '.' + envelope.sourceDevice);
            return this.handleRead(envelope, syncMessage.read);
        } else if (syncMessage.verified) {
            return this.handleVerified(envelope, syncMessage.verified);
        } else if (syncMessage.settings) {
            return this.handleSettings(envelope, syncMessage.settings);
        } else {
            throw new Error('Got empty SyncMessage');
        }
    },
    handleSettings: function(envelope, settings) {
        var ev = new Event('settings');
        ev.confirm = this.removeFromCache.bind(this, envelope);
        ev.settings = {
            readReceipts: settings.readReceipts
        };
        return this.dispatchAndWait(ev);
    },
    handleVerified: function(envelope, verified) {
        var ev = new Event('verified');
        ev.confirm = this.removeFromCache.bind(this, envelope);
        ev.verified = {
            state: verified.state,
            destination: verified.destination,
            identityKey: verified.identityKey.toArrayBuffer()
        };
        return this.dispatchAndWait(ev);
    },
    handleRead: function(envelope, read) {
        var results = [];
        for (var i = 0; i < read.length; ++i) {
            var ev = new Event('readSync');
            ev.confirm = this.removeFromCache.bind(this, envelope);
            ev.timestamp = envelope.timestamp.toNumber();
            ev.read = {
                timestamp : read[i].timestamp.toNumber(),
                sender    : read[i].sender
            }
            results.push(this.dispatchAndWait(ev));
        }
        return Promise.all(results);
    },
    handleContacts: function(envelope, contacts) {
        console.log('contact sync');
        var attachmentPointer = contacts.blob;
        return this.handleAttachment(attachmentPointer).then(function() {
            var results = [];
            var contactBuffer = new ContactBuffer(attachmentPointer.data);
            var contactDetails = contactBuffer.next();
            while (contactDetails !== undefined) {
                var ev = new Event('contact');
                ev.confirm = this.removeFromCache.bind(this, envelope);
                ev.contactDetails = contactDetails;
                results.push(this.dispatchAndWait(ev));

                contactDetails = contactBuffer.next();
            }

            var ev = new Event('contactsync');
            ev.confirm = this.removeFromCache.bind(this, envelope);
            results.push(this.dispatchAndWait(ev));

            return Promise.all(results);
        }.bind(this));
    },
    handleGroups: function(envelope, groups) {
        console.log('group sync');
        var attachmentPointer = groups.blob;
        return this.handleAttachment(attachmentPointer).then(function() {
            var groupBuffer = new GroupBuffer(attachmentPointer.data);
            var groupDetails = groupBuffer.next();
            var promises = [];
            while (groupDetails !== undefined) {
                var promise = (function(groupDetails) {
                    groupDetails.id = groupDetails.id.toBinary();
                    if (groupDetails.active) {
                        return textsecure.storage.groups.getGroup(groupDetails.id).
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
                            }).then(function() { return groupDetails });
                    } else {
                        return Promise.resolve(groupDetails);
                    }
                })(groupDetails).then(function(groupDetails) {
                    var ev = new Event('group');
                    ev.confirm = this.removeFromCache.bind(this, envelope);
                    ev.groupDetails = groupDetails;
                    return this.dispatchAndWait(ev);
                }.bind(this)).catch(function(e) {
                    console.log('error processing group', e);
                });
                groupDetails = groupBuffer.next();
                promises.push(promise);
            }

            Promise.all(promises).then(function() {
                var ev = new Event('groupsync');
                ev.confirm = this.removeFromCache.bind(this, envelope);
                return this.dispatchAndWait(ev);
            }.bind(this));
        }.bind(this));
    },
    handleBlocked: function(envelope, blocked) {
        textsecure.storage.put('blocked', blocked.numbers);
    },
    isBlocked: function(number) {
        return textsecure.storage.get('blocked', []).indexOf(number) >= 0;
    },
    handleAttachment: function(attachment) {
        attachment.id = attachment.id.toString();
        attachment.key = attachment.key.toArrayBuffer();

        if (attachment.digest) {
          attachment.digest = attachment.digest.toArrayBuffer();
        }
        function decryptAttachment(encrypted) {
            return textsecure.crypto.decryptAttachment(
                encrypted,
                attachment.key,
                attachment.digest
            );
        }

        function updateAttachment(data) {
            attachment.data = data;
            return attachment;
        }

        return this.server.getAttachment(attachment.id)
            .then(decryptAttachment)
            .then(updateAttachment);
    },
    validateRetryContentMessage: function(content) {
        // Today this is only called for incoming identity key errors. So it can't be a sync message.
        if (content.syncMessage) {
            return false;
        }

        // We want at least one field set, but not more than one
        var count = 0;
        count += content.dataMessage ? 1 : 0;
        count += content.callMessage ? 1 : 0;
        count += content.nullMessage ? 1 : 0;
        if (count !== 1) {
            return false;
        }

        // It's most likely that dataMessage will be populated, so we look at it in detail
        var data = content.dataMessage;
        if (data && !data.attachments.length && !data.body && !data.expireTimer && !data.flags && !data.group) {
            return false;
        }

        return true;
    },
    tryMessageAgain: function(from, ciphertext, message) {
        var address = libsignal.SignalProtocolAddress.fromString(from);
        var sentAt = message.sent_at || Date.now();
        var receivedAt = message.received_at || Date.now();

        var ourNumber = textsecure.storage.user.getNumber();
        var number = address.getName();
        var device = address.getDeviceId();
        var options = {};

        // No limit on message keys if we're communicating with our other devices
        if (ourNumber === number) {
            options.messageKeysLimit = false;
        }

        var sessionCipher = new libsignal.SessionCipher(textsecure.storage.protocol, address, options);
        console.log('retrying prekey whisper message');
        return this.decryptPreKeyWhisperMessage(ciphertext, sessionCipher, address).then(function(plaintext) {
            var envelope = {
                source: number,
                sourceDevice: device,
                receivedAt: receivedAt,
                timestamp: {
                    toNumber: function() {
                        return sentAt;
                    }
                }
            };

            // Before June, all incoming messages were still DataMessage:
            //   - iOS: Michael Kirk says that they were sending Legacy messages until June
            //   - Desktop: https://github.com/WhisperSystems/Signal-Desktop/commit/e8548879db405d9bcd78b82a456ad8d655592c0f
            //   - Android: https://github.com/WhisperSystems/libsignal-service-java/commit/61a75d023fba950ff9b4c75a249d1a3408e12958
            //
            // var d = new Date('2017-06-01T07:00:00.000Z');
            // d.getTime();
            var startOfJune = 1496300400000;
            if (sentAt < startOfJune) {
                return this.innerHandleLegacyMessage(envelope, plaintext);
            }

            // This is ugly. But we don't know what kind of proto we need to decode...
            try {
                // Simply decoding as a Content message may throw
                var content = textsecure.protobuf.Content.decode(plaintext);

                // But it might also result in an invalid object, so we try to detect that
                if (this.validateRetryContentMessage(content)) {
                    return this.innerHandleContentMessage(envelope, plaintext);
                }
            } catch(e) {
                return this.innerHandleLegacyMessage(envelope, plaintext);
            }

            return this.innerHandleLegacyMessage(envelope, plaintext);
        }.bind(this));
    },
    handleEndSession: function(number) {
        console.log('got end session');
        return textsecure.storage.protocol.getDeviceIds(number).then(function(deviceIds) {
            return Promise.all(deviceIds.map(function(deviceId) {
                var address = new libsignal.SignalProtocolAddress(number, deviceId);
                var sessionCipher = new libsignal.SessionCipher(textsecure.storage.protocol, address);

                console.log('deleting sessions for', address.toString());
                return sessionCipher.deleteAllSessionsForDevice();
            }));
        });
    },
    processDecrypted: function(envelope, decrypted, source) {
        // Now that its decrypted, validate the message and clean it up for consumer processing
        // Note that messages may (generally) only perform one action and we ignore remaining fields
        // after the first action.

        if (decrypted.flags == null) {
            decrypted.flags = 0;
        }
        if (decrypted.expireTimer == null) {
            decrypted.expireTimer = 0;
        }

        if (decrypted.flags & textsecure.protobuf.DataMessage.Flags.END_SESSION) {
            decrypted.body = null;
            decrypted.attachments = [];
            decrypted.group = null;
            return Promise.resolve(decrypted);
        } else if (decrypted.flags & textsecure.protobuf.DataMessage.Flags.EXPIRATION_TIMER_UPDATE ) {
            decrypted.body = null;
            decrypted.attachments = [];
        } else if (decrypted.flags & textsecure.protobuf.DataMessage.Flags.PROFILE_KEY_UPDATE) {
            decrypted.body = null;
            decrypted.attachments = [];
        } else if (decrypted.flags != 0) {
            throw new Error("Unknown flags in message");
        }

        var promises = [];

        if (decrypted.group !== null) {
            decrypted.group.id = decrypted.group.id.toBinary();

            if (decrypted.group.type == textsecure.protobuf.GroupContext.Type.UPDATE) {
                if (decrypted.group.avatar !== null) {
                    promises.push(this.handleAttachment(decrypted.group.avatar));
                }
            }

            promises.push(textsecure.storage.groups.getNumbers(decrypted.group.id).then(function(existingGroup) {
                if (existingGroup === undefined) {
                    if (decrypted.group.type != textsecure.protobuf.GroupContext.Type.UPDATE) {
                        decrypted.group.members = [source];
                        console.log("Got message for unknown group");
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
                        decrypted.body = null;
                        decrypted.attachments = [];
                        return textsecure.storage.groups.updateNumbers(
                            decrypted.group.id, decrypted.group.members
                        );

                        break;
                    case textsecure.protobuf.GroupContext.Type.QUIT:
                        decrypted.body = null;
                        decrypted.attachments = [];
                        if (source === this.number) {
                            return textsecure.storage.groups.deleteGroup(decrypted.group.id);
                        } else {
                            return textsecure.storage.groups.removeNumber(decrypted.group.id, source);
                        }
                    case textsecure.protobuf.GroupContext.Type.DELIVER:
                        decrypted.group.name = null;
                        decrypted.group.members = [];
                        decrypted.group.avatar = null;

                        break;
                    default:
                        this.removeFromCache(envelope);
                        throw new Error("Unknown group message type");
                    }
                }
            }.bind(this)));
        }

        // We don't wait for the completion of attachment downloads
        var downloads = decrypted.attachmentDownloads = {};
        _.forEach(decrypted.attachments, function(attachment) {
            downloads[attachment.id] = this.messageAttachmentPool(function() {
                return this.handleAttachment(attachment);
            }.bind(this));
        }.bind(this));
        return Promise.all(promises).then(function() {
            return decrypted;
        });
    }
});

window.textsecure = window.textsecure || {};

textsecure.MessageReceiver = function(url, username, password, signalingKey, options) {
    var messageReceiver = new MessageReceiver(url, username, password, signalingKey, options);
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

