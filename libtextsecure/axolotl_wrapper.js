;(function() {
    'use strict';
    window.textsecure = window.textsecure || {};
    window.textsecure.storage = window.textsecure.storage || {};
    textsecure.storage.axolotl = new AxolotlStore();
    var axolotlInstance = axolotl.protocol(textsecure.storage.axolotl);

    window.textsecure = window.textsecure || {};
    window.textsecure.protocol_wrapper = {
        decrypt: function(source, sourceDevice, type, blob) {
            if (sourceDevice === null) { sourceDevice = 0; }
            var fromAddress = [source, sourceDevice].join('.');
            switch(type) {
            case textsecure.protobuf.Envelope.Type.CIPHERTEXT:
                return axolotlInstance.decryptWhisperMessage(fromAddress, getString(blob));
            case textsecure.protobuf.Envelope.Type.PREKEY_BUNDLE:
                if (blob.readUint8() != ((3 << 4) | 3))
                    throw new Error("Bad version byte");
                var blob = blob.toArrayBuffer();
                return axolotlInstance.handlePreKeyWhisperMessage(fromAddress, blob).catch(function(e) {
                    if (e.message === 'Unknown identity key') {
                        // create an error that the UI will pick up and ask the
                        // user if they want to re-negotiate
                        throw new textsecure.IncomingIdentityKeyError(fromAddress, blob, e.identityKey);
                    }
                    throw e;
                });
            default:
                return new Promise.reject(new Error("Unknown message type"));
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
        return axolotlInstance.handlePreKeyWhisperMessage(from, encodedMessage).then(function(res) {
            var finalMessage = textsecure.protobuf.DataMessage.decode(res[0]);

            if ((finalMessage.flags & textsecure.protobuf.DataMessage.Flags.END_SESSION)
                    == textsecure.protobuf.DataMessage.Flags.END_SESSION &&
                    finalMessage.sync !== null)
                res[1]();

            return processDecrypted(finalMessage);
        });
    };

    textsecure.replay.registerFunction(tryMessageAgain, textsecure.replay.Type.INIT_SESSION);

})();
