/*
 * vim: ts=4:sw=4:expandtab
 */
(function () {
    'use strict';
    window.Whisper = window.Whisper || {};
    storage.isMuted = function(number) {
        return storage.get('muted', []).indexOf(number) >= 0;
    };
})();
