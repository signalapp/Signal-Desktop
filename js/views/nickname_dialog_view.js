/* global Whisper, i18n, _ */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  Whisper.NicknameDialogView = Whisper.View.extend({
    className: 'nickname-dialog modal',
    templateName: 'nickname-dialog',
    initialize(options) {
      this.message = options.message;
      this.name = options.name;

      this.resolve = options.resolve;
      this.okText = options.okText || i18n('ok');

      this.reject = options.reject;
      this.cancelText = options.cancelText || i18n('cancel');

      this.clear = options.clear;
      this.clearText = options.clearText || i18n('clear');

      this.title = options.title;

      this.render();

      this.$input = this.$('input');
      this.validateNickname();
    },
    events: {
      keyup: 'onKeyup',
      'click .ok': 'ok',
      'click .cancel': 'cancel',
      'click .clear': 'clear',
      change: 'validateNickname',
    },
    isValidNickname(name) {
      return (name || '').length < 20;
    },
    validateNickname() {
      const nickname = this.$input.val();

      if (_.isEmpty(nickname)) {
        this.$('.clear').hide();
      } else {
        this.$('.clear').show();
      }

      if (this.isValidNickname(nickname)) {
        this.$('.content').removeClass('invalid');
        this.$('.content').addClass('valid');
        this.$('.ok').show();
      } else {
        this.$('.content').removeClass('valid');
        this.$('.ok').hide();
      }
    },
    render_attributes() {
      return {
        name: this.name,
        message: this.message,
        showCancel: !this.hideCancel,
        cancel: this.cancelText,
        ok: this.okText,
        clear: this.clearText,
        title: this.title,
      };
    },
    ok() {
      const nickname = this.$input.val();
      if (!this.isValidNickname(nickname)) return;

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
    clear() {
      this.$input.val('').trigger('change');
    },
    onKeyup(event) {
      if (event.key === 'Escape' || event.key === 'Esc') {
        this.cancel();
        return;
      }

      this.validateNickname();
    },
    focusCancel() {
      this.$('.cancel').focus();
    },
  });
})();
