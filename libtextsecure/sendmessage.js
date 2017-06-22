/*
 * vim: ts=4:sw=4:expandtab
 */

function stringToArrayBuffer(str) {
    if (typeof str !== 'string') {
        throw new Error('Passed non-string to stringToArrayBuffer');
    }
    var res = new ArrayBuffer(str.length);
    var uint = new Uint8Array(res);
    for (var i = 0; i < str.length; i++) {
        uint[i] = str.charCodeAt(i);
    }
    return res;
}

function Message(options) {
    this.body        = options.body;
    this.attachments = options.attachments || [];
    this.group       = options.group;
    this.flags       = options.flags;
    this.recipients  = options.recipients;
    this.timestamp   = options.timestamp;
    this.needsSync   = options.needsSync;
    this.expireTimer = options.expireTimer;

    if (!(this.recipients instanceof Array) || this.recipients.length < 1) {
        throw new Error('Invalid recipient list');
    }

    if (!this.group && this.recipients.length > 1) {
        throw new Error('Invalid recipient list for non-group');
    }

    if (typeof this.timestamp !== 'number') {
        throw new Error('Invalid timestamp');
    }

    if (this.expireTimer !== undefined && this.expireTimer !== null) {
        if (typeof this.expireTimer !== 'number' || !(this.expireTimer >= 0)) {
            throw new Error('Invalid expireTimer');
        }
    }

    if (this.attachments) {
        if (!(this.attachments instanceof Array)) {
            throw new Error('Invalid message attachments');
        }
    }
    if (this.flags !== undefined) {
        if (typeof this.flags !== 'number') {
            throw new Error('Invalid message flags');
        }
    }
    if (this.isEndSession()) {
        if (this.body !== null || this.group !== null || this.attachments.length !== 0) {
            throw new Error('Invalid end session message');
        }
    } else {
        if ( (typeof this.timestamp !== 'number') ||
            (this.body && typeof this.body !== 'string') ) {
            throw new Error('Invalid message body');
        }
        if (this.group) {
            if ( (typeof this.group.id !== 'string') ||
                (typeof this.group.type !== 'number') ) {
                throw new Error('Invalid group context');
            }
        }
    }
}

Message.prototype = {
    constructor: Message,
    isEndSession: function() {
        return (this.flags & textsecure.protobuf.DataMessage.Flags.END_SESSION);
    },
    toProto: function() {
        if (this.dataMessage instanceof textsecure.protobuf.DataMessage) {
            return this.dataMessage;
        }
        var proto         = new textsecure.protobuf.DataMessage();
        if (this.body) {
          proto.body        = this.body;
        }
        proto.attachments = this.attachmentPointers;
        if (this.flags) {
            proto.flags = this.flags;
        }
        if (this.group) {
            proto.group      = new textsecure.protobuf.GroupContext();
            proto.group.id   = stringToArrayBuffer(this.group.id);
            proto.group.type = this.group.type
        }
        if (this.expireTimer) {
            proto.expireTimer = this.expireTimer;
        }

        this.dataMessage = proto;
        return proto;
    },
    toArrayBuffer: function() {
        return this.toProto().toArrayBuffer();
    }
};

function MessageSender(url, ports, username, password) {
    this.server = new TextSecureServer(url, ports, username, password);
    this.pendingMessages = {};
}

