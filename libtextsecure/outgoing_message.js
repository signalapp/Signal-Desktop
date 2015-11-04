/*
 * vim: ts=4:sw=4:expandtab
 */
function OutgoingMessage(timestamp, numbers, message, callback, messageSender) {
    this.timestamp = timestamp;
    this.numbers = numbers;
    this.message = message;
    this.sender = messageSender;
    this.server = messageSender.server;
    this.callback = callback;

    this.numbersCompleted = 0;
    this.errors = [];
    this.successfulNumbers = [];
}

OutgoingMessage.prototype = {
    constructor: OutgoingMessage,
    numberCompleted: function() {
        this.numbersCompleted++;
        if (this.numbersCompleted >= this.numbers.length) {
            this.callback({success: this.successfulNumbers, failure: this.errors});
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
                if (devicesForNumber.length == 0)
                    return this.registerError(number, "Got empty device list when loading device keys", null);
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

    doSendMessage: function(number, devicesForNumber, recurse) {
        return this.sender.encryptToDevices(this.timestamp, number, devicesForNumber, this.message).then(function(jsonData) {
            return this.sender.transmitMessage(number, jsonData).then(function() {
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

    sendToNumber: function(number) {
        return textsecure.storage.devices.getStaleDeviceIdsForNumber(number).then(function(updateDevices) {
            return this.getKeysForNumber(number, updateDevices)
                .then(this.reloadDevicesAndSend(number, true))
                .catch(function(error) {
                    this.registerError(number, "Failed to retreive new device keys for number " + number, error);
                }.bind(this));
        }.bind(this));
    },

    send: function() {
        this.numbers.forEach(function(number) {
            var sendPrevious = this.sender.pendingMessages[number] || Promise.resolve();
            var sendCurrent = this.sender.pendingMessages[number] = sendPrevious.then(function() {
                return this.sendToNumber(number);
            }.bind(this)).catch(function() {
                return this.sendToNumber(number);
            }.bind(this));
            sendCurrent.then(function() {
                if (this.sender.pendingMessages[number] === sendCurrent) {
                    delete this.sender.pendingMessages[number];
                }
            }.bind(this));
        }.bind(this));
    }
};
