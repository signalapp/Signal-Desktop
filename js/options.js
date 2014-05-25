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

function updateCodeNumberColors() {
	try {
		textsecure.utils.verifyNumber($('#number').val(), $('#countrycode').val());
		$('#number').attr('style', '');
		$('#code').attr('style', '');
	} catch (e) {
		if (e.countryCodeValid)
			$('#code').attr('style', '');
		else
			$('#code').attr('style', 'background-color:#ff6666;');

		if (e.numberValid)
			$('#number').attr('style', '');
		else
			$('#number').attr('style', 'background-color:#ff6666;');
	}
}

$('#code').on('change', updateCodeNumberColors);
$('#number').on('change', updateCodeNumberColors);

var single_device = false;
var signaling_key = textsecure.crypto.getRandomBytes(32 + 20);
var password = btoa(getString(textsecure.crypto.getRandomBytes(16)));
password = password.substring(0, password.length - 2);
var registrationId = new Uint16Array(textsecure.crypto.getRandomBytes(2))[0];
registrationId = registrationId & 0x3fff;

$('#init-go-single-client').click(function() {
	var number = textsecure.utils.verifyNumber($('#number').val(), $('#countrycode').val());

	$('#init-go').html('Setup');
	$('#countrycode').prop('disabled', 'disabled');
	$('#number').prop('disabled', 'disabled');
	$('#init-go-single-client').prop('disabled', 'disabled');

	single_device = true;

	textsecure.api.requestVerificationCode(number,
		function(response) { },
		function(code) {
			alert("Failed to send key?" + code); //TODO
		}
	);
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

		textsecure.api.confirmCode($('#code').val(), number, password, signaling_key, registrationId, single_device,
			function(response) {
				if (single_device)
					response = 1;
				var number_id = number + "." + response;
				textsecure.storage.putEncrypted("password", password);
				textsecure.storage.putEncrypted('signaling_key', signaling_key);
				textsecure.storage.putUnencrypted("number_id", number_id);
				textsecure.storage.putUnencrypted("registrationId", registrationId);
				$('#verify1done').html('done');

				var register_keys_func = function() {
					$('#verify2done').html('done');
					textsecure.crypto.generateKeys().then(function(keys) {
						$('#verify3done').html('done');
						textsecure.api.registerKeys(keys,
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
					//TODO: Redo all this
					/*getKeysForNumber(number).then(function(identityKey) {
						textsecure.subscribeToPush(function(message) {
							//TODO receive shared identity key
							register_keys_func();
						});
						requestIdentityPrivKeyFromMasterDevice(number);
					}).catch(function(error) {
						alert(error); //TODO
					});*/
					register_keys_func();
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

textsecure.registerOnLoadFunction(function() {
    $(function() {
        if (!isRegistrationDone()) {
            $('#init-setup').show();
        } else {
            $('#complete-number').html(textsecure.storage.getUnencrypted("number_id").split(".")[0]);
            $('#setup-complete').show();
        }
    });
});
