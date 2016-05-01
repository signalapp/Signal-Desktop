/*
 * vim: ts=4:sw=4:expandtab
 */
;(function() {
    'use strict';
    window.textsecure = window.textsecure || {};
    window.textsecure.storage = window.textsecure.storage || {};

    textsecure.storage.protocol = new SignalProtocolStore();
    var protocolInstance = libsignal.protocol(textsecure.storage.protocol);

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
