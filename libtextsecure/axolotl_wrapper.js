//TODO: Remove almost everything here...

'use strict';

;(function() {
    window.axolotl = window.axolotl || {};
    window.axolotl.api = {
        getMyIdentifier: function() {
            return textsecure.utils.unencodeNumber(textsecure.storage.getUnencrypted("number_id"))[0];
        },
        isIdentifierSane: function(identifier) {
            return textsecure.utils.isNumberSane(identifier);
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
        },
    };

    window.textsecure = window.textsecure || {};
    window.textsecure.protocol_wrapper = {
        handleIncomingPushMessageProto: function(proto) {
            var decodeContents = function(res) {
                var finalMessage = textsecure.protobuf.PushMessageContent.decode(res[0]);

                //TODO
                /*if ((finalMessage.flags & textsecure.protobuf.PushMessageContent.Flags.END_SESSION)
                        == textsecure.protobuf.PushMessageContent.Flags.END_SESSION)
                    textsecure.protocol.closeSession(res[1], true);*/

                return finalMessage;
            }

            switch(proto.type) {
            case textsecure.protobuf.IncomingPushMessageSignal.Type.PLAINTEXT:
                return Promise.resolve(textsecure.protobuf.PushMessageContent.decode(proto.message));
            case textsecure.protobuf.IncomingPushMessageSignal.Type.CIPHERTEXT:
                var from = proto.source + "." + (proto.sourceDevice == null ? 0 : proto.sourceDevice);
                return textsecure.protocol.decryptWhisperMessage(from, getString(proto.message)).then(decodeContents);
            case textsecure.protobuf.IncomingPushMessageSignal.Type.PREKEY_BUNDLE:
                if (proto.message.readUint8() != ((3 << 4) | 3))
                    throw new Error("Bad version byte");
                var from = proto.source + "." + (proto.sourceDevice == null ? 0 : proto.sourceDevice);
                return textsecure.protocol.handlePreKeyWhisperMessage(from, getString(proto.message)).then(decodeContents);
            case textsecure.protobuf.IncomingPushMessageSignal.Type.RECEIPT:
                return Promise.resolve(null);
            case textsecure.protobuf.IncomingPushMessageSignal.Type.PREKEY_BUNDLE_DEVICE_CONTROL:
                if (proto.message.readUint8() != ((3 << 4) | 3))
                    throw new Error("Bad version byte");
                var from = proto.source + "." + (proto.sourceDevice == null ? 0 : proto.sourceDevice);
                return textsecure.protocol.handlePreKeyWhisperMessage(from, getString(proto.message)).then(function(res) {
                    return textsecure.protobuf.DeviceControl.decode(res[0]);
                });
            case textsecure.protobuf.IncomingPushMessageSignal.Type.DEVICE_CONTROL:
                var from = proto.source + "." + (proto.sourceDevice == null ? 0 : proto.sourceDevice);
                return textsecure.protocol.decryptWhisperMessage(from, getString(proto.message)).then(function(res) {
                    return textsecure.protobuf.DeviceControl.decode(res[0]);
                });
            default:
                return new Promise(function(resolve, reject) { reject(new Error("Unknown message type")); });
            }
        }
    };
})();
