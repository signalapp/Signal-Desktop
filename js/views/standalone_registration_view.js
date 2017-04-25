/*
 * vim: ts=4:sw=4:expandtab
 */
(function () {
    'use strict';
    window.Whisper = window.Whisper || {};

    Whisper.StandaloneRegistrationView = Whisper.View.extend({
        templateName: 'standalone',
        id: 'install',
        className: 'main',
        initialize: function() {
            this.accountManager = getAccountManager();

            var number = textsecure.storage.user.getNumber();
            if (number) {
                $('input.number').val(number);
            }
            this.render();
            this.phoneView = new Whisper.PhoneInputView({el: this.$('#phone-number-input')});
        },
        events: {
            'submit #form': 'submit',
            'validation input.number': 'onValidation',
            'change #code': 'onChangeCode',
            'click #request-voice': 'requestVoice',
            'click #request-sms': 'requestSMSVerification',
        },
        submit: function(e) {
            e.preventDefault();
            var number = this.phoneView.validateNumber();
            var verificationCode = $('#code').val().replace(/\D+/g, "");

            this.accountManager.registerSingleDevice(number, verificationCode).then(function() {
                this.$el.trigger('openInbox');
            }.bind(this)).catch(this.log.bind(this));
        },
        log: function (s) {
            console.log(s);
            this.$('#status').text(s);
        },
        validateCode: function() {
            var verificationCode = $('#code').val().replace(/\D/g, '');
            if (verificationCode.length == 6) {
                return verificationCode;
            }
        },
        displayError: function(error) {
            this.$('#error').hide().text(error).addClass('in').fadeIn();
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
            this.$('#error').hide();
            var number = this.phoneView.validateNumber();
            if (number) {
                this.accountManager.requestVoiceVerification(number).catch(this.displayError.bind(this));
                this.$('#step2').addClass('in').fadeIn();
            } else {
                this.$('#number-container').addClass('invalid');
            }
        },
        requestSMSVerification: function() {
            $('#error').hide();
            var number = this.phoneView.validateNumber();
            if (number) {
                this.accountManager.requestSMSVerification(number).catch(this.displayError.bind(this));
                this.$('#step2').addClass('in').fadeIn();
            } else {
                this.$('#number-container').addClass('invalid');
            }
        }
    });
})();
