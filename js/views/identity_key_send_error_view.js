/*
 * vim: ts=4:sw=4:expandtab
 */
(function () {
    'use strict';
    window.Whisper = window.Whisper || {};

    Whisper.IdentityKeySendErrorPanelView = Whisper.View.extend({
        className: 'identity-key-send-error panel',
        templateName: 'identity-key-send-error',
        initialize: function(options) {
            this.listenBack = options.listenBack;
            this.resetPanel = options.resetPanel;

            this.wasUnverified = this.model.isUnverified();
            this.listenTo(this.model, 'change', this.render);
        },
        events: {
            'click .show-safety-number': 'showSafetyNumber',
            'click .send-anyway': 'sendAnyway',
            'click .cancel': 'cancel'
        },
        showSafetyNumber: function() {
            var view = new Whisper.KeyVerificationPanelView({
                model: this.model
            });
            this.listenBack(view);
        },
        sendAnyway: function() {
            this.resetPanel();
            this.trigger('send-anyway');
        },
        cancel: function() {
            this.resetPanel();
        },
        render_attributes: function() {
            var send = i18n('sendAnyway');
            if (this.wasUnverified && !this.model.isUnverified()) {
                send = i18n('resend');
            }

            var errorExplanation = i18n('identityKeyErrorOnSend', [this.model.getTitle(), this.model.getTitle()]);
            return {
                errorExplanation : errorExplanation,
                showSafetyNumber : i18n('showSafetyNumber'),
                sendAnyway       : send,
                cancel           : i18n('cancel')
            };
        }
    });
})();
