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
// sendMessage(numbers = [], message = PushMessageContentProto, callback(success/failure map))
window.textsecure.messaging = function() {
    'use strict';

    var self = {};

    //TODO: Dont hit disk for any of the key-fetching!
    function getKeysForNumber(number, updateDevices) {
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
                    });
            }));
        };

        var promises = [];
        if (updateDevices !== undefined)
            for (var i in updateDevices)
                promises[promises.length] = TextSecureServer.getKeysForNumber(number, updateDevices[i]).then(handleResult);
        else
            return TextSecureServer.getKeysForNumber(number).then(handleResult);

        return Promise.all(promises);
    }

    // success_callback(server success/failure map), error_callback(error_msg)
    // message == PushMessageContentProto (NOT STRING)
    function sendMessageToDevices(timestamp, number, deviceObjectList, message, success_callback, error_callback) {
        var jsonData = [];
        var relay = undefined;
        var promises = [];

        var addEncryptionFor = function(i) {
            if (deviceObjectList[i].relay !== undefined) {
                if (relay === undefined)
                    relay = deviceObjectList[i].relay;
                else if (relay != deviceObjectList[i].relay)
                    return new Promise(function() { throw new Error("Mismatched relays for number " + number); });
            } else {
                if (relay === undefined)
                    relay = "";
                else if (relay != "")
                    return new Promise(function() { throw new Error("Mismatched relays for number " + number); });
            }

            return textsecure.protocol_wrapper.encryptMessageFor(deviceObjectList[i], message).then(function(encryptedMsg) {
                return textsecure.protocol_wrapper.getRegistrationId(deviceObjectList[i].encodedNumber).then(function(registrationId) {
                    return textsecure.storage.devices.removeTempKeysFromDevice(deviceObjectList[i].encodedNumber).then(function() {
                        jsonData[i] = {
                            type: encryptedMsg.type,
                            destinationDeviceId: textsecure.utils.unencodeNumber(deviceObjectList[i].encodedNumber)[1],
                            destinationRegistrationId: registrationId,
                            body: encryptedMsg.body,
                            timestamp: timestamp
                        };

                        if (deviceObjectList[i].relay !== undefined)
                            jsonData[i].relay = deviceObjectList[i].relay;
                    });
                });
            });
        }

        for (var i = 0; i < deviceObjectList.length; i++)
            promises[i] = addEncryptionFor(i);
        return Promise.all(promises).then(function() {
            return TextSecureServer.sendMessages(number, jsonData);
        });
    }

    var makeAttachmentPointer;
    var refreshGroup = function(number, groupId, devicesForNumber) {
        groupId = getString(groupId);

        var doUpdate = false;
        return Promise.all(devicesForNumber.map(function(device) {
            return textsecure.protocol_wrapper.getRegistrationId(device.encodedNumber).then(function(registrationId) {
                return textsecure.storage.groups.needUpdateByDeviceRegistrationId(
                    groupId, number, device.encodedNumber, registrationId
                ).then(function(needUpdate) {
                    if (needUpdate) doUpdate = true;
                });
            });
        })).then(function() {
            if (!doUpdate) return;

            return textsecure.storage.groups.getGroup(groupId).then(function(group) {
                var numberIndex = group.numbers.indexOf(number);
                if (numberIndex < 0) // This is potentially a multi-message rare racing-AJAX race
                    return Promise.reject("Tried to refresh group to non-member");

                var proto = new textsecure.protobuf.DataMessage();
                proto.group = new textsecure.protobuf.GroupContext();

                proto.group.id = toArrayBuffer(group.id);
                proto.group.type = textsecure.protobuf.GroupContext.Type.UPDATE;
                proto.group.members = group.numbers;
                proto.group.name = group.name === undefined ? null : group.name;

                if (group.avatar !== undefined) {
                    return makeAttachmentPointer(group.avatar).then(function(attachment) {
                        proto.group.avatar = attachment;
                        return sendMessageToDevices(Date.now(), number, devicesForNumber, proto);
                    });
                } else {
                    return sendMessageToDevices(Date.now(), number, devicesForNumber, proto);
                }
            });
        });
    }

    var tryMessageAgain = function(number, encodedMessage, timestamp) {
        var proto = textsecure.protobuf.DataMessage.decode(encodedMessage);
        return new Promise(function(resolve, reject) {
            sendMessageProto(timestamp, [number], proto, function(res) {
                if (res.failure.length > 0)
                    reject(res.failure);
                else
                    resolve();
            });
        });
    };
    textsecure.replay.registerFunction(tryMessageAgain, textsecure.replay.Type.SEND_MESSAGE);

    var sendMessageProto = function(timestamp, numbers, message, callback) {
        var numbersCompleted = 0;
        var errors = [];
        var successfulNumbers = [];

        var numberCompleted = function() {
            numbersCompleted++;
            if (numbersCompleted >= numbers.length)
                callback({success: successfulNumbers, failure: errors});
        }

        var registerError = function(number, message, error) {
            if (error) {
                if (error.humanError)
                    message = error.humanError;
            } else
                error = new Error(message);
            errors[errors.length] = { number: number, reason: message, error: error };
            numberCompleted();
        }

        var doSendMessage;
        var reloadDevicesAndSend = function(number, recurse) {
            return function() {
                return textsecure.storage.devices.getDeviceObjectsForNumber(number).then(function(devicesForNumber) {
                    if (devicesForNumber.length == 0)
                        return registerError(number, "Got empty device list when loading device keys", null);
                    doSendMessage(number, devicesForNumber, recurse);
                });
            }
        }

        doSendMessage = function(number, devicesForNumber, recurse) {
            var groupUpdate = Promise.resolve(true);
            if (message.group && message.group.id && message.group.type != textsecure.protobuf.GroupContext.Type.QUIT)
                groupUpdate = refreshGroup(number, message.group.id, devicesForNumber);
            return groupUpdate.then(function() {
                return sendMessageToDevices(timestamp, number, devicesForNumber, message).then(function(result) {
                    successfulNumbers[successfulNumbers.length] = number;
                    numberCompleted();
                });
            }).catch(function(error) {
                if (error instanceof Error && error.name == "HTTPError" && (error.message == 410 || error.message == 409)) {
                    if (!recurse)
                        return registerError(number, "Hit retry limit attempting to reload device list", error);

                    var p;
                    if (error.message == 409) {
                        p = textsecure.storage.devices.removeDeviceIdsForNumber(number, error.response.extraDevices);
                    } else {
                        p = Promise.all(error.response.staleDevices.map(function(deviceId) {
                            return textsecure.protocol_wrapper.closeOpenSessionForDevice(number + '.' + deviceId);
                        }));
                    }

                    p.then(function() {
                        var resetDevices = ((error.message == 410) ? error.response.staleDevices : error.response.missingDevices);
                        getKeysForNumber(number, resetDevices)
                            .then(reloadDevicesAndSend(number, false))
                            .catch(function(error) {
                                if (error.message !== "Identity key changed")
                                    registerError(number, "Failed to reload device keys", error);
                                else {
                                    error = new textsecure.OutgoingIdentityKeyError(number, message.toArrayBuffer(), timestamp);
                                    registerError(number, "Identity key changed", error);
                                }
                            });
                    });
                } else
                    registerError(number, "Failed to create or send message", error);
            });
        }

        var getDevicesAndSendToNumber = function(number) {
            textsecure.storage.devices.getDeviceObjectsForNumber(number).then(function(devicesForNumber) {
                return Promise.all(devicesForNumber.map(function(device) {
                    return textsecure.protocol_wrapper.hasOpenSession(device.encodedNumber).then(function(result) {
                        if (!result)
                            return getKeysForNumber(number, [parseInt(textsecure.utils.unencodeNumber(device.encodedNumber)[1])]);
                    });
                })).then(function() {
                    return textsecure.storage.devices.getDeviceObjectsForNumber(number).then(function(devicesForNumber) {
                        if (devicesForNumber.length == 0) {
                            getKeysForNumber(number)
                                .then(reloadDevicesAndSend(number, true))
                                .catch(function(error) {
                                    registerError(number, "Failed to retreive new device keys for number " + number, error);
                                });
                        } else
                            doSendMessage(number, devicesForNumber, true);
                    });
                });
            });
        };

        for (var i in numbers)
            getDevicesAndSendToNumber(numbers[i]);
    }

    makeAttachmentPointer = function(attachment) {
        var proto = new textsecure.protobuf.AttachmentPointer();
        proto.key = textsecure.crypto.getRandomBytes(64);

        var iv = textsecure.crypto.getRandomBytes(16);
        return textsecure.crypto.encryptAttachment(attachment.data, proto.key, iv).then(function(encryptedBin) {
            return TextSecureServer.putAttachment(encryptedBin).then(function(id) {
                proto.id = id;
                proto.contentType = attachment.contentType;
                return proto;
            });
        });
    }

    var sendIndividualProto = function(number, proto, timestamp) {
        return new Promise(function(resolve, reject) {
            sendMessageProto(timestamp, [number], proto, function(res) {
                if (res.failure.length > 0)
                    reject(res.failure);
                else
                    resolve();
            });
        });
    }

    var sendSyncMessage = function(message, timestamp, destination) {
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

            return sendIndividualProto(myNumber, contentMessage, Date.now());
        }
    }

    var sendGroupProto = function(numbers, proto, timestamp) {
        timestamp = timestamp || Date.now();
        var me = textsecure.storage.user.getNumber();
        numbers = numbers.filter(function(number) { return number != me; });

        return new Promise(function(resolve, reject) {
            sendMessageProto(timestamp, numbers, proto, function(res) {
                if (res.failure.length > 0)
                    reject(res.failure);
                else
                    resolve();
            });
        }).then(function() {
            return sendSyncMessage(proto, timestamp);
        });
    }

    self.sendMessageToNumber = function(number, messageText, attachments, timestamp) {
        var proto = new textsecure.protobuf.DataMessage();
        proto.body = messageText;

        var promises = [];
        for (var i in attachments)
            promises.push(makeAttachmentPointer(attachments[i]));
        return Promise.all(promises).then(function(attachmentsArray) {
            proto.attachments = attachmentsArray;
            return sendIndividualProto(number, proto, timestamp).then(function() {
                return sendSyncMessage(proto, timestamp, number);
            });
        });
    }

    self.closeSession = function(number) {
        var proto = new textsecure.protobuf.DataMessage();
        proto.body = "TERMINATE";
        proto.flags = textsecure.protobuf.DataMessage.Flags.END_SESSION;
        return sendIndividualProto(number, proto, Date.now()).then(function(res) {
            return textsecure.storage.devices.getDeviceObjectsForNumber(number).then(function(devices) {
                return Promise.all(devices.map(function(device) {
                    return textsecure.protocol_wrapper.closeOpenSessionForDevice(device.encodedNumber);
                })).then(function() {
                    return res;
                });
            });
        });
    }

    self.sendMessageToGroup = function(groupId, messageText, attachments, timestamp) {
        var proto = new textsecure.protobuf.DataMessage();
        proto.body = messageText;
        proto.group = new textsecure.protobuf.GroupContext();
        proto.group.id = toArrayBuffer(groupId);
        proto.group.type = textsecure.protobuf.GroupContext.Type.DELIVER;

        return textsecure.storage.groups.getNumbers(groupId).then(function(numbers) {
            if (numbers === undefined)
                return new Promise(function(resolve, reject) { reject(new Error("Unknown Group")); });

            var promises = [];
            for (var i in attachments)
                promises.push(makeAttachmentPointer(attachments[i]));
            return Promise.all(promises).then(function(attachmentsArray) {
                proto.attachments = attachmentsArray;
                return sendGroupProto(numbers, proto, timestamp);
            });
        });
    }

    self.createGroup = function(numbers, name, avatar) {
        var proto = new textsecure.protobuf.DataMessage();
        proto.group = new textsecure.protobuf.GroupContext();

        return textsecure.storage.groups.createNewGroup(numbers).then(function(group) {
            proto.group.id = toArrayBuffer(group.id);
            var numbers = group.numbers;

            proto.group.type = textsecure.protobuf.GroupContext.Type.UPDATE;
            proto.group.members = numbers;
            proto.group.name = name;

            if (avatar !== undefined) {
                return makeAttachmentPointer(avatar).then(function(attachment) {
                    proto.group.avatar = attachment;
                    return sendGroupProto(numbers, proto).then(function() {
                        return proto.group.id;
                    });
                });
            } else {
                return sendGroupProto(numbers, proto).then(function() {
                    return proto.group.id;
                });
            }
        });
    }

    self.updateGroup = function(groupId, name, avatar, numbers) {
        var proto = new textsecure.protobuf.DataMessage();
        proto.group = new textsecure.protobuf.GroupContext();

        proto.group.id = toArrayBuffer(groupId);
        proto.group.type = textsecure.protobuf.GroupContext.Type.UPDATE;
        proto.group.name = name;

        return textsecure.storage.groups.addNumbers(groupId, numbers).then(function(numbers) {
            if (numbers === undefined) {
                return new Promise(function(resolve, reject) { reject(new Error("Unknown Group")); });
            }
            proto.group.members = numbers;

            if (avatar !== undefined) {
                return makeAttachmentPointer(avatar).then(function(attachment) {
                    proto.group.avatar = attachment;
                    return sendGroupProto(numbers, proto).then(function() {
                        return proto.group.id;
                    });
                });
            } else {
                return sendGroupProto(numbers, proto).then(function() {
                    return proto.group.id;
                });
            }
        });
    }

    self.addNumberToGroup = function(groupId, number) {
        var proto = new textsecure.protobuf.DataMessage();
        proto.group = new textsecure.protobuf.GroupContext();
        proto.group.id = toArrayBuffer(groupId);
        proto.group.type = textsecure.protobuf.GroupContext.Type.UPDATE;

        return textsecure.storage.groups.addNumbers(groupId, [number]).then(function(numbers) {
            if (numbers === undefined)
                return new Promise(function(resolve, reject) { reject(new Error("Unknown Group")); });
            proto.group.members = numbers;

            return sendGroupProto(numbers, proto);
        });
    }

    self.setGroupName = function(groupId, name) {
        var proto = new textsecure.protobuf.DataMessage();
        proto.group = new textsecure.protobuf.GroupContext();
        proto.group.id = toArrayBuffer(groupId);
        proto.group.type = textsecure.protobuf.GroupContext.Type.UPDATE;
        proto.group.name = name;

        return textsecure.storage.groups.getNumbers(groupId).then(function(numbers) {
            if (numbers === undefined)
                return new Promise(function(resolve, reject) { reject(new Error("Unknown Group")); });
            proto.group.members = numbers;

            return sendGroupProto(numbers, proto);
        });
    }

    self.setGroupAvatar = function(groupId, avatar) {
        var proto = new textsecure.protobuf.DataMessage();
        proto.group = new textsecure.protobuf.GroupContext();
        proto.group.id = toArrayBuffer(groupId);
        proto.group.type = textsecure.protobuf.GroupContext.Type.UPDATE;

        return textsecure.storage.groups.getNumbers(groupId).then(function(numbers) {
            if (numbers === undefined)
                return new Promise(function(resolve, reject) { reject(new Error("Unknown Group")); });
            proto.group.members = numbers;

            return makeAttachmentPointer(avatar).then(function(attachment) {
                proto.group.avatar = attachment;
                return sendGroupProto(numbers, proto);
            });
        });
    }

    self.leaveGroup = function(groupId) {
        var proto = new textsecure.protobuf.DataMessage();
        proto.group = new textsecure.protobuf.GroupContext();
        proto.group.id = toArrayBuffer(groupId);
        proto.group.type = textsecure.protobuf.GroupContext.Type.QUIT;

        return textsecure.storage.groups.getNumbers(groupId).then(function(numbers) {
            if (numbers === undefined)
                return new Promise(function(resolve, reject) { reject(new Error("Unknown Group")); });
            return textsecure.storage.groups.deleteGroup(groupId).then(function() {
                return sendGroupProto(numbers, proto);
            });
        });
    }

    return self;
}();
