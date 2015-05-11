/* vim: ts=4:sw=4
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

;(function() {
    'use strict';
    extension.windows.getBackground(function(bg) {
        var accountManager = new bg.textsecure.AccountManager();

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
            if (!validateCode())
                $('#code').addClass('invalid');
            else
                $('#code').removeClass('invalid');
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

            localStorage.clear();
            localStorage.setItem('first_install_ran', 1);
            accountManager.registerSingleDevice(number, verificationCode).then(function() {
                extension.navigator.tabs.create("options.html");
                window.close();
            }).catch(function(e) {
                log(e);
            });
        });
    });

})();
