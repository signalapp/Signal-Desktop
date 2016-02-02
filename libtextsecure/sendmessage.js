/*
 * vim: ts=4:sw=4:expandtab
 */
function MessageSender(url, username, password, attachment_server_url) {
    this.server = new TextSecureServer(url, username, password, attachment_server_url);
    this.pendingMessages = {};
}

MessageSender.prototype = {
    constructor: MessageSender,
    makeAttachmentPointer: function(attachment) {
        if (typeof attachment !== 'object' || attachment == null) {
            return Promise.resolve(undefined);
        }
        var proto = new textsecure.protobuf.AttachmentPointer();
        proto.key = textsecure.crypto.getRandomBytes(64);

        var iv = textsecure.crypto.getRandomBytes(16);
        return textsecure.crypto.encryptAttachment(attachment.data, proto.key, iv).then(function(encryptedBin) {
            return this.server.putAttachment(encryptedBin).then(function(id) {
                proto.id = id;
                proto.contentType = attachment.contentType;
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

    sendMessageProto: function(timestamp, numbers, message, callback) {
        var outgoing = new OutgoingMessage(this.server, timestamp, numbers, message, callback);

        numbers.forEach(function(number) {
            this.queueJobForNumber(number, function() {
                return outgoing.sendToNumber(number);
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

    sendSyncMessage: function(encodedDataMessage, timestamp, destination) {
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
        var syncMessage = new textsecure.protobuf.SyncMessage();
        syncMessage.sent = sentMessage;
        var contentMessage = new textsecure.protobuf.Content();
        contentMessage.syncMessage = syncMessage;
        return this.sendIndividualProto(myNumber, contentMessage, Date.now());
    },

    sendRequestGroupSyncMessage: function() {
        var myNumber = textsecure.storage.user.getNumber();
        var myDevice = textsecure.storage.user.getDeviceId();
        if (myDevice != 1) {
            var request = new textsecure.protobuf.SyncMessage.Request();
            request.type = textsecure.protobuf.SyncMessage.Request.Type.GROUPS;
            var syncMessage = new textsecure.protobuf.SyncMessage();
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
            var syncMessage = new textsecure.protobuf.SyncMessage();
            syncMessage.request = request;
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

    sendMessageToNumber: function(number, messageText, attachments, timestamp) {
        var proto = new textsecure.protobuf.DataMessage();
        proto.body = messageText;

        return Promise.all(attachments.map(this.makeAttachmentPointer.bind(this))).then(function(attachmentsArray) {
            proto.attachments = attachmentsArray;
            return this.sendIndividualProto(number, proto, timestamp).then(function(res) {
                res.dataMessage = proto.toArrayBuffer();
                return res;
            }.bind(this)).catch(function(res) {
                res.dataMessage = proto.toArrayBuffer();
                throw res;
            }.bind(this));
        }.bind(this));
    },

    closeSession: function(number, timestamp) {
        console.log('sending end session');
        var proto = new textsecure.protobuf.DataMessage();
        proto.body = "TERMINATE";
        proto.flags = textsecure.protobuf.DataMessage.Flags.END_SESSION;
        return this.sendIndividualProto(number, proto, timestamp).then(function(res) {
            return textsecure.storage.devices.getDeviceObjectsForNumber(number).then(function(devices) {
                return Promise.all(devices.map(function(device) {
                    console.log('closing session for', device.encodedNumber);
                    return textsecure.protocol_wrapper.closeOpenSessionForDevice(device.encodedNumber);
                })).then(function() {
                    return res;
                });
            });
        });
    },

    sendMessageToGroup: function(groupId, messageText, attachments, timestamp) {
        var proto = new textsecure.protobuf.DataMessage();
        proto.body = messageText;
        proto.group = new textsecure.protobuf.GroupContext();
        proto.group.id = toArrayBuffer(groupId);
        proto.group.type = textsecure.protobuf.GroupContext.Type.DELIVER;

        return textsecure.storage.groups.getNumbers(groupId).then(function(numbers) {
            if (numbers === undefined)
                return Promise.reject(new Error("Unknown Group"));

            return Promise.all(attachments.map(this.makeAttachmentPointer.bind(this))).then(function(attachmentsArray) {
                proto.attachments = attachmentsArray;
                return this.sendGroupProto(numbers, proto, timestamp);
            }.bind(this));
        }.bind(this));
    },

    createGroup: function(numbers, name, avatar) {
        var proto = new textsecure.protobuf.DataMessage();
        proto.group = new textsecure.protobuf.GroupContext();

        return textsecure.storage.groups.createNewGroup(numbers).then(function(group) {
            proto.group.id = toArrayBuffer(group.id);
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

        proto.group.id = toArrayBuffer(groupId);
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
        proto.group.id = toArrayBuffer(groupId);
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
        proto.group.id = toArrayBuffer(groupId);
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
        proto.group.id = toArrayBuffer(groupId);
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
        proto.group.id = toArrayBuffer(groupId);
        proto.group.type = textsecure.protobuf.GroupContext.Type.QUIT;

        return textsecure.storage.groups.getNumbers(groupId).then(function(numbers) {
            if (numbers === undefined)
                return Promise.reject(new Error("Unknown Group"));
            return textsecure.storage.groups.deleteGroup(groupId).then(function() {
                return this.sendGroupProto(numbers, proto);
            }.bind(this));
        });
    }
};

window.textsecure = window.textsecure || {};

textsecure.MessageSender = function(url, username, password, attachment_server_url) {
    var sender = new MessageSender(url, username, password, attachment_server_url);
    textsecure.replay.registerFunction(sender.tryMessageAgain.bind(sender), textsecure.replay.Type.ENCRYPT_MESSAGE);
    textsecure.replay.registerFunction(sender.retransmitMessage.bind(sender), textsecure.replay.Type.TRANSMIT_MESSAGE);

    this.sendRequestGroupSyncMessage   = sender.sendRequestGroupSyncMessage  .bind(sender);
    this.sendRequestContactSyncMessage = sender.sendRequestContactSyncMessage.bind(sender);
    this.sendMessageToNumber           = sender.sendMessageToNumber          .bind(sender);
    this.closeSession                  = sender.closeSession                 .bind(sender);
    this.sendMessageToGroup            = sender.sendMessageToGroup           .bind(sender);
    this.createGroup                   = sender.createGroup                  .bind(sender);
    this.updateGroup                   = sender.updateGroup                  .bind(sender);
    this.addNumberToGroup              = sender.addNumberToGroup             .bind(sender);
    this.setGroupName                  = sender.setGroupName                 .bind(sender);
    this.setGroupAvatar                = sender.setGroupAvatar               .bind(sender);
    this.leaveGroup                    = sender.leaveGroup                   .bind(sender);
    this.sendSyncMessage               = sender.sendSyncMessage              .bind(sender);
};

textsecure.MessageSender.prototype = {
    constructor: textsecure.MessageSender
};
