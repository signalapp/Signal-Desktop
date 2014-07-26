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

function updateNumberColors() {
	try {
		if($('#number').val() != "" && $('#regionCode').val() != "")
			textsecure.utils.verifyNumber($('#number').val(), $('#regionCode').val());
		$('#countrycode').removeClass('invalid');
		$('#number').removeClass('invalid');
	} catch (numberInvalidError) {
		console.log(numberInvalidError);
		$('#countrycode').addClass('invalid');
		$('#number').addClass('invalid');
	}
}

function isCodeValid() {
	var code = $('#code');
	return code.val().replace(/\D/g, '') == code.val() && code.val().length == 6;
}

$('#code').on('change', function() {
	if (!isCodeValid())
		$('#code').addClass('invalid');
	else
		$('#code').removeClass('invalid');
});

var single_device = false;

$('#init-go-single-client').click(function() {
	try {
		var parsedNumber = textsecure.utils.verifyNumber($('#number').val(), $('#regionCode').val());
	} catch(e) {
		alert("Please enter a valid phone number first.");
		return false;
	}

	$('#init-go').text('Setup');
	$('#countrycode').prop('disabled', 'disabled');
	$('#number').prop('disabled', 'disabled');
	$('#init-go-single-client').prop('disabled', 'disabled');
    $('#init-setup-verification').show();

	single_device = true;

	textsecure.api.requestVerificationCode(parsedNumber).catch(function(error) {
		//TODO: No alerts
		if (error.humanReadable)
			alert(error.humanReadable);
		else
			alert(error); // XXX
	});
});

$('#init-go').click(function() {
	var parsedNumber = textsecure.utils.verifyNumber($('#number').val(), $('#regionCode').val());
	if (!isCodeValid()) {
		updateCodeColor();
		return;
	}

	$('#init-setup').hide();
	$('#verify1').hide();
	$('#verify2done').text('');
	$('#verify3done').text('');
	$('#verify4done').text('');
	$('#verify5').hide();
	$('#verify').show();

	textsecure.registerSingleDevice(parsedNumber, $('#code').val(), function(step) {
		switch(step) {
		case 1:
			$('#verify2done').text('done');
			break;
		case 2:
			$('#verify3done').text('done');
			break;
		case 3:
			$('#complete-number').text(parsedNumber);
			$('#verify').hide();
			$('#setup-complete').show();
			registrationDone();
		}
	}).catch(function(error) {
		//TODO: No alerts...
		if (error.humanError)
			alert(error.humanError);
		else
			alert(error); //XXX
	});
});

textsecure.registerOnLoadFunction(function() {
	$(function() {
		if (!isRegistrationDone()) {
			$('#init-setup').show();

			var countrys = textsecure.utils.getAllRegionCodes();
			$.each(countrys, function (regionCode, countryName) {
				$('#regionCode').append($('<option>', {
					value: regionCode,
					text : countryName
				}));
			});

			$('#regionCode').change(function(){
				$('#countrycode').val(textsecure.utils.getCountryCodeForRegion(this.value));
				updateNumberColors();
			});

			$('#countrycode').keyup(function(){
				$('#regionCode').val(textsecure.utils.getRegionCodeForCountryCode($('#countrycode').val()));
				updateNumberColors();
			});

			$('#number').change(updateNumberColors);

			// handle form data cached by the browser (after a page ref
			$('#regionCode').val(textsecure.utils.getRegionCodeForCountryCode($('#countrycode').val()));
			updateNumberColors();

			textsecure.crypto.prepareTempWebsocket().then(function(cryptoInfo) {
				var qrCode = new QRCode(document.getElementById('setup-qr'));
				var socket = textsecure.api.getTempWebsocket();

				socket.onmessage = function(message) {
					//TODO: Get a server format for this
					if (message.type === 4) {
						qrCode.makeCode('textsecure-device-init:/' +
										'?channel_uuid=' + message.message +
										'&channel_server=' + textsecure.api.relay +
										'&publicKey=' + btoa(getString(cryptoInfo.publicKey)));
						$('img').removeAttr('style');
						$('#left-connecting').hide();
						$('#left-setup').show();
						$('#left-reconnecting').hide();
					} else {
						$('#init-setup').hide();
						$('#verify1done').text('');
						$('#verify2done').text('');
						$('#verify3done').text('');
						$('#verify4done').text('');
						$('#verify5done').text('');
						$('#verify').show();


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
								$('#setup-complete').show();
								registrationDone();
							}
						});
					}
				};

				socket.ondisconnect = function() {
					$('#left-connecting').hide();
					$('#left-setup').hide();
					$('#left-reconnecting').show();
				};
			});
		} else {
			$('#complete-number').text(textsecure.utils.unencodeNumber(textsecure.storage.getUnencrypted("number_id"))[0]);//TODO: no
			$('#setup-complete').show();
        }
    });
});
