/*
 * vim: ts=4:sw=4:expandtab
 */
(function () {
    'use strict';
    window.Whisper = window.Whisper || {};

    Whisper.WindowControlsView = Whisper.View.extend({
        tagName: 'span',
        className: 'window-controls',
        template: $('#window-controls').html(),
        initialize: function(options) {
            this.appWindow = options.appWindow;
            this.render();
        },
        events: {
            'click .close': 'close',
            'click .minimize': 'minimize'
        },
        close: function() {
            this.appWindow.close();
        },
        minimize: function() {
          this.appWindow.minimize();
        }
    });
})();
