/* global Whisper, $, getAccountManager, textsecure */

/* eslint-disable more/no-then */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  Whisper.StandaloneRegistrationView = Whisper.View.extend({
    templateName: 'standalone',
    className: 'full-screen-flow',
    initialize() {
      this.accountManager = getAccountManager();

      this.render();

      const number = textsecure.storage.user.getNumber();
      if (number) {
        this.$('input.number').val(number);
      }
      this.phoneView = new Whisper.PhoneInputView({
        el: this.$('#phone-number-input'),
      });
      this.$('#error').hide();
    },
    events: {
      'validation input.number': 'onValidation',
      'click #request-voice': 'requestVoice',
      'click #request-sms': 'requestSMSVerification',
      'change #code': 'onChangeCode',
      'click #register': 'register',
      'click #register-mnemonic': 'registerWithMnemonic',
      'change #mnemonic': 'onChangeMnemonic',
    },
    register() {
      this.accountManager
        .registerSingleDevice(this.$('#mnemonic').val())
        .then(() => {
          this.$el.trigger('openInbox');
        })
        .catch(this.log.bind(this));
    },
    registerWithMnemonic() {
      const words = this.$('#mnemonic').val();
      if (!words) {
        this.log('Please provide a mnemonic word list');
      } else {
        this.register();
      }
    },
    onChangeMnemonic() {
      this.$('#status').html('');
    },
    log(s) {
      window.log.info(s);
      this.$('#status').text(s);
    },
    displayError(error) {
      this.$('#error')
        .hide()
        .text(error)
        .addClass('in')
        .fadeIn();
    },
    onValidation() {
      if (this.$('#number-container').hasClass('valid')) {
        this.$('#request-sms, #request-voice').removeAttr('disabled');
      } else {
        this.$('#request-sms, #request-voice').prop('disabled', 'disabled');
      }
    },
    onChangeCode() {
      if (!this.validateCode()) {
        this.$('#code').addClass('invalid');
      } else {
        this.$('#code').removeClass('invalid');
      }
    },
    requestVoice() {
      window.removeSetupMenuItems();
      this.$('#error').hide();
      const number = this.phoneView.validateNumber();
      if (number) {
        this.accountManager
          .requestVoiceVerification(number)
          .catch(this.displayError.bind(this));
        this.$('#step2')
          .addClass('in')
          .fadeIn();
      } else {
        this.$('#number-container').addClass('invalid');
      }
    },
    requestSMSVerification() {
      window.removeSetupMenuItems();
      $('#error').hide();
      const number = this.phoneView.validateNumber();
      if (number) {
        this.accountManager
          .requestSMSVerification(number)
          .catch(this.displayError.bind(this));
        this.$('#step2')
          .addClass('in')
          .fadeIn();
      } else {
        this.$('#number-container').addClass('invalid');
      }
    },
  });
})();
