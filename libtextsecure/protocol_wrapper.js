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
        startWorker: function() {
            protocolInstance.startWorker('/js/libsignal-protocol-worker.js');
        },
        stopWorker: function() {
            protocolInstance.stopWorker();
        },
        createIdentityKeyRecvSocket: function() {
            return protocolInstance.createIdentityKeyRecvSocket();
        }
    };
})();
