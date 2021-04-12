// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* global Whisper, Signal, $ */

// eslint-disable-next-line func-names
(function () {
  window.Whisper = window.Whisper || {};

  Whisper.SafetyNumberChangeDialogView = Whisper.View.extend({
    template: () => $('#safety-number-change-dialog').html(),
    initialize(options) {
      const dialog = new Whisper.ReactWrapperView({
        Component: window.Signal.Components.SafetyNumberChangeDialog,
        props: {
          confirmText: options.confirmText,
          contacts: options.contacts.map(contact => contact.format()),
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
