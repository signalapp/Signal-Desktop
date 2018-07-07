/* global Whisper, i18n */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  Whisper.IdentityKeySendErrorPanelView = Whisper.View.extend({
    className: 'identity-key-send-error panel',
    templateName: 'identity-key-send-error',
    initialize(options) {
      this.listenBack = options.listenBack;
      this.resetPanel = options.resetPanel;

      this.wasUnverified = this.model.isUnverified();
      this.listenTo(this.model, 'change', this.render);
    },
    events: {
      'click .show-safety-number': 'showSafetyNumber',
      'click .send-anyway': 'sendAnyway',
      'click .cancel': 'cancel',
    },
    showSafetyNumber() {
      const view = new Whisper.KeyVerificationPanelView({
        model: this.model,
      });
      this.listenBack(view);
    },
    sendAnyway() {
      this.resetPanel();
      this.trigger('send-anyway');
    },
    cancel() {
      this.resetPanel();
    },
    render_attributes() {
      let send = i18n('sendAnyway');
      if (this.wasUnverified && !this.model.isUnverified()) {
        send = i18n('resend');
      }

      const errorExplanation = i18n('identityKeyErrorOnSend', [
        this.model.getTitle(),
        this.model.getTitle(),
      ]);
      return {
        errorExplanation,
        showSafetyNumber: i18n('showSafetyNumber'),
        sendAnyway: send,
        cancel: i18n('cancel'),
      };
    },
  });
})();
