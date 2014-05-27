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
		textsecure.utils.verifyNumber($('#number').val(), $('#countrycode').val());
		$('#number').attr('style', '');
		$('#countrycode').attr('style', '');
	} catch (e) {
		if (e.countryCodeValid)
			$('#countrycode').attr('style', '');
		else
			$('#countrycode').attr('style', 'background-color:#ff6666;');

		if (e.numberValid)
			$('#number').attr('style', '');
		else
			$('#number').attr('style', 'background-color:#ff6666;');
	}
}

$('#number').on('change', updateNumberColors);
$('#countrycode').on('change', updateNumberColors);

function isCodeValid() {
	var code = $('#code');
	return code.val().replace(/\D/g, '') == code.val() && code.val().length == 6;
}

$('#code').on('change', function() {
	if (!isCodeValid())
		$('#code').attr('style', 'background-color:#ff6666;');
	else
		$('#code').attr('style', '');
});

var single_device = false;

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
	var number = textsecure.utils.verifyNumber($('#number').val(), $('#countrycode').val());
	if (!isCodeValid()) {
		updateCodeColor();
		return;
	}


	$('#init-setup').hide();
	$('#verify1done').html('');
	$('#verify2').hide();
	$('#verify3done').html('');
	$('#verify4done').html('');
	$('#verify').show();

	textsecure.register($('#code').val(), number, single_device, function(step) {
		switch(step) {
		case 1:
			$('#verify1done').html('done');
			break;
		case 2:
			$('#verify2done').html('done');
			break;
		case 3:
			$('#verify3done').html('done');
			break;
		case 4:
			$('#complete-number').html(number);
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
        } else {
            $('#complete-number').html(textsecure.storage.getUnencrypted("number_id").split(".")[0]);//TODO: no
            $('#setup-complete').show();
        }
    });
});
