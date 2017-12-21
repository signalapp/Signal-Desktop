/*
 * vim: ts=4:sw=4:expandtab
 */
(function () {
    'use strict';
    // Browser specific functions for Chrom*
    window.extension = window.extension || {};

    extension.windows = {
        onClosed: function(callback) {
            window.addEventListener('beforeunload', callback);
        }
    };

    window.addEventListener('keypress', function(e) {
        var isInput = ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName);
        var isModalOpen = document.querySelector('body > div > .modal');
        var sendMessageElement = document.querySelector('textarea.send-message');

        if (!isInput && !isModalOpen && sendMessageElement) {
            sendMessageElement.focus();
        }
    });
}());
