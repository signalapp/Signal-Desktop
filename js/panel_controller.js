/*global $, Whisper, Backbone, extension*/
/*
 * vim: ts=4:sw=4:expandtab
 */

// This script should only be included in background.html
(function () {
    'use strict';

    window.Whisper = window.Whisper || {};

    window.isOpen = function() {
        return true;
    };

    window.clearAttention = function() {
        if (window.keepClear) {
            clearInterval(window.keepClear);
            delete window.keepClear;
        }
        window.keepClear = setInterval(function() {
            extension.windows.clearAttention(inboxWindowId);
        }, 2000);
    };
    var inboxWindowId = 'inbox';

})();
