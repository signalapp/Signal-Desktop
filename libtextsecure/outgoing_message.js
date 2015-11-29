/*
 * vim: ts=4:sw=4:expandtab
 */
function OutgoingMessage(server, timestamp, numbers, message, callback) {
    this.server = server;
    this.timestamp = timestamp;
    this.numbers = numbers;
    this.message = message; // DataMessage or ContentMessage proto
    this.callback = callback;
    this.legacy = (message instanceof textsecure.protobuf.DataMessage);

    this.numbersCompleted = 0;
    this.errors = [];
    this.successfulNumbers = [];
}

OutgoingMessage.prototype = {
    constructor: OutgoingMessage,
    numberCompleted: function() {
        this.numbersCompleted++;
        if (this.numbersCompleted >= this.numbers.length) {
            this.callback({successfulNumbers: this.successfulNumbers, errors: this.errors});
        }
    },
    registerError: function(number, reason, error) {
        if (!error || error.name === 'HTTPError') {
            error = new textsecure.OutgoingMessageError(number, this.message.toArrayBuffer(), this.timestamp, error);
        }

        error.number = number;
        error.reason = reason;
        this.errors[this.errors.length] = error;
        this.numberCompleted();
    },
    reloadDevicesAndSend: function(number, recurse) {
        return function() {
            return textsecure.storage.devices.getDeviceObjectsForNumber(number).then(function(devicesForNumber) {
                if (devicesForNumber.length == 0) {
                    return this.registerError(number, "Got empty device list when loading device keys", null);
                }
                var relay = devicesForNumber[0].relay;
                for (var i=1; i < devicesForNumber.length; ++i) {
                    if (devicesForNumber[i].relay !== relay) {
                        throw new Error("Mismatched relays for number " + number);
                    }
                }
                return this.doSendMessage(number, devicesForNumber, recurse);
            }.bind(this));
        }.bind(this);
    },

    getKeysForNumber: function(number, updateDevices) {
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
                            error = new textsecure.OutgoingIdentityKeyError(number, this.message.toArrayBuffer(), this.timestamp, error.identityKey);
                            this.registerError(number, "Identity key changed", error);
                        }
                        throw error;
                    }.bind(this));
            }.bind(this)));
        }.bind(this);

        if (updateDevices === undefined) {
            return this.server.getKeysForNumber(number).then(handleResult);
        } else {
            var promise = Promise.resolve();
            updateDevices.forEach(function(device) {
                promise = promise.then(function() {
                    return this.server.getKeysForNumber(number, device).then(handleResult);
                }.bind(this));
            }.bind(this));

            return promise;
        }
    },

    transmitMessage: function(number, jsonData, timestamp) {
        return this.server.sendMessages(number, jsonData, timestamp).catch(function(e) {
            if (e.name === 'HTTPError' && (e.code !== 409 && e.code !== 410)) {
                // 409 and 410 should bubble and be handled by doSendMessage
                // all other network errors can be retried later.
                throw new textsecure.SendMessageNetworkError(number, jsonData, e, timestamp);
            }
            throw e;
        });
    },

    doSendMessage: function(number, devicesForNumber, recurse) {
        return this.encryptToDevices(devicesForNumber).then(function(jsonData) {
            return this.transmitMessage(number, jsonData, this.timestamp).then(function() {
                this.successfulNumbers[this.successfulNumbers.length] = number;
                this.numberCompleted();
            }.bind(this));
        }.bind(this)).catch(function(error) {
            if (error instanceof Error && error.name == "HTTPError" && (error.code == 410 || error.code == 409)) {
                if (!recurse)
                    return this.registerError(number, "Hit retry limit attempting to reload device list", error);

                var p;
                if (error.code == 409) {
                    p = textsecure.storage.devices.removeDeviceIdsForNumber(number, error.response.extraDevices);
                } else {
                    p = Promise.all(error.response.staleDevices.map(function(deviceId) {
                        return textsecure.protocol_wrapper.closeOpenSessionForDevice(number + '.' + deviceId);
                    }));
                }

                return p.then(function() {
                    var resetDevices = ((error.code == 410) ? error.response.staleDevices : error.response.missingDevices);
                    return this.getKeysForNumber(number, resetDevices)
                        .then(this.reloadDevicesAndSend(number, (error.code == 409)))
                        .catch(function(error) {
                            this.registerError(number, "Failed to reload device keys", error);
                        }.bind(this));
                }.bind(this));
            } else {
                this.registerError(number, "Failed to create or send message", error);
            }
        }.bind(this));
    },

    encryptToDevices: function(deviceObjectList) {
        var plaintext = this.message.toArrayBuffer();
        return Promise.all(deviceObjectList.map(function(device) {
            return textsecure.protocol_wrapper.encryptMessageFor(device, plaintext).then(function(encryptedMsg) {
                var json = this.toJSON(device, encryptedMsg);
                return textsecure.storage.devices.removeTempKeysFromDevice(device.encodedNumber).then(function() {
                    return json;
                });
            }.bind(this));
        }.bind(this)));
    },

    toJSON: function(device, encryptedMsg) {
        var json = {
            type: encryptedMsg.type,
            destinationDeviceId: textsecure.utils.unencodeNumber(device.encodedNumber)[1],
            destinationRegistrationId: device.registrationId
        };

        if (device.relay !== undefined) {
            json.relay = device.relay;
        }

        var content = btoa(encryptedMsg.body);
        if (this.legacy) {
            json.body = content;
        } else {
            json.content = content;
        }

        return json;
    },

    sendToNumber: function(number) {
        return textsecure.storage.devices.getStaleDeviceIdsForNumber(number).then(function(updateDevices) {
            return this.getKeysForNumber(number, updateDevices)
                .then(this.reloadDevicesAndSend(number, true))
                .catch(function(error) {
                    this.registerError(number, "Failed to retreive new device keys for number " + number, error);
                }.bind(this));
        }.bind(this));
    }
};
