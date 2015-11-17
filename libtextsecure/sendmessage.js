/*
 * vim: ts=4:sw=4:expandtab
 */
function MessageSender(url, username, password) {
    this.server = new TextSecureServer(url, username, password);
    this.pendingMessages = {};
}

MessageSender.prototype = {
    constructor: MessageSender,
    // message == DataMessage or ContentMessage proto
    encryptToDevices: function(timestamp, number, deviceObjectList, message) {
        var legacy = (message instanceof textsecure.protobuf.DataMessage);
        var plaintext = message.toArrayBuffer();
        var relay = deviceObjectList[0].relay;
        for (var i=1; i < deviceObjectList.length; ++i) {
            if (deviceObjectList[i].relay !== relay) {
                throw new Error("Mismatched relays for number " + number);
            }
        }
        return Promise.all(deviceObjectList.map(function(device) {
            return textsecure.protocol_wrapper.encryptMessageFor(device, plaintext).then(function(encryptedMsg) {
                return textsecure.protocol_wrapper.getRegistrationId(device.encodedNumber).then(function(registrationId) {
                    return textsecure.storage.devices.removeTempKeysFromDevice(device.encodedNumber).then(function() {
                        var json = {
                            type: encryptedMsg.type,
                            destinationDeviceId: textsecure.utils.unencodeNumber(device.encodedNumber)[1],
                            destinationRegistrationId: registrationId,
                            timestamp: timestamp
                        };

                        if (device.relay !== undefined) {
                            json.relay = device.relay;
                        }

                        var content = btoa(encryptedMsg.body);
                        if (legacy) {
                            json.body = content;
                        } else {
                            json.content = content;
                        }

                        return json;
                    });
                });
            });
        }));
    },

    transmitMessage: function(number, jsonData) {
        return this.server.sendMessages(number, jsonData).catch(function(e) {
            if (e.name === 'HTTPError' && (e.code !== 409 && e.code !== 410)) {
                // 409 and 410 should bubble and be handled by doSendMessage
                // all other network errors can be retried later.
                throw new textsecure.SendMessageNetworkError(number, jsonData, e);
            }
            throw e;
        });
    },

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

    tryMessageAgain: function(number, encodedMessage, timestamp) {
        var proto = textsecure.protobuf.DataMessage.decode(encodedMessage);
        return this.sendIndividualProto(number, proto, timestamp);
    },

    sendMessageProto: function(timestamp, numbers, message, callback) {
        var outgoing = new OutgoingMessage(timestamp, numbers, message, callback, this);
        outgoing.send();
    },

    sendIndividualProto: function(number, proto, timestamp) {
        return new Promise(function(resolve, reject) {
            this.sendMessageProto(timestamp, [number], proto, function(res) {
                if (res.failure.length > 0)
                    reject(res.failure);
                else
                    resolve();
            });
        }.bind(this));
    },

    sendSyncMessage: function(message, timestamp, destination) {
        var myNumber = textsecure.storage.user.getNumber();
        var myDevice = textsecure.storage.user.getDeviceId();
        if (myDevice != 1) {
            var sentMessage = new textsecure.protobuf.SyncMessage.Sent();
            sentMessage.timestamp = timestamp;
            sentMessage.message = message;
            if (destination) {
                sentMessage.destination = destination;
            }
            var syncMessage = new textsecure.protobuf.SyncMessage();
            syncMessage.sent = sentMessage;
            var contentMessage = new textsecure.protobuf.Content();
            contentMessage.syncMessage = syncMessage;

            return this.sendIndividualProto(myNumber, contentMessage, Date.now());
        }
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
                if (res.failure.length > 0)
                    reject(res.failure);
                else
                    resolve();
            });
        }.bind(this)).then(this.sendSyncMessage.bind(this, proto, timestamp));
    },

    sendMessageToNumber: function(number, messageText, attachments, timestamp) {
        var proto = new textsecure.protobuf.DataMessage();
        proto.body = messageText;

        return Promise.all(attachments.map(this.makeAttachmentPointer.bind(this))).then(function(attachmentsArray) {
            proto.attachments = attachmentsArray;
            return this.sendIndividualProto(number, proto, timestamp).then(function() {
                return this.sendSyncMessage(proto, timestamp, number);
            }.bind(this));
        }.bind(this));
    },

    closeSession: function(number) {
        var proto = new textsecure.protobuf.DataMessage();
        proto.body = "TERMINATE";
        proto.flags = textsecure.protobuf.DataMessage.Flags.END_SESSION;
        return this.sendIndividualProto(number, proto, Date.now()).then(function(res) {
            return textsecure.storage.devices.getDeviceObjectsForNumber(number).then(function(devices) {
                return Promise.all(devices.map(function(device) {
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

textsecure.MessageSender = function(url, username, password) {
    var sender = new MessageSender(url, username, password);
    textsecure.replay.registerFunction(sender.tryMessageAgain.bind(sender), textsecure.replay.Type.ENCRYPT_MESSAGE);
    textsecure.replay.registerFunction(sender.transmitMessage.bind(sender), textsecure.replay.Type.TRANSMIT_MESSAGE);

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
};

textsecure.MessageSender.prototype = {
    constructor: textsecure.MessageSender
};
