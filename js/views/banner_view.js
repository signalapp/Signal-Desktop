/*
 * vim: ts=4:sw=4:expandtab
 */
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
    initialize: function(options) {
      this.message = options.message;
      this.callbacks = {
        onDismiss: options.onDismiss,
        onClick: options.onClick,
      };
      this.render();
    },
    render_attributes: function() {
      return {
        message: this.message,
      };
    },
    onDismiss: function(e) {
      this.callbacks.onDismiss();
      e.stopPropagation();
    },
    onClick: function() {
      this.callbacks.onClick();
    },
  });
})();
