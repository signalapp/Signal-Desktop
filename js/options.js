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
    function validateNumber() {
        try {
            var regionCode = $('#regionCode').val();
            var number     = $('#number').val();

            var parsedNumber = libphonenumber.util.verifyNumber(number, regionCode);

            $('#regionCode').val(libphonenumber.util.getRegionCodeForNumber(parsedNumber));
            $('#number-container').removeClass('invalid');
            $('#number-container').addClass('valid');
            $('#request-sms, #request-voice').removeAttr('disabled');
            return parsedNumber;
        } catch(e) {
            $('#number-container').removeClass('valid');
            $('#request-sms, #request-voice').prop('disabled', 'disabled');
        }
    };

    function validateCode() {
        var verificationCode = $('#code').val().replace(/\D/g, '');
        if (verificationCode.length == 6) {
            return verificationCode;
        }
    };

    function displayError(error) {
        $('#error').hide().text(error).addClass('in').fadeIn();
    };

    $(function() {
        if (isRegistrationDone()) {
            $('#complete-number').text(textsecure.utils.unencodeNumber(textsecure.storage.getUnencrypted("number_id"))[0]);//TODO: no
            $('#setup-complete').show().addClass('in');
        } else {
            $('#choose-setup').show().addClass('in');
            $('#number').keyup(validateNumber);
            $('#regionCode').change(validateNumber);

            $.each(libphonenumber.util.getAllRegionCodes(), function (regionCode, countryName) {
                $('#regionCode').append(
                    $('<option>', { value: regionCode, text: countryName })
                );
            });

            $('#code').on('change', function() {
                if (!validateCode())
                    $('#code').addClass('invalid');
                else
                    $('#code').removeClass('invalid');
            });

            $('#request-voice').click(function() {
                var number = validateNumber();
                if (number) {
                    textsecure.api.requestVerificationVoice(number).catch(displayError);
                    $('#step2').addClass('in').fadeIn();
                } else {
                    $('#number-container').addClass('invalid');
                }
            });

            $('#request-sms').click(function() {
                var number = validateNumber();
                if (number) {
                    textsecure.api.requestVerificationSMS(number).catch(displayError);
                    $('#step2').addClass('in').fadeIn();
                } else {
                    $('#number-container').addClass('invalid');
                }
            });

            $('#new-account').click(function(){
                $('#choose-setup').fadeOut(function() {
                    $('#single-device').addClass('in').fadeIn();
                });

                $('#single-device .back').click(function() {
                    $('#single-device').fadeOut(function() {
                        $('#choose-setup').addClass('in').fadeIn();
                        $('#number').removeClass('invalid');
                    });
                });

                $('#single-device form').submit(function(e) {
                    e.preventDefault();
                    $('#error').hide();
                    var number = validateNumber();
                    var verificationCode = validateCode();
                    if (number && verificationCode) {
                        $('#verify1').hide();
                        $('#verify2done').text('');
                        $('#verify3done').text('');
                        $('#verify4done').text('');
                        $('#verify5').hide();
                        $('#verify').show().addClass('in');

                        textsecure.registerSingleDevice(number, verificationCode, function(step) {
                            switch(step) {
                            case 1:
                                $('#verify2done').text('done');
                                break;
                            case 2:
                                $('#verify3done').text('done');
                                break;
                            case 3:
                                $('#complete-number').text(number);
                                $('#verify').hide();
                                $('#setup-complete').show().addClass('in');
                                registrationDone();
                            }
                        }).catch(function(error) {
                            //TODO: No alerts...
                            if (error.humanError)
                                displayError(error.humanError);
                            else
                                displayError(error); //XXX
                        });
                    }
                });
            });

            $('#new-device').click(function(){
                $('#choose-setup').fadeOut(function() {
                    $('#multi-device').addClass('in').fadeIn();
                });

                $('#multi-device .back').click(function() {
                    $('#multi-device').fadeOut(function() {
                        $('#choose-setup').addClass('in').fadeIn();
                        $('#number').removeClass('invalid');
                    });
                });

                $('#multi-device .status').text("Connecting...");
                $('#setup-qr').html('');
                textsecure.protocol.prepareTempWebsocket().then(function(cryptoInfo) {
                    var qrCode = new QRCode(document.getElementById('setup-qr'));
                    var socket = textsecure.api.getTempWebsocket();

                    socket.onmessage = function(message) {
                        if (message.uuid) {
                            qrCode.makeCode('textsecure-device-init:/' +
                                            '?channel_uuid=' + message.uuid +
                                            '&channel_server=' + textsecure.api.relay +
                                            '&publicKey=' + btoa(getString(cryptoInfo.publicKey)));
                            $('img').removeAttr('style');
                            $('#multi-device .status').text("Use your phone to scan the QR code.")
                        } else {
                            $('#init-setup').hide();
                            $('#verify1done').text('');
                            $('#verify2done').text('');
                            $('#verify3done').text('');
                            $('#verify4done').text('');
                            $('#verify5done').text('');
                            $('#verify').show().addClass('in');


                            textsecure.registerSecondDevice(cryptoInfo, message.message, function(step) {
                                switch(step) {
                                case 1:
                                    $('#verify1done').text('done');
                                    break;
                                case 2:
                                    $('#verify2done').text('done');
                                    break;
                                case 3:
                                    $('#verify3done').text('done');
                                    break;
                                case 4:
                                    //TODO: User needs to verify number before we continue
                                    $('#complete-number').text(parsedNumber);
                                    $('#verify4done').text('done');
                                case 5:
                                    $('#verify').hide();
                                    $('#setup-complete').show().addClass('in');
                                    registrationDone();
                                }
                            });
                        }
                    };

                    socket.ondisconnect = function() {
                        $('#multi-device .status').text("The push server disconnected, please wait while we reconnect...");
                    };
                });
            });
        }
    });
})();
