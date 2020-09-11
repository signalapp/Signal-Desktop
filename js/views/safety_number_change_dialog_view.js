/* global Whisper, Signal */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  Whisper.SafetyNumberChangeDialogView = Whisper.View.extend({
    templateName: 'safety-number-change-dialog',
    initialize(options) {
      const dialog = new Whisper.ReactWrapperView({
        Component: window.Signal.Components.SafetyNumberChangeDialog,
        props: {
          confirmText: options.confirmText,
          contacts: options.contacts.map(contact => contact.cachedProps),
          i18n: window.i18n,
          onCancel: () => {
            dialog.remove();
            this.remove();
            options.reject();
          },
          onConfirm: () => {
            dialog.remove();
            this.remove();
            options.resolve();
          },
          renderSafetyNumber(props) {
            return Signal.State.Roots.createSafetyNumberViewer(
              window.reduxStore,
              props
            );
          },
        },
      });

      this.$('.safety-number-change-dialog-wrapper').append(dialog.el);
    },
  });
})();
