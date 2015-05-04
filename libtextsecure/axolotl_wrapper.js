;(function() {
    'use strict';
    window.textsecure = window.textsecure || {};
    window.textsecure.storage = window.textsecure.storage || {};
    textsecure.storage.axolotl = new AxolotlStore();
    var axolotlInstance = axolotl.protocol(textsecure.storage.axolotl);

    var decodeMessageContents = function(res) {
        var finalMessage = textsecure.protobuf.PushMessageContent.decode(res[0]);

        if ((finalMessage.flags & textsecure.protobuf.PushMessageContent.Flags.END_SESSION)
                == textsecure.protobuf.PushMessageContent.Flags.END_SESSION &&
                finalMessage.sync !== null)
            res[1]();

        return finalMessage;
    };

    var handlePreKeyWhisperMessage = function(from, message) {
        try {
            return axolotlInstance.handlePreKeyWhisperMessage(from, message);
        } catch(e) {
            if (e.message === 'Unknown identity key') {
                // create an error that the UI will pick up and ask the
                // user if they want to re-negotiate
                throw new textsecure.IncomingIdentityKeyError(from, message);
            }
            throw e;
        }
    };

    window.textsecure = window.textsecure || {};
    window.textsecure.protocol_wrapper = {
        handleIncomingPushMessageProto: function(proto) {
            switch(proto.type) {
            case textsecure.protobuf.IncomingPushMessageSignal.Type.PLAINTEXT:
                return Promise.resolve(textsecure.protobuf.PushMessageContent.decode(proto.message));
            case textsecure.protobuf.IncomingPushMessageSignal.Type.CIPHERTEXT:
                var from = proto.source + "." + (proto.sourceDevice == null ? 0 : proto.sourceDevice);
                return axolotlInstance.decryptWhisperMessage(from, getString(proto.message)).then(decodeMessageContents);
            case textsecure.protobuf.IncomingPushMessageSignal.Type.PREKEY_BUNDLE:
                if (proto.message.readUint8() != ((3 << 4) | 3))
                    throw new Error("Bad version byte");
                var from = proto.source + "." + (proto.sourceDevice == null ? 0 : proto.sourceDevice);
                return handlePreKeyWhisperMessage(from, getString(proto.message)).then(decodeMessageContents);
            case textsecure.protobuf.IncomingPushMessageSignal.Type.RECEIPT:
                return Promise.resolve(null);
            default:
                return new Promise(function(resolve, reject) { reject(new Error("Unknown message type")); });
            }
        },
        closeOpenSessionForDevice: function(encodedNumber) {
            return axolotlInstance.closeOpenSessionForDevice(encodedNumber)
        },
        encryptMessageFor: function(deviceObject, pushMessageContent) {
            return axolotlInstance.encryptMessageFor(deviceObject, pushMessageContent);
        },
        startWorker: function() {
            axolotlInstance.startWorker('/js/libaxolotl-worker.js');
        },
        stopWorker: function() {
            axolotlInstance.stopWorker();
        },
        createIdentityKeyRecvSocket: function() {
            return axolotlInstance.createIdentityKeyRecvSocket();
        },
        hasOpenSession: function(encodedNumber) {
            return axolotlInstance.hasOpenSession(encodedNumber);
        },
        getRegistrationId: function(encodedNumber) {
            return axolotlInstance.getRegistrationId(encodedNumber);
        }
    };

    var tryMessageAgain = function(from, encodedMessage) {
        return axolotlInstance.handlePreKeyWhisperMessage(from, encodedMessage).then(decodeMessageContents);
    }
    textsecure.replay.registerFunction(tryMessageAgain, textsecure.replay.Type.INIT_SESSION);

})();
