/* global Whisper, i18n */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  Whisper.SeedDialogView = Whisper.View.extend({
    className: 'loki-dialog seed-dialog modal',
    templateName: 'seed-dialog',
    initialize(options = {}) {
      this.okText = options.okText || i18n('ok');
      this.copyText = options.copyText || i18n('copySeed');
      this.seed = options.seed || '-';

      this.render();
    },
    events: {
      keyup: 'onKeyup',
      'click .ok': 'ok',
      'click .copy-seed': 'copySeed',
    },
    render_attributes() {
      return {
        seed: this.seed,
        ok: this.okText,
        copyText: this.copyText,
      };
    },
    ok() {
      this.remove();
    },
    copySeed() {
      window.clipboard.writeText(this.seed);

      const toast = new Whisper.MessageToastView({
        message: i18n('copiedMnemonic'),
      });
      toast.$el.appendTo(this.$el);
      toast.render();
    },
    onKeyup(event) {
      switch (event.key) {
        case 'Enter':
        case 'Escape':
        case 'Esc':
          this.ok();
          break;
        default:
          return;
      }
      event.preventDefault();
    },
  });
})();
