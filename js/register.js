/*
 * vim: ts=4:sw=4:expandtab
 */
;(function() {
    'use strict';
    extension.windows.getBackground(function(bg) {
        var accountManager = new bg.getAccountManager();

        function log(s) {
            console.log(s);
            $('#status').text(s);
        }

        function validateCode() {
            var verificationCode = $('#code').val().replace(/\D/g, '');
            if (verificationCode.length == 6) {
                return verificationCode;
            }
        }

        function displayError(error) {
            $('#error').hide().text(error).addClass('in').fadeIn();
        }

        var phoneView = new Whisper.PhoneInputView({el: $('#phone-number-input')});
        phoneView.$el.find('input.number').intlTelInput();

        var number = bg.textsecure.storage.user.getNumber();
        if (number) {
            $('input.number').val(number);
        }

        $('input.number').on('validation', function() {
            if ($('#number-container').hasClass('valid')) {
                $('#request-sms, #request-voice').removeAttr('disabled');
            } else {
                $('#request-sms, #request-voice').prop('disabled', 'disabled');
            }
        });

        $('#code').on('change', function() {
            if (!validateCode()) {
                $('#code').addClass('invalid');
            } else {
                $('#code').removeClass('invalid');
            }
        });

        $('#request-voice').click(function() {
            $('#error').hide();
            var number = phoneView.validateNumber();
            if (number) {
                accountManager.requestVoiceVerification(number).catch(displayError);
                $('#step2').addClass('in').fadeIn();
            } else {
                $('#number-container').addClass('invalid');
            }
        });

        $('#request-sms').click(function() {
            $('#error').hide();
            var number = phoneView.validateNumber();
            if (number) {
                accountManager.requestSMSVerification(number).catch(displayError);
                $('#step2').addClass('in').fadeIn();
            } else {
                $('#number-container').addClass('invalid');
            }
        });

        $('#form').submit(function(e) {
            e.preventDefault();
            var number = phoneView.validateNumber();
            var verificationCode = $('#code').val().replace(/\D+/g, "");

            bg.storage.put('first_install_ran', 1);
            accountManager.registerSingleDevice(number, verificationCode).then(function() {
                bg.openInbox();
                window.close();
            }).catch(function(e) {
                log(e);
            });
        });
    });

})();
