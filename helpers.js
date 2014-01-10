/************************************************
 *** Utilities to store data in local storage ***
 ************************************************/
var storage = {};

storage.putEncrypted = function(key, value) {
	//TODO
	localStorage.setItem("e" + key, value);
}

storage.getEncrypted = function(key, defaultValue) {
//TODO
	var value = localStorage.getItem("e" + key);
	if (value === null)
		return defaultValue;
	return value;
}

storage.putUnencrypted = function(key, value) {
	localStorage.setItem("u" + key, value);
}

storage.getUnencrypted = function(key, defaultValue) {
	var value = localStorage.getItem("u" + key);
	if (value === null)
		return defaultValue;
	return value;
}

/************************************************
 *** Utilities to communicate with the server ***
 ************************************************/
var URL_BASE  = "http://textsecure-test.herokuapp.com";
var URL_CALLS = {};
URL_CALLS['devices'] = "/v1/devices";
URL_CALLS['keys']    = "/v1/keys";

/**
  * REQUIRED PARAMS:
  * 	call:				URL_CALLS entry
  * 	httpType:			POST/GET/PUT/etc
  * 	success_callback:		function(response object) called on success
  * 	error_callback: 	function(http status code = -1 or != 200) called on failure
  * OPTIONAL PARAMS:
  * 	urlParameters:		crap appended to the url (probably including a leading /)
  * 	user:				user name to be sent in a basic auth header
  * 	password:			password to be sent in a basic auth header
  * 	jsonData:			JSON data sent in the request body
  */
function doAjax(param) {
	if (param.urlParameters === undefined)
		param.urlParameters = "";
	$.ajax(URL_BASE + URL_CALLS[param.call] + param.urlParameters, {
		type: param.httpType,
		data: param.jsonData,
		beforeSend: function(xhr) {
			if (param.user !== undefined && param.password !== undefined)
				xhr.setRequestHeader("Authorization", "Basic " + btoa(param.user + ":" + param.password));
		},
		success: function(response, textStatus, jqXHR) {
			param.success_callback(response);
		},
		error: function(jqXHR, textStatus, errorThrown) {
			var code = jqXHR.status;
			if (code > 999 || code < 100)
				code = -1;
			param.error_callback(code);
		},
		cache: false
	});
}

/*******************************************
 *** Utilities to manage keys/randomness ***
 *******************************************/
function getRandomBytes(size) {
	//TODO: Better random (https://www.grc.com/r&d/js.htm?
	try {
		var array = new Uint8Array(size);
		window.crypto.getRandomValues(array);
		return array;
	} catch (err) {
		//TODO: ummm...wat?
	}
}

function getNewPubKey(keyName) {
	//TODO
	var pubKey = "BRTJzsHPUWRRBxyo5MoaBRidMk2fwDlfqvU91b6pzbED";
	var privKey = "";
	storage.putEncrypted("pubKey" + keyName, pubKey);
	storage.putEncrypted("privKey" + keyName, privKey);
	return pubKey;
}

function getExistingPubKey(keyName) {
	return storage.getEncrypted("pubKey" + keyName);
}

function generateKeys() {
	var identityKey = getExistingPubKey("identityKey");
	if (identityKey === undefined)
		identityKey = getNewPubKey("identityKey");

	var keyGroupId = storage.getEncrypted("lastKeyGroupId", -1) + 1;
	storage.putEncrypted("lastKeyGroupId", keyGroupId);

	var keys = {};
	keys.keys = [];
	for (var i = 0; i < 100; i++)
		keys.keys[i] = {keyId: i, publicKey: getNewPubKey("key" + keyGroupId + i), identityKey: identityKey};
	// 0xFFFFFF == 16777215
	keys.lastResortKey = {keyId: 16777215, publicKey: getNewPubKey("lastResortKey" + keyGroupId), identityKey: identityKey};
	return keys;
}
