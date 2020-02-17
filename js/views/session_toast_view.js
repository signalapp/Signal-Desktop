/* global Whisper */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  Whisper.SessionToastView = Whisper.View.extend({
    initialize(options) {
      this.props = {
        title: options.title,
        id: options.id,
        description: options.description,
        icon: options.icon,
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

      this.$el.prepend(this.toastView.el);
    },

    update(options) {
      this.props.title = options.title;
      this.props.id = options.id;
      this.props.description = options.description || '';
      this.props.type = options.type || '';
      this.props.icon = options.icon || '';
      this.props.shouldFade = options.shouldFade !== false;

      this.toastView.update(this.props);

      this.showToast();

      if (this.timer) {
        clearTimeout(this.timer);
      }
      if (this.props.shouldFade) {
        this.timer = setTimeout(this.fadeToast.bind(this), 4000);
      }
    },

    showToast() {
      this.toastView.$el.show();
    },

    fadeToast() {
      this.removeToast();
      this.toastView.$el.fadeOut(500, () => {
        this.toastView.remove();
      });
    },

    closeToast() {
      this.removeToast();
      this.toastView.$el.fadeOut(125, () => {
        this.toastView.remove();
      });
    },

    removeToast() {
      if (this.props.id) {
        window.toasts.delete(this.props.id);
      }
    },
  });
})();
