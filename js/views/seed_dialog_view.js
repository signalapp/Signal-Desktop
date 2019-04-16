/* global Whisper, i18n, Signal, passwordUtil */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  Whisper.SeedDialogView = Whisper.View.extend({
    className: 'loki-dialog seed-dialog modal',
    templateName: 'seed-dialog',
    initialize(options = {}) {
      this.okText = options.okText || i18n('ok');
      this.cancelText = options.cancelText || i18n('cancel');
      this.confirmText = options.confirmText || i18n('confirm');
      this.copyText = options.copyText || i18n('copySeed');
      this.seed = options.seed || '-';

      this.render();
      this.showSeedView(false);
      this.initPasswordHash();

      this.$('#password').bind('keyup', event => this.onKeyup(event));
    },
    events: {
      'click .ok': 'close',
      'click .confirm': 'confirmPassword',
      'click .copy-seed': 'copySeed',
    },
    render_attributes() {
      return {
        passwordViewTitle: i18n('passwordViewTitle'),
        seedViewTitle: i18n('seedViewTitle'),
        ok: this.okText,
        copyText: this.copyText,
        confirm: this.confirmText,
        cancel: this.cancelText,
      };
    },
    async initPasswordHash() {
      const hash = await Signal.Data.getPasswordHash();
      this.passwordHash = hash;
      this.showSeedView(!hash);
    },
    showSeedView(show) {
      const seedView = this.$('.seedView');
      const passwordView = this.$('.passwordView');
      if (show) {
        this.$('.seed').html(this.seed);
        seedView.show();
        passwordView.hide();
      } else {
        this.$('.seed').html('');
        passwordView.show();
        this.$('#password').focus();
        seedView.hide();
      }
    },
    confirmPassword() {
      this.$('.error').html();
      const password = this.$('#password').val();
      if (
        this.passwordHash &&
        !passwordUtil.matchesHash(password, this.passwordHash)
      ) {
        this.$('.error').html(`Error: ${i18n('invalidPassword')}`);
        return;
      }

      this.showSeedView(true);
    },
    close() {
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
          this.confirmPassword();
          break;
        case 'Escape':
        case 'Esc':
          this.close();
          break;
        default:
          break;
      }
    },
  });
})();
