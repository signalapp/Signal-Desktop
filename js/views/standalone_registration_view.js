(function() {
  'use strict';
  window.Whisper = window.Whisper || {};

  Whisper.StandaloneRegistrationView = Whisper.View.extend({
    templateName: 'standalone',
    className: 'full-screen-flow',
    initialize: function() {
      this.accountManager = getAccountManager();

      this.render();

      var number = textsecure.storage.user.getNumber();
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
      'click #verifyCode': 'verifyCode',
    },
    verifyCode: function(e) {
      var number = this.phoneView.validateNumber();
      var verificationCode = $('#code')
        .val()
        .replace(/\D+/g, '');

      this.accountManager
        .registerSingleDevice(number, verificationCode)
        .then(
          function() {
            this.$el.trigger('openInbox');
          }.bind(this)
        )
        .catch(this.log.bind(this));
    },
    log: function(s) {
      console.log(s);
      this.$('#status').text(s);
    },
    validateCode: function() {
      var verificationCode = $('#code')
        .val()
        .replace(/\D/g, '');
      if (verificationCode.length == 6) {
        return verificationCode;
      }
    },
    displayError: function(error) {
      this.$('#error')
        .hide()
        .text(error)
        .addClass('in')
        .fadeIn();
    },
    onValidation: function() {
      if (this.$('#number-container').hasClass('valid')) {
        this.$('#request-sms, #request-voice').removeAttr('disabled');
      } else {
        this.$('#request-sms, #request-voice').prop('disabled', 'disabled');
      }
    },
    onChangeCode: function() {
      if (!this.validateCode()) {
        this.$('#code').addClass('invalid');
      } else {
        this.$('#code').removeClass('invalid');
      }
    },
    requestVoice: function() {
      window.removeSetupMenuItems();
      this.$('#error').hide();
      var number = this.phoneView.validateNumber();
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
    requestSMSVerification: function() {
      window.removeSetupMenuItems();
      $('#error').hide();
      var number = this.phoneView.validateNumber();
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
