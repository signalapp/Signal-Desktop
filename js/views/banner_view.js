/* global Whisper */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  Whisper.BannerView = Whisper.View.extend({
    className: 'banner',
    templateName: 'banner',
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
