function codeMatches() {
	var match = $('#code').val().match(/[0-9]{3}-?[0-9]{3}/g)
	return match != null && match.length == 1 && match[0] == $('#code').val();
}

function numberMatches() {
	var country_code = $('#countrycode').value().replace(/\D/g, '');
	return $('#number').value().replace(/\D/g, '').length > 5 && country_code.length > 0 && country_code.length < 4;
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
}

$('#init-go').click(function() {
	if (codeMatches() && numberMatches()) {
		var signaling_key = getRandomBytes(32 + 20);
		var password = getRandomBytes(16);
		var number = "+" + $('#countrycode').value().replace(/\D/g, '') + $('#number').value().replace(/\D/g, '');

		$('#init-setup').hide();
		$('#verify1done').html('');
		$('#verify2done').html('');
		$('#verify3done').html('');
		$('#verify').show();

		doAjax({call: 'devices', httpType:  'PUT', urlParameters: '/' + $('#code').val(), success_callback: function(response) {
				$('#verify1done').html('done');
				var keys = generateKeys();
				$('#verify2done').html('done');
				var number_id = number + "." + response;
				doAjax({call: 'keys', httpType: 'PUT', user: number_id, password: password,
					jsonData: keys, success_callback: function(response) {
						$('#complete-number').html('');
						$('#verify').hide();
						$('#setup-complete').show();
						storage.putUnencrypted("number_id", number_id);
					}, error_callback: function(code) {
						alert(code); //TODO
					}
				});
				storage.putEncrypted('signaling_key', signaling_key);
				storage.putEncrypted('login_password', password);
			}, error_callback: function(code) {
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
			}, user: number, password: password,
			jsonData: {signalingKey: btoa(String.fromCharCode.apply(null, signaling_key)), supportsSms: false, fetchesMessages: true}
		});
	}
});

if (storage.getUnencrypted("number_id") === undefined) {
	$('#init-setup').show();
} else {
	$('#complete-number').html(storage.getUnencrypted("number_id").split(".")[0]);
	$('#setup-complete').show();
}
