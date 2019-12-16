/* global Whisper, $ */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  Whisper.SessionToastView = Whisper.View.extend({
    initialize(options) {
      this.props = {
        el: $('#session-toast-container'),
        title: options.title,
        description: options.description,
        fadeToast: this.fadeToast.bind(this),
        closeToast: this.closeToast.bind(this),
      };
    },

    render() {
      this.toastView = new Whisper.ReactWrapperView({
        className: 'session-toast-wrapper',
        Component: window.Signal.Components.SessionToast,
        props: this.props,
      });

      this.$el.append(this.toastView.el);
    },

    update(options) {
      this.props.title = options.title;
      this.props.description = options.description ? options.description : '';
      this.props.type = options.type ? options.type : '';
      this.props.id = options.id ? options.id : '';

      this.toastView.update(this.props);

      this.showToast();
      clearTimeout(this.timer);
      this.timer = setTimeout(this.fadeToast.bind(this), 4000);
    },

    showToast() {
      this.toastView.$el.show();
    },

    fadeToast() {
      this.toastView.$el.fadeOut(500, () => {
        this.removeToast();
      });
    },

    closeToast() {
      this.toastView.$el.fadeOut(125, () => {
        this.removeToast();
      });
    },

    removeToast() {
      this.toastView.remove();

      if (this.props.id) {
        delete window.toasts[this.props.id];
      }
    },
  });
})();
