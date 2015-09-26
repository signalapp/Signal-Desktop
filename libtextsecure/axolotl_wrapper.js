/*
 * vim: ts=4:sw=4:expandtab
 */
;(function() {
    'use strict';
    window.textsecure = window.textsecure || {};
    window.textsecure.storage = window.textsecure.storage || {};

    textsecure.storage.axolotl = new AxolotlStore();
    var axolotlInstance = axolotl.protocol(textsecure.storage.axolotl);

    window.textsecure = window.textsecure || {};
    window.textsecure.protocol_wrapper = {
        decryptWhisperMessage: function(fromAddress, blob) {
            return axolotlInstance.decryptWhisperMessage(fromAddress, getString(blob));
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
        },
        handlePreKeyWhisperMessage: function(from, blob) {
            blob.mark();
            if (blob.readUint8() != ((3 << 4) | 3)) {
                throw new Error("Bad version byte");
            }
            return axolotlInstance.handlePreKeyWhisperMessage(from, blob.toArrayBuffer()).catch(function(e) {
                if (e.message === 'Unknown identity key') {
                    blob.reset(); // restore the version byte.

                    // create an error that the UI will pick up and ask the
                    // user if they want to re-negotiate
                    throw new textsecure.IncomingIdentityKeyError(from, blob.toArrayBuffer(), e.identityKey);
                }
                throw e;
            });
        }
    };
})();
