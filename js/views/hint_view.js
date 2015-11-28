/*
 * vim: ts=4:sw=4:expandtab
 */
(function () {
    'use strict';
    window.Whisper = window.Whisper || {};

    Whisper.HintView = Whisper.View.extend({
        templateName: 'hint',
        initialize: function(options) {
            this.content = options.content;
        },
        render_attributes: function() {
            return { content: this.content };
        }
    });
})();
