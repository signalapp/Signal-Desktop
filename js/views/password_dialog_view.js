/* global Whisper, i18n, _, Signal, passwordUtil */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  const PasswordDialogView = Whisper.View.extend({
    className: 'loki-dialog password-dialog modal',
    templateName: 'password-dialog',
    initialize(options) {
      this.type = options.type;
      this.resolve = options.resolve;
      this.okText = options.okText || i18n('ok');

      this.reject = options.reject;
      this.cancelText = options.cancelText || i18n('cancel');

      this.title = options.title;

      this.render();
      this.updateUI();
    },
    events: {
      keyup: 'onKeyup',
      'click .ok': 'ok',
      'click .cancel': 'cancel',
    },
    render_attributes() {
      return {
        showCancel: !this.hideCancel,
        cancel: this.cancelText,
        ok: this.okText,
        title: this.title,
      };
    },
    async updateUI() {
      if (this.disableOkButton()) {
        this.$('.ok').prop('disabled', true);
      } else {
        this.$('.ok').prop('disabled', false);
      }
    },
    disableOkButton() {
      const password = this.$('#password').val();
      return _.isEmpty(password);
    },
    async validate() {
      const password = this.$('#password').val();
      const passwordConfirmation = this.$('#password-confirmation').val();

      const pairValidation = this.validatePasswordPair(password, passwordConfirmation);
      const hashValidation = await this.validatePasswordHash(password);

      return (pairValidation || hashValidation);
    },
    async validatePasswordHash(password) {
      // Check if the password matches the hash we have stored
      const hash = await Signal.Data.getPasswordHash();
      if (hash && !passwordUtil.matchesHash(password, hash)) {
        return i18n('invalidPassword');
      }
      return null;
    },
    validatePasswordPair(password, passwordConfirmation) {
      if (!_.isEmpty(password)) {

        // Check if the password is first valid
        const passwordValidation = passwordUtil.validatePassword(password, i18n);
        if (passwordValidation) {
          return passwordValidation;
        }

        // Check if the confirmation password is the same
        if (!passwordConfirmation || password.trim() !== passwordConfirmation.trim()) {
          return i18n('passwordsDoNotMatch');
        }
      }
      return null;
    },
    okPressed() {
      const password = this.$('#password').val();
      if (this.type === 'set') {
        window.setPassword(password.trim());
      } else if (this.type === 'remove') {
        window.setPassword(null, password.trim());
      }
    },
    okErrored() {
      if (this.type === 'set') {
        this.showError(i18n('setPasswordFail'));
      } else if (this.type === 'remove') {
        this.showError(i18n('removePasswordFail'));
      }
    },
    async ok() {
      const error = await this.validate();
      if (error) {
        this.showError(error);
        return;
      }

      // Clear any errors
      this.showError(null);

      try {
        this.okPressed();

        this.remove();
        if (this.resolve) {
          this.resolve();
        }
      } catch (e) {
        this.okErrored();
      }
    },
    cancel() {
      this.remove();
      if (this.reject) {
        this.reject();
      }
    },
    onKeyup(event) {
      this.updateUI();
      switch (event.key) {
        case 'Enter':
          this.ok();
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
    focusCancel() {
      this.$('.cancel').focus();
    },
    showError(message) {
      if (_.isEmpty(message)) {
        this.$('.error').text('');
        this.$('.error').hide();
      } else {
        this.$('.error').text(`Error: ${message}`);
        this.$('.error').show();
      }
    },
  });

  const ChangePasswordDialogView = PasswordDialogView.extend({
    templateName: 'password-change-dialog',
    disableOkButton() {
      const oldPassword = this.$('#old-password').val();
      const newPassword = this.$('#new-password').val();
      return _.isEmpty(oldPassword) || _.isEmpty(newPassword);
    },
    async validate() {
      const oldPassword = this.$('#old-password').val();

      // Validate the old password
      if (!_.isEmpty(oldPassword) ) {
        const oldPasswordValidation = passwordUtil.validatePassword(oldPassword, i18n);
        if (oldPasswordValidation) {
          return oldPasswordValidation;
        }
      } else {
        return i18n('typeInOldPassword');
      }

      const password = this.$('#new-password').val();
      const passwordConfirmation = this.$('#new-password-confirmation').val();

      const pairValidation = this.validatePasswordPair(password, passwordConfirmation);
      const hashValidation = await this.validatePasswordHash(oldPassword);

      return pairValidation || hashValidation;
    },
    okPressed() {
      const oldPassword = this.$('#old-password').val();
      const newPassword = this.$('#new-password').val();
      window.setPassword(newPassword.trim(), oldPassword.trim());
    },
    okErrored() {
      this.showError(i18n('changePasswordFail'));
    },
  });

  Whisper.getPasswordDialogView = (type, resolve, reject) => {

    // This is a differently styled dialog
    if (type === 'change') {
      return new ChangePasswordDialogView({
        title: i18n('changePassword'),
        okTitle: i18n('change'),
        resolve,
        reject,
      });
    }

    // Set and Remove is basically the same UI
    const title = type === 'remove' ? i18n('removePassword') : i18n('setPassword');
    const okTitle = type === 'remove' ? i18n('remove') : i18n('set');
    return new PasswordDialogView({
      title,
      okTitle,
      type,
      resolve,
      reject,
    });
  };
})();
