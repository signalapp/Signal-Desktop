/*
 * vim: ts=4:sw=4:expandtab
 */
function MessageSender(url, username, password) {
    this.server = new TextSecureServer(url, username, password);
}

MessageSender.prototype = {
    constructor: MessageSender,
        // message == DataMessage or ContentMessage proto
    sendMessageToDevices: function(timestamp, number, deviceObjectList, message) {
        var relay = deviceObjectList[0].relay;
        for (var i=1; i < deviceObjectList.length; ++i) {
            if (deviceObjectList[i].relay !== relay) {
                throw new Error("Mismatched relays for number " + number);
            }
        }
        return Promise.all(deviceObjectList.map(function(device) {
            return textsecure.protocol_wrapper.encryptMessageFor(device, message).then(function(encryptedMsg) {
                return textsecure.protocol_wrapper.getRegistrationId(device.encodedNumber).then(function(registrationId) {
                    return textsecure.storage.devices.removeTempKeysFromDevice(device.encodedNumber).then(function() {
                        var json = {
                            type: encryptedMsg.type,
                            destinationDeviceId: textsecure.utils.unencodeNumber(device.encodedNumber)[1],
                            destinationRegistrationId: registrationId,
                            content: encryptedMsg.body,
                            timestamp: timestamp
                        };

                        if (device.relay !== undefined) {
                            json.relay = device.relay;
                        }

                        return json;
                    });
                });
            });
        })).then(function(jsonData) {
            var legacy = (message instanceof textsecure.protobuf.DataMessage);
            return this.sendRequest(number, jsonData, legacy);
        }.bind(this));
    },

    sendRequest: function(number, jsonData, legacy) {
        return this.server.sendMessages(number, jsonData, legacy).catch(function(e) {
            if (e.name === 'HTTPError' && e.code === -1) {
                throw new NetworkError(number, jsonData, legacy);
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
        var numbersCompleted = 0;
        var errors = [];
        var successfulNumbers = [];

        var numberCompleted = function() {
            numbersCompleted++;
            if (numbersCompleted >= numbers.length)
                callback({success: successfulNumbers, failure: errors});
        };

        var registerError = function(number, reason, error) {
            if (!error) {
                error = new Error(reason);
            }
            error.number = number;
            error.reason = reason;
            errors[errors.length] = error;
            numberCompleted();
        };

        var reloadDevicesAndSend = function(number, recurse) {
            return function() {
                return textsecure.storage.devices.getDeviceObjectsForNumber(number).then(function(devicesForNumber) {
                    if (devicesForNumber.length == 0)
                        return registerError(number, "Got empty device list when loading device keys", null);
                    doSendMessage(number, devicesForNumber, recurse);
                });
            }
        };

        var getKeysForNumber = function(number, updateDevices) {
            var handleResult = function(response) {
                return Promise.all(response.devices.map(function(device) {
                    if (updateDevices === undefined || updateDevices.indexOf(device.deviceId) > -1)
                        return textsecure.storage.devices.saveKeysToDeviceObject({
                            encodedNumber: number + "." + device.deviceId,
                            identityKey: response.identityKey,
                            preKey: device.preKey.publicKey,
                            preKeyId: device.preKey.keyId,
                            signedKey: device.signedPreKey.publicKey,
                            signedKeyId: device.signedPreKey.keyId,
                            signedKeySignature: device.signedPreKey.signature,
                            registrationId: device.registrationId
                        }).catch(function(error) {
                            if (error.message === "Identity key changed") {
                                error = new textsecure.OutgoingIdentityKeyError(number, message.toArrayBuffer(), timestamp, error.identityKey);
                                registerError(number, "Identity key changed", error);
                            }
                            throw error;
                        });
                }));
            };

            if (updateDevices === undefined) {
                return this.server.getKeysForNumber(number).then(handleResult);
            } else {
                var promises = updateDevices.map(function(device) {
                    return this.server.getKeysForNumber(number, device).then(handleResult);
                }.bind(this));

                return Promise.all(promises);
            }
        }.bind(this);

        var doSendMessage = function(number, devicesForNumber, recurse) {
            return this.sendMessageToDevices(timestamp, number, devicesForNumber, message).then(function(result) {
                successfulNumbers[successfulNumbers.length] = number;
                numberCompleted();
            }).catch(function(error) {
                if (error instanceof Error && error.name == "HTTPError" && (error.code == 410 || error.code == 409)) {
                    if (!recurse)
                        return registerError(number, "Hit retry limit attempting to reload device list", error);

                    var p;
                    if (error.code == 409) {
                        p = textsecure.storage.devices.removeDeviceIdsForNumber(number, error.response.extraDevices);
                    } else {
                        p = Promise.all(error.response.staleDevices.map(function(deviceId) {
                            return textsecure.protocol_wrapper.closeOpenSessionForDevice(number + '.' + deviceId);
                        }));
                    }

                    p.then(function() {
                        var resetDevices = ((error.code == 410) ? error.response.staleDevices : error.response.missingDevices);
                        getKeysForNumber(number, resetDevices)
                            .then(reloadDevicesAndSend(number, (error.code == 409)))
                            .catch(function(error) {
                                registerError(number, "Failed to reload device keys", error);
                            });
                    });
                } else {
                    registerError(number, "Failed to create or send message", error);
                }
            });
        }.bind(this);

        numbers.forEach(function(number) {
            textsecure.storage.devices.getDeviceObjectsForNumber(number).then(function(devicesForNumber) {
                return Promise.all(devicesForNumber.map(function(device) {
                    return textsecure.protocol_wrapper.hasOpenSession(device.encodedNumber).then(function(result) {
                        if (!result)
                            return getKeysForNumber(number, [parseInt(textsecure.utils.unencodeNumber(device.encodedNumber)[1])]);
                    });
                })).then(function() {
                    return textsecure.storage.devices.getDeviceObjectsForNumber(number).then(function(devicesForNumber) {
                        if (devicesForNumber.length == 0) {
                            getKeysForNumber(number, [1])
                                .then(reloadDevicesAndSend(number, true))
                                .catch(function(error) {
                                    registerError(number, "Failed to retreive new device keys for number " + number, error);
                                });
                        } else
                            doSendMessage(number, devicesForNumber, true);
                    });
                });
            });
        });
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
    textsecure.replay.registerFunction(sender.tryMessageAgain.bind(sender), textsecure.replay.Type.SEND_MESSAGE);
    textsecure.replay.registerFunction(sender.sendRequest.bind(sender), textsecure.replay.Type.NETWORK_REQUEST);

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
