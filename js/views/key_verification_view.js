// Copyright 2015-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* global Backbone, Signal, Whisper, $ */

// eslint-disable-next-line func-names
(function () {
  window.Whisper = window.Whisper || {};

  Whisper.KeyVerificationPanelView = Whisper.View.extend({
    className: 'panel',
    template: () => $('#key-verification').html(),
    initialize(options) {
      this.render();

      this.view = new Whisper.ReactWrapperView({
        JSX: Signal.State.Roots.createSafetyNumberViewer(window.reduxStore, {
          contactID: options.model.get('id'),
        }),
        onInitialRender: () => {
          if (options.onLoad) {
            options.onLoad(this);
          }
        },
      });

      this.$('.key-verification-wrapper').append(this.view.el);
    },

    remove() {
      if (this.view) {
        this.view.remove();
      }
      Backbone.View.prototype.remove.call(this);
    },
  });
})();
