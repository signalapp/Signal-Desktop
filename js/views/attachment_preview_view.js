/*
 * vim: ts=4:sw=4:expandtab
 */
(function () {
    'use strict';
    window.Whisper = window.Whisper || {};

    Whisper.AttachmentPreviewView = Whisper.View.extend({
        className: 'attachment-preview',
        templateName: 'attachment-preview',
        render_attributes: function() {
            return {source: this.src};
        }
    });
})();