MessageSender.prototype = {
    constructor: MessageSender,
    makeAttachmentPointer: function(attachment) {
        if (typeof attachment !== 'object' || attachment == null) {
            return Promise.resolve(undefined);
        }
        var proto = new textsecure.protobuf.AttachmentPointer();
        proto.key = libsignal.crypto.getRandomBytes(64);

        var iv = libsignal.crypto.getRandomBytes(16);
        return textsecure.crypto.encryptAttachment(attachment.data, proto.key, iv).then(function(result) {
            return this.server.putAttachment(result.ciphertext).then(function(id) {
                proto.id = id;
                proto.contentType = attachment.contentType;
                proto.digest = result.digest;
                if (attachment.fileName) {
                    proto.fileName = attachment.fileName;
                }
                if (attachment.size) {
                    proto.size = attachment.size;
                }
                if (attachment.flags) {
                    proto.flags = attachment.flags;
                }
                return proto;
            });
        }.bind(this));
    },

    retransmitMessage: function(number, jsonData, timestamp) {
        var outgoing = new OutgoingMessage(this.server);
        return outgoing.transmitMessage(number, jsonData, timestamp);
    },

    tryMessageAgain: function(number, encodedMessage, timestamp) {
        var proto = textsecure.protobuf.DataMessage.decode(encodedMessage);
        return this.sendIndividualProto(number, proto, timestamp);
    },

    queueJobForNumber: function(number, runJob) {
        var runPrevious = this.pendingMessages[number] || Promise.resolve();
        var runCurrent = this.pendingMessages[number] = runPrevious.then(runJob, runJob);
        runCurrent.then(function() {
            if (this.pendingMessages[number] === runCurrent) {
                delete this.pendingMessages[number];
            }
        }.bind(this));
    },

    uploadMedia: function(message) {
        return Promise.all(
            message.attachments.map(this.makeAttachmentPointer.bind(this))
        ).then(function(attachmentPointers) {
            message.attachmentPointers = attachmentPointers;
        }).catch(function(error) {
            if (error instanceof Error && error.name === 'HTTPError') {
                throw new textsecure.MessageError(message, error);
            } else {
                throw error;
            }
        });
    },

    sendMessage: function(attrs) {
        var message = new Message(attrs);
        return this.uploadMedia(message).then(function() {
            return new Promise(function(resolve, reject) {
                this.sendMessageProto(
                    message.timestamp,
                    message.recipients,
                    message.toProto(),
                    function(res) {
                        res.dataMessage = message.toArrayBuffer();
                        if (res.errors.length > 0) {
                            reject(res);
                        } else {
                            resolve(res);
                        }
                    }
                );
            }.bind(this));
        }.bind(this));
    },
    sendMessageProto: function(timestamp, numbers, message, callback) {
        var rejections = textsecure.storage.get('signedKeyRotationRejected', 0);
        if (rejections > 5) {
            throw new textsecure.SignedPreKeyRotationError(numbers, message.toArrayBuffer(), timestamp);
        }

        var outgoing = new OutgoingMessage(this.server, timestamp, numbers, message, callback);

        numbers.forEach(function(number) {
            this.queueJobForNumber(number, function() {
                return outgoing.sendToNumber(number);
            });
        }.bind(this));
    },

    retrySendMessageProto: function(numbers, encodedMessage, timestamp) {
        var proto = textsecure.protobuf.DataMessage.decode(encodedMessage);
        return new Promise(function(resolve, reject) {
            this.sendMessageProto(timestamp, numbers, proto, function(res) {
                if (res.errors.length > 0)
                    reject(res);
                else
                    resolve(res);
            });
        }.bind(this));
    },

    sendIndividualProto: function(number, proto, timestamp) {
        return new Promise(function(resolve, reject) {
            this.sendMessageProto(timestamp, [number], proto, function(res) {
                if (res.errors.length > 0)
                    reject(res);
                else
                    resolve(res);
            });
        }.bind(this));
    },

    createSyncMessage: function() {
        var syncMessage = new textsecure.protobuf.SyncMessage();

        // Generate a random int from 1 and 512
        var buffer = libsignal.crypto.getRandomBytes(1);
        var paddingLength = (new Uint8Array(buffer)[0] & 0x1ff) + 1;

        // Generate a random padding buffer of the chosen size
        syncMessage.padding = libsignal.crypto.getRandomBytes(paddingLength);

        return syncMessage;
    },

    sendSyncMessage: function(encodedDataMessage, timestamp, destination, expirationStartTimestamp) {
        var myNumber = textsecure.storage.user.getNumber();
        var myDevice = textsecure.storage.user.getDeviceId();
        if (myDevice == 1) {
            return Promise.resolve();
        }

        var dataMessage = textsecure.protobuf.DataMessage.decode(encodedDataMessage);
        var sentMessage = new textsecure.protobuf.SyncMessage.Sent();
        sentMessage.timestamp = timestamp;
        sentMessage.message = dataMessage;
        if (destination) {
            sentMessage.destination = destination;
        }
        if (expirationStartTimestamp) {
            sentMessage.expirationStartTimestamp = expirationStartTimestamp;
        }
        var syncMessage = this.createSyncMessage();
        syncMessage.sent = sentMessage;
        var contentMessage = new textsecure.protobuf.Content();
        contentMessage.syncMessage = syncMessage;
        return this.sendIndividualProto(myNumber, contentMessage, Date.now());
    },

    getProfile: function(number) {
        return this.server.getProfile(number);
    },

    sendRequestGroupSyncMessage: function() {
        var myNumber = textsecure.storage.user.getNumber();
        var myDevice = textsecure.storage.user.getDeviceId();
        if (myDevice != 1) {
            var request = new textsecure.protobuf.SyncMessage.Request();
            request.type = textsecure.protobuf.SyncMessage.Request.Type.GROUPS;
            var syncMessage = this.createSyncMessage();
            syncMessage.request = request;
            var contentMessage = new textsecure.protobuf.Content();
            contentMessage.syncMessage = syncMessage;

            return this.sendIndividualProto(myNumber, contentMessage, Date.now());
        }
    },

    sendRequestContactSyncMessage: function() {
        var myNumber = textsecure.storage.user.getNumber();
        var myDevice = textsecure.storage.user.getDeviceId();
        if (myDevice != 1) {
            var request = new textsecure.protobuf.SyncMessage.Request();
            request.type = textsecure.protobuf.SyncMessage.Request.Type.CONTACTS;
            var syncMessage = this.createSyncMessage();
            syncMessage.request = request;
            var contentMessage = new textsecure.protobuf.Content();
            contentMessage.syncMessage = syncMessage;

            return this.sendIndividualProto(myNumber, contentMessage, Date.now());
        }
    },
    syncReadMessages: function(reads) {
        var myNumber = textsecure.storage.user.getNumber();
        var myDevice = textsecure.storage.user.getDeviceId();
        if (myDevice != 1) {
            var syncMessage = this.createSyncMessage();
            syncMessage.read = [];
            for (var i = 0; i < reads.length; ++i) {
                var read = new textsecure.protobuf.SyncMessage.Read();
                read.timestamp = reads[i].timestamp;
                read.sender = reads[i].sender;
                syncMessage.read.push(read);
            }
            var contentMessage = new textsecure.protobuf.Content();
            contentMessage.syncMessage = syncMessage;

            return this.sendIndividualProto(myNumber, contentMessage, Date.now());
        }
    },
    syncVerification: function(destination, state, identityKey) {
        var myNumber = textsecure.storage.user.getNumber();
        var myDevice = textsecure.storage.user.getDeviceId();
        if (myDevice != 1) {
            var verified = new textsecure.protobuf.Verified();
            verified.state = state;
            verified.destination = destination;
            verified.identityKey = identityKey;

            var syncMessage = this.createSyncMessage();
            syncMessage.verified = verified;

            var contentMessage = new textsecure.protobuf.Content();
            contentMessage.syncMessage = syncMessage;

            return this.sendIndividualProto(myNumber, contentMessage, Date.now());
        }
    },

    sendGroupProto: function(numbers, proto, timestamp) {
        timestamp = timestamp || Date.now();
        var me = textsecure.storage.user.getNumber();
        numbers = numbers.filter(function(number) { return number != me; });
        if (numbers.length === 0) {
            return Promise.reject(new Error('No other members in the group'));
        }

        return new Promise(function(resolve, reject) {
            this.sendMessageProto(timestamp, numbers, proto, function(res) {
                res.dataMessage = proto.toArrayBuffer();
                if (res.errors.length > 0)
                    reject(res);
                else
                    resolve(res);
            }.bind(this));
        }.bind(this));
    },

    sendMessageToNumber: function(number, messageText, attachments, timestamp, expireTimer) {
        return this.sendMessage({
            recipients  : [number],
            body        : messageText,
            timestamp   : timestamp,
            attachments : attachments,
            needsSync   : true,
            expireTimer : expireTimer
        });
    },

    closeSession: function(number, timestamp) {
        console.log('sending end session');
        var proto = new textsecure.protobuf.DataMessage();
        proto.body = "TERMINATE";
        proto.flags = textsecure.protobuf.DataMessage.Flags.END_SESSION;
        return this.sendIndividualProto(number, proto, timestamp).then(function(res) {
            return this.sendSyncMessage(proto.toArrayBuffer(), timestamp, number).then(function() {
                return textsecure.storage.protocol.getDeviceIds(number).then(function(deviceIds) {
                    return Promise.all(deviceIds.map(function(deviceId) {
                        var address = new libsignal.SignalProtocolAddress(number, deviceId);
                        console.log('closing session for', address.toString());
                        var sessionCipher = new libsignal.SessionCipher(textsecure.storage.protocol, address);
                        return sessionCipher.closeOpenSessionForDevice();
                    })).then(function() {
                        return res;
                    });
                });
            });
        }.bind(this));
    },

    sendMessageToGroup: function(groupId, messageText, attachments, timestamp, expireTimer) {
        return textsecure.storage.groups.getNumbers(groupId).then(function(numbers) {
            if (numbers === undefined)
                return Promise.reject(new Error("Unknown Group"));

            var me = textsecure.storage.user.getNumber();
            numbers = numbers.filter(function(number) { return number != me; });
            if (numbers.length === 0) {
                return Promise.reject(new Error('No other members in the group'));
            }

            return this.sendMessage({
                recipients  : numbers,
                body        : messageText,
                timestamp   : timestamp,
                attachments : attachments,
                needsSync   : true,
                expireTimer : expireTimer,
                group: {
                    id: groupId,
                    type: textsecure.protobuf.GroupContext.Type.DELIVER
                }
            });
        }.bind(this));
    },

    createGroup: function(numbers, name, avatar) {
        var proto = new textsecure.protobuf.DataMessage();
        proto.group = new textsecure.protobuf.GroupContext();

        return textsecure.storage.groups.createNewGroup(numbers).then(function(group) {
            proto.group.id = stringToArrayBuffer(group.id);
            var numbers = group.numbers;

            proto.group.type = textsecure.protobuf.GroupContext.Type.UPDATE;
            proto.group.members = numbers;
            proto.group.name = name;

            return this.makeAttachmentPointer(avatar).then(function(attachment) {
                proto.group.avatar = attachment;
                return this.sendGroupProto(numbers, proto).then(function() {
                    return proto.group.id;
                });
            }.bind(this));
        }.bind(this));
    },

    updateGroup: function(groupId, name, avatar, numbers) {
        var proto = new textsecure.protobuf.DataMessage();
        proto.group = new textsecure.protobuf.GroupContext();

        proto.group.id = stringToArrayBuffer(groupId);
        proto.group.type = textsecure.protobuf.GroupContext.Type.UPDATE;
        proto.group.name = name;

        return textsecure.storage.groups.addNumbers(groupId, numbers).then(function(numbers) {
            if (numbers === undefined) {
                return Promise.reject(new Error("Unknown Group"));
            }
            proto.group.members = numbers;

            return this.makeAttachmentPointer(avatar).then(function(attachment) {
                proto.group.avatar = attachment;
                return this.sendGroupProto(numbers, proto).then(function() {
                    return proto.group.id;
                });
            }.bind(this));
        }.bind(this));
    },

    addNumberToGroup: function(groupId, number) {
        var proto = new textsecure.protobuf.DataMessage();
        proto.group = new textsecure.protobuf.GroupContext();
        proto.group.id = stringToArrayBuffer(groupId);
        proto.group.type = textsecure.protobuf.GroupContext.Type.UPDATE;

        return textsecure.storage.groups.addNumbers(groupId, [number]).then(function(numbers) {
            if (numbers === undefined)
                return Promise.reject(new Error("Unknown Group"));
            proto.group.members = numbers;

            return this.sendGroupProto(numbers, proto);
        }.bind(this));
    },

    setGroupName: function(groupId, name) {
        var proto = new textsecure.protobuf.DataMessage();
        proto.group = new textsecure.protobuf.GroupContext();
        proto.group.id = stringToArrayBuffer(groupId);
        proto.group.type = textsecure.protobuf.GroupContext.Type.UPDATE;
        proto.group.name = name;

        return textsecure.storage.groups.getNumbers(groupId).then(function(numbers) {
            if (numbers === undefined)
                return Promise.reject(new Error("Unknown Group"));
            proto.group.members = numbers;

            return this.sendGroupProto(numbers, proto);
        }.bind(this));
    },

    setGroupAvatar: function(groupId, avatar) {
        var proto = new textsecure.protobuf.DataMessage();
        proto.group = new textsecure.protobuf.GroupContext();
        proto.group.id = stringToArrayBuffer(groupId);
        proto.group.type = textsecure.protobuf.GroupContext.Type.UPDATE;

        return textsecure.storage.groups.getNumbers(groupId).then(function(numbers) {
            if (numbers === undefined)
                return Promise.reject(new Error("Unknown Group"));
            proto.group.members = numbers;

            return this.makeAttachmentPointer(avatar).then(function(attachment) {
                proto.group.avatar = attachment;
                return this.sendGroupProto(numbers, proto);
            }.bind(this));
        }.bind(this));
    },

    leaveGroup: function(groupId) {
        var proto = new textsecure.protobuf.DataMessage();
        proto.group = new textsecure.protobuf.GroupContext();
        proto.group.id = stringToArrayBuffer(groupId);
        proto.group.type = textsecure.protobuf.GroupContext.Type.QUIT;

        return textsecure.storage.groups.getNumbers(groupId).then(function(numbers) {
            if (numbers === undefined)
                return Promise.reject(new Error("Unknown Group"));
            return textsecure.storage.groups.deleteGroup(groupId).then(function() {
                return this.sendGroupProto(numbers, proto);
            }.bind(this));
        });
    },
    sendExpirationTimerUpdateToGroup: function(groupId, expireTimer, timestamp) {
        return textsecure.storage.groups.getNumbers(groupId).then(function(numbers) {
            if (numbers === undefined)
                return Promise.reject(new Error("Unknown Group"));

            var me = textsecure.storage.user.getNumber();
            numbers = numbers.filter(function(number) { return number != me; });
            if (numbers.length === 0) {
                return Promise.reject(new Error('No other members in the group'));
            }
            return this.sendMessage({
                recipients  : numbers,
                timestamp   : timestamp,
                needsSync   : true,
                expireTimer : expireTimer,
                flags       : textsecure.protobuf.DataMessage.Flags.EXPIRATION_TIMER_UPDATE,
                group: {
                    id: groupId,
                    type: textsecure.protobuf.GroupContext.Type.DELIVER
                }
            });
        }.bind(this));
    },
    sendExpirationTimerUpdateToNumber: function(number, expireTimer, timestamp) {
        var proto = new textsecure.protobuf.DataMessage();
        return this.sendMessage({
            recipients  : [number],
            timestamp   : timestamp,
            needsSync   : true,
            expireTimer : expireTimer,
            flags       : textsecure.protobuf.DataMessage.Flags.EXPIRATION_TIMER_UPDATE
        });
    }
};

