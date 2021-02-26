// Copyright 2017-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* global Whisper, $ */

// eslint-disable-next-line func-names
(function () {
  window.Whisper = window.Whisper || {};

  Whisper.BannerView = Whisper.View.extend({
    className: 'banner',
    template: () => $('#banner').html(),
    events: {
      'click .dismiss': 'onDismiss',
      'click .body': 'onClick',
    },
    initialize(options) {
      this.message = options.message;
      this.callbacks = {
        onDismiss: options.onDismiss,
        onClick: options.onClick,
      };
      this.render();
    },
    render_attributes() {
      return {
        message: this.message,
      };
    },
    onDismiss(e) {
      this.callbacks.onDismiss();
      e.stopPropagation();
    },
    onClick() {
      this.callbacks.onClick();
    },
  });
})();
