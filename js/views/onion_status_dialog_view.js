/* global i18n, Whisper */

// eslint-disable-next-line func-names
(function() {
    'use strict';
  
    window.Whisper = window.Whisper || {};
  
    Whisper.OnionStatusDialogView = Whisper.View.extend({
      className: 'loki-dialog modal',
      initialize({ theme }) {
        this.close = this.close.bind(this);
  
        this.theme = theme;
  
        this.$el.focus();
        this.render();
      },
      render() {
        this.dialogView = new Whisper.ReactWrapperView({
          className: 'onion-status-dialog',
          Component: window.Signal.Components.OnionStatusDialog,
          props: {
            onClose: this.close,
            i18n,
            theme: this.theme,
          },
        });
  
        this.$el.append(this.dialogView.el);
        return this;
      },
      close() {
        this.remove();
      },
    });
  })();
  