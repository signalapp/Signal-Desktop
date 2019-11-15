/* global Whisper, i18n, _, displayNameRegex */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  Whisper.NicknameDialogView = Whisper.View.extend({
    className: 'loki-dialog nickname-dialog modal',
    templateName: 'nickname-dialog',
    initialize(options) {
      this.message = options.message;
      this.name = options.name || '';

      this.resolve = options.resolve;
      this.okText = options.okText || i18n('ok');

      this.reject = options.reject;
      this.cancelText = options.cancelText || i18n('cancel');

      this.title = options.title;

      this.render();

      this.$input = this.$('input');
      this.$input.val(this.name);
      this.$input.focus();

      this.validateNickname();

      const sanitiseNameInput = () => {
        const oldVal = this.$input.val();
        this.$input.val(oldVal.replace(displayNameRegex, ''));
      };

      this.$input[0].oninput = () => {
        sanitiseNameInput();
      };

      this.$input[0].onpaste = () => {
        // Sanitise data immediately after paste because it's easier
        setTimeout(() => {
          sanitiseNameInput();
        });
      };
    },
    events: {
      keyup: 'onKeyup',
      'click .ok': 'ok',
      'click .cancel': 'cancel',
      change: 'validateNickname',
    },
    validateNickname() {
      const nickname = this.$input.val();

      if (_.isEmpty(nickname)) {
        this.$('.ok').attr('disabled', 'disabled');
        return false;
      }
      this.$('.ok').removeAttr('disabled');
      return true;
    },
    render_attributes() {
      return {
        message: this.message,
        showCancel: !this.hideCancel,
        cancel: this.cancelText,
        ok: this.okText,
        title: this.title,
      };
    },
    ok() {
      const nickname = this.$input.val().trim();

      this.remove();
      if (this.resolve) {
        this.resolve(nickname);
      }
    },
    cancel() {
      this.remove();
      if (this.reject) {
        this.reject();
      }
    },
    onKeyup(event) {
      const valid = this.validateNickname();
      switch (event.key) {
        case 'Enter':
          if (valid) {
            this.ok();
          }
          break;
        case 'Escape':
        case 'Esc':
          this.cancel();
          break;
        default:
          return;
      }
      event.preventDefault();
    },
    focusInput() {
      this.$input.focus();
    },
  });
})();
