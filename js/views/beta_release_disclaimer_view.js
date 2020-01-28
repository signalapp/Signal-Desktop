/* global Whisper, window */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  Whisper.BetaReleaseDisclaimer = Whisper.View.extend({
    className: 'loki-dialog beta-disclaimer-dialog modal',
    initialize() {
      this.close = this.close.bind(this);
      this.render();
    },

    render() {
      this.dialogView = new Whisper.ReactWrapperView({
        className: 'session-beta-disclaimer',
        Component: window.Signal.Components.SessionConfirm,
        props: {
          title: window.i18n('betaDisclaimerTitle'),
          message: window.i18n('betaDisclaimerSubtitle'),
          messageSub: window.i18n('betaDisclaimerDescription'),
          hideCancel: true,
          onClickOk: this.close,
        },
      });

      this.$el.append(this.dialogView.el);
      return this;
    },

    close() {
      window.storage.put('betaReleaseDisclaimerAccepted', true);
      this.remove();
    },
  });
})();
