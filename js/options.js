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
        var phoneView = new Whisper.PhoneInputView({el: $('#phone-number-input')});
        if (textsecure.registration.isDone()) {
            $('#complete-number').text(textsecure.utils.unencodeNumber(textsecure.storage.getUnencrypted("number_id"))[0]);//TODO: no
            $('#setup-complete').show().addClass('in');
        } else {
            $('#choose-setup').show().addClass('in');

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
                    textsecure.api.requestVerificationVoice(number).catch(displayError);
                    $('#step2').addClass('in').fadeIn();
                } else {
                    $('#number-container').addClass('invalid');
                }
            });

            $('#request-sms').click(function() {
                $('#error').hide();
                var number = phoneView.validateNumber();
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
                        $('input.number').removeClass('invalid');
                    });
                });

                $('#single-device form').submit(function(e) {
                    e.preventDefault();
                    $('#error').hide();
                    var number = phoneView.validateNumber();
                    var verificationCode = validateCode();
                    if (number && verificationCode) {
                        $('#verifyCode').prop('disabled', 'disabled');
                        $('#verify *').hide();
                        $('#verify').show().addClass('in');
                        $('#verify2').show();

                        textsecure.registerSingleDevice(number, verificationCode, function(step) {
                            switch(step) {
                            case 1:
                                $('#verify3').show();
                                break;
                            case 2:
                                $('#verify4').show();
                                break;
                            case 3:
                                $('#complete-number').text(number);
                                $('#verify').hide();
                                $('#init-setup').hide().removeClass('in');
                                $('#setup-complete').show().addClass('in');
                                textsecure.registration.done();
                            }
                        }).catch(function(error) {
                            $('#verify *').hide();
                            $('#verifyCode').removeAttr('disabled');
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
                        $('input.number').removeClass('invalid');
                    });
                });

                $('#multi-device .status').text("Connecting...");
                $('#setup-qr').html('');
                textsecure.protocol.prepareTempWebsocket().then(function(cryptoInfo) {
                    var qrCode = new QRCode(document.getElementById('setup-qr'));

                    var socket = textsecure.api.getTempWebsocket();
                    new WebSocketResource(socket, function(request) {
                        if (request.path == "/v1/address" && request.verb == "PUT") {
                            var proto = textsecure.protobuf.ProvisioningUuid.decode(request.body);
                            qrCode.makeCode('tsdevice:/' +
                                            '?uuid=' + proto.uuid +
                                            '&pub_key=' + btoa(getString(cryptoInfo.pubKey)));
                            $('img').removeAttr('style');
                            $('#multi-device .status').text("Use your phone to scan the QR code.")
                            request.respond(200, 'OK');
                        } else if (request.path == "/v1/message" && request.verb == "PUT") {
                            $('#init-setup').hide();
                            $('#verify1done').text('');
                            $('#verify2done').text('');
                            $('#verify3done').text('');
                            $('#verify4done').text('');
                            $('#verify5done').text('');
                            $('#verify').show().addClass('in');

                            textsecure.registerSecondDevice(request.body, cryptoInfo, function(step) {
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
                                    //XXX: User needs to verify number before we continue
                                    $('#verify4done').text('done');
                                    //$('#complete-number').text(parsedNumber);
                                    textsecure.registration.done();
                                case 5:
                                    //TODO: Do sync to get 5!
                                    $('#verify').hide();
                                    $('#setup-complete').show().addClass('in');
                                    textsecure.registration.done();
                                }
                            });
                        } else
                            console.log(request.path);
                    });
                });
            });
        }
    });
})();
