/*
 * vim: ts=4:sw=4:expandtab
 */
(function () {
    'use strict';

    window.Whisper = window.Whisper || {};

    Whisper.EndSessionView = Whisper.View.extend({
        tagName:   "div",
        className: "end-session",
        templateName: 'message',
        render_attributes: function() {
            return { text: 'Secure session ended' };
        }
    });

})();
