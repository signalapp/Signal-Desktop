/*
 * vim: ts=4:sw=4:expandtab
 */
;(function() {
    'use strict';
    window.textsecure = window.textsecure || {};
    window.textsecure.storage = window.textsecure.storage || {};

    textsecure.storage.protocol = new SignalProtocolStore();
    var protocolInstance = libsignal.protocol(textsecure.storage.protocol);

    /*
     * jobQueue manages multiple queues indexed by device to serialize
     * session io ops on the database.
     */
    var jobQueue = {};
    function queueJobForNumber(number, runJob) {
        var runPrevious = jobQueue[number] || Promise.resolve();
        var runCurrent = jobQueue[number] = runPrevious.then(runJob, runJob);
        runCurrent.then(function() {
            if (jobQueue[number] === runCurrent) {
                delete jobQueue[number];
            }
        });

        return runCurrent;
    }

    window.textsecure = window.textsecure || {};
    window.textsecure.protocol_wrapper = {
        closeOpenSessionForDevice: function(encodedNumber) {
            return queueJobForNumber(encodedNumber, function() {
                return protocolInstance.closeOpenSessionForDevice(encodedNumber);
            });
        },
        startWorker: function() {
            protocolInstance.startWorker('/js/libsignal-protocol-worker.js');
        },
        stopWorker: function() {
            protocolInstance.stopWorker();
        },
        createIdentityKeyRecvSocket: function() {
            return protocolInstance.createIdentityKeyRecvSocket();
        },
        hasOpenSession: function(encodedNumber) {
            return queueJobForNumber(encodedNumber, function() {
                return protocolInstance.hasOpenSession(encodedNumber);
            });
        },
        handlePreKeyWhisperMessage: function(from, blob) {
            console.log('prekey whisper message');
            blob.mark();
            var version = blob.readUint8();
            if ((version & 0xF) > 3 || (version >> 4) < 3) {
                // min version > 3 or max version < 3
                throw new Error("Incompatible version byte");
            }
            return queueJobForNumber(from, function() {
                var address = libsignal.SignalProtocolAddress.fromString(from);
                var sessionCipher = new libsignal.SessionCipher(textsecure.storage.protocol, address);
                return sessionCipher.decryptPreKeyWhisperMessage(blob).catch(function(e) {
                    if (e.message === 'Unknown identity key') {
                        blob.reset(); // restore the version byte.

                        // create an error that the UI will pick up and ask the
                        // user if they want to re-negotiate
                        throw new textsecure.IncomingIdentityKeyError(from, blob.toArrayBuffer(), e.identityKey);
                    }
                    throw e;
                });
            });
        }
    };
})();
