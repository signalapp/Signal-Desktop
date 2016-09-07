/*
 * vim: ts=4:sw=4:expandtab
 */
(function () {
    'use strict';
    window.Whisper = window.Whisper || {};
    storage.isBlocked = function(number) {
        return storage.get('blocked', []).indexOf(number) >= 0;
    };
})();
