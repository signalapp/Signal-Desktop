/*global $, Whisper, Backbone, textsecure, extension*/
/*
 * vim: ts=4:sw=4:expandtab
 */
(function () {
    'use strict';

    function logError(error) {
        extension.windows.getBackground(function(bg) {
            bg.console.log('index.html: ', error);
        });
    }

    window.onerror = function(message, script, line, col, error) {
        logError(error);
    };

    function render() {
        extension.windows.getBackground(function(bg) {

            var inboxPromise = bg.initLoading.done(function(owsDesktopApp) {
                owsDesktopApp.getAppView(window).then(function(appView) {
                    var bodyEl = document.getElementById('signal-container');
                    bodyEl.innerHTML = "";
                    bodyEl.append(appView.el);
                });
            });
        });
    }

    window.addEventListener('onreload', render);
    render();
}());