window.textsecure = window.textsecure || {};

textsecure.MessageSender = function(url, ports, username, password) {
    var sender = new MessageSender(url, ports, username, password);
    textsecure.replay.registerFunction(sender.tryMessageAgain.bind(sender), textsecure.replay.Type.ENCRYPT_MESSAGE);
    textsecure.replay.registerFunction(sender.retransmitMessage.bind(sender), textsecure.replay.Type.TRANSMIT_MESSAGE);
    textsecure.replay.registerFunction(sender.sendMessage.bind(sender), textsecure.replay.Type.REBUILD_MESSAGE);
    textsecure.replay.registerFunction(sender.retrySendMessageProto.bind(sender), textsecure.replay.Type.RETRY_SEND_MESSAGE_PROTO);

    this.sendExpirationTimerUpdateToNumber = sender.sendExpirationTimerUpdateToNumber.bind(sender);
    this.sendExpirationTimerUpdateToGroup  = sender.sendExpirationTimerUpdateToGroup .bind(sender);
    this.sendRequestGroupSyncMessage       = sender.sendRequestGroupSyncMessage      .bind(sender);
    this.sendRequestContactSyncMessage     = sender.sendRequestContactSyncMessage    .bind(sender);
    this.sendMessageToNumber               = sender.sendMessageToNumber              .bind(sender);
    this.closeSession                      = sender.closeSession                     .bind(sender);
    this.sendMessageToGroup                = sender.sendMessageToGroup               .bind(sender);
    this.createGroup                       = sender.createGroup                      .bind(sender);
    this.updateGroup                       = sender.updateGroup                      .bind(sender);
    this.addNumberToGroup                  = sender.addNumberToGroup                 .bind(sender);
    this.setGroupName                      = sender.setGroupName                     .bind(sender);
    this.setGroupAvatar                    = sender.setGroupAvatar                   .bind(sender);
    this.leaveGroup                        = sender.leaveGroup                       .bind(sender);
    this.sendSyncMessage                   = sender.sendSyncMessage                  .bind(sender);
    this.getProfile                        = sender.getProfile                       .bind(sender);
    this.syncReadMessages                  = sender.syncReadMessages                 .bind(sender);
    this.syncVerification                  = sender.syncVerification                 .bind(sender);
};

textsecure.MessageSender.prototype = {
    constructor: textsecure.MessageSender
};
