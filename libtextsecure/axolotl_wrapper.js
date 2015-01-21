//TODO: Remove almost everything here...

'use strict';

;(function() {
    window.axolotl = window.axolotl || {};
    window.axolotl.api = {
        getMyRegistrationId: function() {
            return textsecure.storage.getUnencrypted("registrationId");
        },
        storage: {
            put: function(key, value) {
                return textsecure.storage.putEncrypted(key, value);
            },
            get: function(key, defaultValue) {
                return textsecure.storage.getEncrypted(key, defaultValue);
            },
            remove: function(key) {
                return textsecure.storage.removeEncrypted(key);
            },

            identityKeys: {
                get: function(identifier) {
                    return textsecure.storage.devices.getIdentityKeyForNumber(textsecure.utils.unencodeNumber(identifier)[0]);
                },
                put: function(identifier, identityKey) {
                    return textsecure.storage.devices.checkSaveIdentityKeyForNumber(textsecure.utils.unencodeNumber(identifier)[0], identityKey);
                },
            },

            sessions: {
                get: function(identifier) {
                    var device = textsecure.storage.devices.getDeviceObject(identifier, true);
                    if (device === undefined || device.sessions === undefined)
                        return undefined;
                    var record = new axolotl.sessions.RecipientRecord();
                    record.deserialize(device.sessions);
                    if (getString(device.identityKey) !== getString(record.identityKey))
                        throw new Error("Got mismatched identity key on sessions load");
                    return record;
                },
                put: function(identifier, record) {
                    var device = textsecure.storage.devices.getDeviceObject(identifier);
                    if (device === undefined) {
                        device = { encodedNumber: identifier,
                                   //TODO: Remove this duplication (esp registrationId?)
                                   identityKey: record.identityKey,
                                   registrationId: record.registrationId
                                 };
                    }
                    if (getString(device.identityKey) !== getString(record.identityKey))
                        throw new Error("Tried to put session for device with changed identity key");
                    device.sessions = record.serialize();
                    return textsecure.storage.devices.saveDeviceObject(device);
                }
            }
        },
        updateKeys: function(keys) {
            return textsecure.api.registerKeys(keys).catch(function(e) {
                //TODO: Notify the user somehow?
                console.error(e);
            });
        },
    };

    var decodeMessageContents = function(res) {
        var finalMessage = textsecure.protobuf.PushMessageContent.decode(res[0]);

        if ((finalMessage.flags & textsecure.protobuf.PushMessageContent.Flags.END_SESSION)
                == textsecure.protobuf.PushMessageContent.Flags.END_SESSION)
            res[1]();

        return finalMessage;
    }

    var decodeDeviceContents = function(res) {
        var finalMessage = textsecure.protobuf.DeviceControl.decode(res[0]);

        //TODO: Add END_SESSION flag for device control messages
        /*if ((finalMessage.flags & textsecure.protobuf.PushMessageContent.Flags.END_SESSION)
                == textsecure.protobuf.PushMessageContent.Flags.END_SESSION)
            res[1]();*/

        return finalMessage;
    }

    window.textsecure = window.textsecure || {};
    window.textsecure.protocol_wrapper = {
        handleIncomingPushMessageProto: function(proto) {
            switch(proto.type) {
            case textsecure.protobuf.IncomingPushMessageSignal.Type.PLAINTEXT:
                return Promise.resolve(textsecure.protobuf.PushMessageContent.decode(proto.message));
            case textsecure.protobuf.IncomingPushMessageSignal.Type.CIPHERTEXT:
                var from = proto.source + "." + (proto.sourceDevice == null ? 0 : proto.sourceDevice);
                return axolotl.protocol.decryptWhisperMessage(from, getString(proto.message)).then(decodeMessageContents);
            case textsecure.protobuf.IncomingPushMessageSignal.Type.PREKEY_BUNDLE:
                if (proto.message.readUint8() != ((3 << 4) | 3))
                    throw new Error("Bad version byte");
                var from = proto.source + "." + (proto.sourceDevice == null ? 0 : proto.sourceDevice);
                return axolotl.protocol.handlePreKeyWhisperMessage(from, getString(proto.message)).then(decodeMessageContents);
            case textsecure.protobuf.IncomingPushMessageSignal.Type.RECEIPT:
                return Promise.resolve(null);
            case textsecure.protobuf.IncomingPushMessageSignal.Type.PREKEY_BUNDLE_DEVICE_CONTROL:
                if (proto.message.readUint8() != ((3 << 4) | 3))
                    throw new Error("Bad version byte");
                var from = proto.source + "." + (proto.sourceDevice == null ? 0 : proto.sourceDevice);
                return axolotl.protocol.handlePreKeyWhisperMessage(from, getString(proto.message)).then(decodeDeviceContents);
            case textsecure.protobuf.IncomingPushMessageSignal.Type.DEVICE_CONTROL:
                var from = proto.source + "." + (proto.sourceDevice == null ? 0 : proto.sourceDevice);
                return axolotl.protocol.decryptWhisperMessage(from, getString(proto.message)).then(decodeDeviceContents);
            default:
                return new Promise(function(resolve, reject) { reject(new Error("Unknown message type")); });
            }
        }
    };

    var wipeIdentityAndTryMessageAgain = function(from, encodedMessage, message_id) {
        // Wipe identity key!
        //TODO: Encapsuate with the rest of textsecure.storage.devices
        textsecure.storage.removeEncrypted("devices" + from.split('.')[0]);
        //TODO: Probably breaks with a devicecontrol message
        return axolotl.protocol.handlePreKeyWhisperMessage(from, encodedMessage).then(decodeMessageContents).then(
            function(pushMessageContent) {
                extension.trigger('message:decrypted', {
                    message_id : message_id,
                    data       : pushMessageContent
                });
            }
        );
    }
    textsecure.replay.registerFunction(wipeIdentityAndTryMessageAgain, textsecure.replay.Type.INIT_SESSION);
})();
