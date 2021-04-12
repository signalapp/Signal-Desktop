// Copyright 2015-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

window.Whisper = window.Whisper || {};

window.Whisper.ToastView = window.Whisper.View.extend({
  className: 'toast',
  template: () => $('#toast').html(),
  initialize() {
    this.$el.hide();
    this.timeout = 2000;
  },

  close() {
    this.$el.fadeOut(this.remove.bind(this));
  },

  render() {
    this.$el.html(
      window.Mustache.render(
        window._.result(this, 'template', ''),
        window._.result(this, 'render_attributes', '')
      )
    );
    this.$el.attr('tabIndex', 0);
    this.$el.show();
    setTimeout(this.close.bind(this), this.timeout);
  },
});

window.Whisper.ToastView.show = (View, el) => {
  const toast = new View();
  toast.$el.appendTo(el);
  toast.render();
};
