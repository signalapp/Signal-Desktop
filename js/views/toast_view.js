/* global Whisper, Mustache, _ */

// eslint-disable-next-line func-names
(function() {
  window.Whisper = window.Whisper || {};

  Whisper.ToastView = Whisper.View.extend({
    className: 'toast',
    templateName: 'toast',
    initialize() {
      this.$el.hide();
      this.timeout = 2000;
    },

    close() {
      this.$el.fadeOut(this.remove.bind(this));
    },

    render() {
      this.$el.html(
        Mustache.render(
          _.result(this, 'template', ''),
          _.result(this, 'render_attributes', '')
        )
      );
      this.$el.attr('tabIndex', 0);
      this.$el.show();
      setTimeout(this.close.bind(this), this.timeout);
    },
  });

  Whisper.ToastView.show = (View, el) => {
    const toast = new View();
    toast.$el.appendTo(el);
    toast.render();
  };
})();
