/*
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

function codeMatches() {
	var match = $('#code').val().match(/[0-9]{3}-?[0-9]{3}/g)
	return match != null && match.length == 1 && match[0] == $('#code').val();
}

function numberMatches() {
	var country_code = $('#countrycode').val().replace(/\D/g, '');
	return $('#number').val().replace(/\D/g, '').length > 5 && country_code.length > 0 && country_code.length < 4;
}

$('#code').on('change', function() {
	if (!codeMatches())
		$('#code').attr('style', 'background-color:#ff6666;');
	else
		$('#code').attr('style', '');
});

$('#number').on('change', function() {//TODO
	if (!numberMatches())
		$('#number').attr('style', 'background-color:#ff6666;');
	else
		$('#number').attr('style', '');
});

var single_device = false;
var signaling_key = window.crypto.getRandomBytes(32 + 20);
var password = btoa(getString(window.crypto.getRandomBytes(16)));
password = password.substring(0, password.length - 2);

$('#init-go-single-client').click(function() {
	if (numberMatches()) {
		var number = "+" + $('#countrycode').val().replace(/\D/g, '') + $('#number').val().replace(/\D/g, '');

		$('#init-go').html('Setup');
		$('#countrycode').prop('disabled', 'disabled');
		$('#number').prop('disabled', 'disabled');
		$('#init-go-single-client').prop('disabled', 'disabled');

		single_device = true;

		API.requestVerificationCode(number,
			function(response) { },
			function(code) {
				alert("Failed to send key?" + code); //TODO
			}
		);
	}
});

$('#init-go').click(function() {
	if (codeMatches() && numberMatches()) {
		var number = "+" + $('#countrycode').val().replace(/\D/g, '') + $('#number').val().replace(/\D/g, '');

		$('#init-setup').hide();
		$('#verify1done').html('');
		$('#verify2').hide();
		$('#verify3done').html('');
		$('#verify4done').html('');
		$('#verify').show();

		API.confirmCode($('#code').val(), number, password, signaling_key, single_device,
			function(response) {
				if (single_device)
					response = 1;
				var number_id = number + "." + response;
				storage.putEncrypted("password", password);
				storage.putEncrypted('signaling_key', signaling_key);
				storage.putUnencrypted("number_id", number_id);
				$('#verify1done').html('done');

				var register_keys_func = function() {
					$('#verify2done').html('done');
					crypto.generateKeys().then(function(keys) {
						$('#verify3done').html('done');
						API.registerKeys(keys,
							function(response) {
								$('#complete-number').html(number);
								$('#verify').hide();
								$('#setup-complete').show();
								registrationDone();
							}, function(code) {
								alert(code); //TODO
							}
						);
					});
				}

				if (!single_device) {
					getKeysForNumber(number).then(function(identityKey) {
						subscribeToPush(function(message) {
							//TODO receive shared identity key
							register_keys_func();
						});
						requestIdentityPrivKeyFromMasterDevice(number);
					}).catch(function(error) {
						alert(error); //TODO
					});
				} else {
					register_keys_func();
				}
			}, function(code) {
				var error;
				switch(code) {
				case 403:
					error = "Invalid code, please try again.";
					break;
				case -1:
					error = "Error connecting to server, please check your network connection.";
					break;
				default:
					error = "Unknown error, please try again later.";
					console.log("Got error code " + code);
				}
				alert(error); //TODO
			}
		);
	}
});

registerOnLoadFunction(function() {
	if (!isRegistrationDone()) {
		$('#init-setup').show();
	} else {
		$('#complete-number').html(storage.getUnencrypted("number_id").split(".")[0]);
		$('#setup-complete').show();
	}
});
