/*
 * vim: ts=4:sw=4:expandtab
 */
function OutgoingMessage(server, timestamp, numbers, message, callback) {
    if (message instanceof textsecure.protobuf.DataMessage) {
        var content = new textsecure.protobuf.Content();
        content.dataMessage = message;
        message = content;
    }
    this.server = server;
    this.timestamp = timestamp;
    this.numbers = numbers;
    this.message = message; // ContentMessage proto
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
            this.callback({successfulNumbers: this.successfulNumbers, errors: this.errors});
        }
    },
    registerError: function(number, reason, error) {
        if (!error || error.name === 'HTTPError' && error.code !== 404) {
            error = new textsecure.OutgoingMessageError(number, this.message.toArrayBuffer(), this.timestamp, error);
        }

        error.number = number;
        error.reason = reason;
        this.errors[this.errors.length] = error;
        this.numberCompleted();
    },
    reloadDevicesAndSend: function(number, recurse) {
        return function() {
            return textsecure.storage.protocol.getDeviceIds(number).then(function(deviceIds) {
                if (deviceIds.length == 0) {
                    return this.registerError(number, "Got empty device list when loading device keys", null);
                }
                return this.doSendMessage(number, deviceIds, recurse);
            }.bind(this));
        }.bind(this);
    },

    getKeysForNumber: function(number, updateDevices) {
        var handleResult = function(response) {
            return Promise.all(response.devices.map(function(device) {
                device.identityKey = response.identityKey;
                if (updateDevices === undefined || updateDevices.indexOf(device.deviceId) > -1) {
                    var address = new libsignal.SignalProtocolAddress(number, device.deviceId);
                    var builder = new libsignal.SessionBuilder(textsecure.storage.protocol, address);
                    if (device.registrationId === 0) {
                        console.log("device registrationId 0!");
                    }
                    return builder.processPreKey(device).catch(function(error) {
                        if (error.message === "Identity key changed") {
                            error.timestamp = this.timestamp;
                            error.originalMessage = this.message.toArrayBuffer();
                            error.identityKey = device.identityKey;
                        }
                        throw error;
                    }.bind(this));
                }
            }.bind(this)));
        }.bind(this);

        if (updateDevices === undefined) {
            return this.server.getKeysForNumber(number).then(handleResult);
        } else {
            var promise = Promise.resolve();
            updateDevices.forEach(function(device) {
                promise = promise.then(function() {
                    return this.server.getKeysForNumber(number, device).then(handleResult).catch(function(e) {
                        if (e.name === 'HTTPError' && e.code === 404) {
                            if (device !== 1) {
                                return this.removeDeviceIdsForNumber(number, [device]);
                            } else {
                                throw new textsecure.UnregisteredUserError(number, e);
                            }
                        } else {
                            throw e;
                        }
                    }.bind(this));
                }.bind(this));
            }.bind(this));

            return promise;
        }
    },

    transmitMessage: function(number, jsonData, timestamp) {
        return this.server.sendMessages(number, jsonData, timestamp).catch(function(e) {
            if (e.name === 'HTTPError' && (e.code !== 409 && e.code !== 410)) {
                // 409 and 410 should bubble and be handled by doSendMessage
                // 404 should throw UnregisteredUserError
                // all other network errors can be retried later.
                if (e.code === 404) {
                    throw new textsecure.UnregisteredUserError(number, e);
                }
                throw new textsecure.SendMessageNetworkError(number, jsonData, e, timestamp);
            }
            throw e;
        });
    },

    getPaddedMessageLength: function(messageLength) {
        var messageLengthWithTerminator = messageLength + 1;
        var messagePartCount            = Math.floor(messageLengthWithTerminator / 160);

        if (messageLengthWithTerminator % 160 !== 0) {
            messagePartCount++;
        }

        return messagePartCount * 160;
    },

    getPlaintext: function() {
        if (!this.plaintext) {
            var messageBuffer = this.message.toArrayBuffer();
            this.plaintext = new Uint8Array(
                this.getPaddedMessageLength(messageBuffer.byteLength + 1) - 1
            );
            this.plaintext.set(new Uint8Array(messageBuffer));
            this.plaintext[messageBuffer.byteLength] = 0x80;
        }
        return this.plaintext;
    },

    doSendMessage: function(number, deviceIds, recurse) {
        var ciphers = {};
        var plaintext = this.getPlaintext();

        return Promise.all(deviceIds.map(function(deviceId) {
            var address = new libsignal.SignalProtocolAddress(number, deviceId);

            var ourNumber = textsecure.storage.user.getNumber();
            var number = address.toString().split('.')[0];
            var options = {};

            // No limit on message keys if we're communicating with our other devices
            if (ourNumber === number) {
                options.messageKeysLimit = false;
            }

            var sessionCipher = new libsignal.SessionCipher(textsecure.storage.protocol, address, options);
            ciphers[address.getDeviceId()] = sessionCipher;
            return sessionCipher.encrypt(plaintext).then(function(ciphertext) {
                return {
                    type                      : ciphertext.type,
                    destinationDeviceId       : address.getDeviceId(),
                    destinationRegistrationId : ciphertext.registrationId,
                    content                   : btoa(ciphertext.body)
                };
            });
        }.bind(this))).then(function(jsonData) {
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
                    p = this.removeDeviceIdsForNumber(number, error.response.extraDevices);
                } else {
                    p = Promise.all(error.response.staleDevices.map(function(deviceId) {
                        return ciphers[deviceId].closeOpenSessionForDevice();
                    }));
                }

                return p.then(function() {
                    var resetDevices = ((error.code == 410) ? error.response.staleDevices : error.response.missingDevices);
                    return this.getKeysForNumber(number, resetDevices)
                        .then(this.reloadDevicesAndSend(number, error.code == 409));
                }.bind(this));
            } else if (error.message === "Identity key changed") {
                error.timestamp = this.timestamp;
                error.originalMessage = this.message.toArrayBuffer();
                console.log('Got "key changed" error from encrypt - no identityKey for application layer', number, deviceIds)
                throw error;
            } else {
                this.registerError(number, "Failed to create or send message", error);
            }
        }.bind(this));
    },

    getStaleDeviceIdsForNumber: function(number) {
        return textsecure.storage.protocol.getDeviceIds(number).then(function(deviceIds) {
            if (deviceIds.length === 0) {
                return [1];
            }
            var updateDevices = [];
            return Promise.all(deviceIds.map(function(deviceId) {
                var address = new libsignal.SignalProtocolAddress(number, deviceId);
                var sessionCipher = new libsignal.SessionCipher(textsecure.storage.protocol, address);
                return sessionCipher.hasOpenSession().then(function(hasSession) {
                    if (!hasSession) {
                        updateDevices.push(deviceId);
                    }
                });
            })).then(function() {
                return updateDevices;
            });
        });
    },

    removeDeviceIdsForNumber: function(number, deviceIdsToRemove) {
        var promise = Promise.resolve();
        for (var j in deviceIdsToRemove) {
            promise = promise.then(function() {
                var encodedNumber = number + "." + deviceIdsToRemove[j];
                return textsecure.storage.protocol.removeSession(encodedNumber);
            });
        }
        return promise;
    },

    sendToNumber: function(number) {
        return this.getStaleDeviceIdsForNumber(number).then(function(updateDevices) {
            return this.getKeysForNumber(number, updateDevices)
                .then(this.reloadDevicesAndSend(number, true))
                .catch(function(error) {
                    if (error.message === "Identity key changed") {
                        error = new textsecure.OutgoingIdentityKeyError(
                            number, error.originalMessage, error.timestamp, error.identityKey
                        );
                        this.registerError(number, "Identity key changed", error);
                    } else {
                        this.registerError(
                            number, "Failed to retrieve new device keys for number " + number, error
                        );
                    }
                }.bind(this));
        }.bind(this));
    }
};
