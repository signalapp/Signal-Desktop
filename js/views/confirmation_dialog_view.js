/*
 * vim: ts=4:sw=4:expandtab
 */
(function () {
    'use strict';
    window.Whisper = window.Whisper || {};

    Whisper.ConfirmationDialogView = Whisper.View.extend({
        className: 'confirmation-dialog modal',
        templateName: 'confirmation-dialog',
        initialize: function(options) {
            this.message = options.message;
            this.resolve = options.resolve;
            this.reject = options.reject;
            this.render();
        },
        events: {
          'click .ok': 'ok',
          'click .cancel': 'cancel',
        },
        render_attributes: function() {
            return {
                message: this.message,
                cancel: i18n('cancel'),
                ok: i18n('ok')
            };
        },
        ok: function() {
          this.remove();
          this.resolve();
        },
        cancel: function() {
          this.remove();
          this.reject();
        }
    });
})();
