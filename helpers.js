//TODO: Stolen from MDN (copyright...)
function b64ToUint6 (nChr) {

  return nChr > 64 && nChr < 91 ?
      nChr - 65
    : nChr > 96 && nChr < 123 ?
      nChr - 71
    : nChr > 47 && nChr < 58 ?
      nChr + 4
    : nChr === 43 ?
      62
    : nChr === 47 ?
      63
    :
      0;

}

function base64DecToArr (sBase64, nBlocksSize) {
  var
    sB64Enc = sBase64.replace(/[^A-Za-z0-9\+\/]/g, ""), nInLen = sB64Enc.length,
    nOutLen = nBlocksSize ? Math.ceil((nInLen * 3 + 1 >> 2) / nBlocksSize) * nBlocksSize : nInLen * 3 + 1 >> 2, taBytes = new Uint8Array(nOutLen);

  for (var nMod3, nMod4, nUint24 = 0, nOutIdx = 0, nInIdx = 0; nInIdx < nInLen; nInIdx++) {
    nMod4 = nInIdx & 3;
    nUint24 |= b64ToUint6(sB64Enc.charCodeAt(nInIdx)) << 18 - 6 * nMod4;
    if (nMod4 === 3 || nInLen - nInIdx === 1) {
      for (nMod3 = 0; nMod3 < 3 && nOutIdx < nOutLen; nMod3++, nOutIdx++) {
        taBytes[nOutIdx] = nUint24 >>> (16 >>> nMod3 & 24) & 255;
      }
      nUint24 = 0;
    }
  }
  return taBytes;
}

/*********************************
 *** Type conversion utilities ***
 *********************************/
function getString(thing) {
	if (thing == "[object Uint8Array]")
		return String.fromCharCode.apply(null, thing);
	return thing;
}

function getUint8Array(string) {
	return base64DecToArr(btoa(string));
}

function base64ToUint8Array(string) {
	return base64DecToArr(string);
}

var OutgoingMessageProtobuf = dcodeIO.ProtoBuf.loadProtoFile("OutgoingMessageSignal.proto").build("textsecure.OutgoingMessageSignal");
function decodeProtobuf(string) {
	return OutgoingMessageProtobuf.decode(string);
}

function getNumberFromString(string) {
	return string.split(".")[0];
}

function getEncodedNumber(number) {
	var split = number.split(".");
	if (split.length > 1) {
		if (split[1] == 1)
			return split[0];
		else
			return number;
	} else
		return number;
}

function getDeviceId(encodedNumber) {
	var split = encodedNumber.split(".");
	if (split.length > 1)
		return split[1];
	return 1;
}

/************************************************
 *** Utilities to store data in local storage ***
 ************************************************/
var storage = {};

storage.putEncrypted = function(key, value) {
	//TODO
	localStorage.setItem("e" + key, getString(value));
}

storage.getEncrypted = function(key, defaultValue) {
//TODO
	var value = localStorage.getItem("e" + key);
	if (value === null)
		return defaultValue;
	return value;
}

storage.putUnencrypted = function(key, value) {
	localStorage.setItem("u" + key, getString(value));
}

storage.getUnencrypted = function(key, defaultValue) {
	var value = localStorage.getItem("u" + key);
	if (value === null)
		return defaultValue;
	return value;
}

/*******************************************
 *** Utilities to manage keys/randomness ***
 *******************************************/
function getRandomBytes(size) {
	//TODO: Better random (https://www.grc.com/r&d/js.htm?)
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

// Keep track of other's keys too
function getDeviceObject(encodedNumber) {
	var deviceObject = storage.getEncrypted("deviceObject" + encodedNumber);
	if (deviceObject === undefined)
		return deviceObject;
	return JSON.parseJSON(deviceObject);
}

function getDeviceIdListFromNumber(number) {
	return storage.getEncrypted("deviceIdList" + getNumberFromString(number), []);
}

function addDeviceIdForNumber(number, deviceId) {
	var deviceIdList = JSON.parseJSON(getDeviceIdListFromNumber(getNumberFromString(number)));
	for (var i = 0; i < deviceIdList.length; i++) {
		if (deviceIdList[i] == deviceId)
			return;
	}
	deviceIdList[deviceIdList.length] = deviceId;
	storage.putEncrypted("deviceIdList" + getNumberFromString(number), deviceIdList);
}

// throws "Identity key mismatch"
function saveDeviceObject(deviceObject) {
	var existing = getDeviceObject(deviceObject.encodedNumber);
	for (key in deviceObject) {
		if (key == "encodedNumber")
			continue;

		if (key == "identityKey" && deviceObject.identityKey != deviceObject.identityKey)
			throw "Identity key mismatch";

		existing[key] = deviceObject[key];
	}
	storage.putEncrypted("deviceObject", JSON.encode(existing));
	addDeviceIdForNumber(deviceObject.encodedNumber, getDeviceId(deviceObject.encodedNumber));
}

function getDeviceObjectListFromNumber(number) {
	var deviceObjectList = [];
	var deviceIdList = getDeviceIdForNumber(number);
	for (var i = 0; i < deviceIdList.length; i++)
		deviceObjectList[deviceObjectList.length] = getDeviceObject(getNumberFromString(number) + "." + deviceIdList[i]);
	return deviceObjectList;
}

/********************
 *** Crypto stuff ***
 ********************/

// Decrypts message into a BASE64 string
function decryptWebsocketMessage(message) {
	//TODO: Use a native AES impl (so I dont feel so bad about side-channels)
	var signaling_key = storage.getEncrypted("signaling_key");
	var aes_key = CryptoJS.enc.Latin1.parse(signaling_key.substring(0, 32));
	var mac_key = CryptoJS.enc.Latin1.parse(signaling_key.substring(32, 32 + 20));

	var decodedMessage = base64ToUint8Array(message);
	if (decodedMessage[0] != 1) {
		console.log("Got bad version number: " + decodedMessage[0]);
		return;
	}
	var iv = CryptoJS.lib.WordArray.create(decodedMessage.subarray(1, 1 + 16));
	var ciphertext = btoa(getString(decodedMessage.subarray(1 + 16, decodedMessage.length - 10)));
	var mac = CryptoJS.lib.WordArray.create(decodedMessage.subarray(decodedMessage.length - 10, decodedMessage.length));

	var calculated_mac = CryptoJS.algo.HMAC.create(CryptoJS.algo.SHA256, mac_key);
	calculated_mac.update(CryptoJS.enc.Latin1.parse(String.fromCharCode(1)));
	calculated_mac.update(iv);
	calculated_mac.update(ciphertext);
	calculated_mac = calculated_mac.finalize();

	var plaintext = CryptoJS.AES.decrypt(ciphertext, aes_key, {iv: iv});//TODO: Does this throw on invalid padding?

	if (calculated_mac.toString(CryptoJS.enc.Hex).substring(0, 20) != mac.toString(CryptoJS.enc.Hex)) {
		console.log("Got message with bad MAC");
		throw "Bad MAC";
	}

	return plaintext.toString(CryptoJS.enc.Base64);
}

function encryptMessageFor(deviceObject, message) {
	return message + " encrypted to " + deviceObject.encodedNumber + " with relay " + deviceObject.relay +
		" with identityKey " + deviceObject.identityKey + " and public key " + deviceObject.publicKey; //TODO
}

/************************************************
 *** Utilities to communicate with the server ***
 ************************************************/
var URL_BASE  = "http://textsecure-test.herokuapp.com";
var URL_CALLS = {};
URL_CALLS['devices']  = "/v1/devices";
URL_CALLS['keys']     = "/v1/keys";
URL_CALLS['push']     = "/v1/messagesocket";
URL_CALLS['messages'] = "/v1/messages";

/**
  * REQUIRED PARAMS:
  * 	call:				URL_CALLS entry
  * 	httpType:			POST/GET/PUT/etc
  * OPTIONAL PARAMS:
  * 	success_callback:	function(response object) called on success
  * 	error_callback: 	function(http status code = -1 or != 200) called on failure
  * 	urlParameters:		crap appended to the url (probably including a leading /)
  * 	user:				user name to be sent in a basic auth header
  * 	password:			password to be sent in a basic auth headerA
  * 	do_auth:			alternative to user/password where user/password are figured out automagically
  * 	jsonData:			JSON data sent in the request body
  */
function doAjax(param) {
	if (param.urlParameters === undefined)
		param.urlParameters = "";
	if (param.do_auth) {
		param.user = storage.getUnencrypted("number_id");
		param.password = storage.getEncrypted("password");
	}
	$.ajax(URL_BASE + URL_CALLS[param.call] + param.urlParameters, {
		type: param.httpType,
		data: JSON.stringify(param.jsonData),
		contentType: 'application/json; charset=utf-8',
		dataType: 'json',
		beforeSend: function(xhr) {
			if (param.user !== undefined && param.password !== undefined)
				xhr.setRequestHeader("Authorization", "Basic " + btoa(getString(param.user) + ":" + getString(param.password)));
		},
		success: function(response, textStatus, jqXHR) {
			if (param.success_callback !== undefined)
				param.success_callback(response);
		},
		error: function(jqXHR, textStatus, errorThrown) {
			var code = jqXHR.status;
			if (code > 999 || code < 100)
				code = -1;
			if (param.error_callback !== undefined)
				param.error_callback(code);
		},
		cache: false
	});
}

function subscribeToPush(message_callback) {
	var user = storage.getUnencrypted("number_id");
	var password = storage.getEncrypted("password");
	var request = { url: URL_BASE + URL_CALLS['push'] + "/?user=%2B" + getString(user).substring(1) + "&password=" + getString(password),
					method: 'GET',
					fallbackMethod: 'GET',
					transport: 'websocket',
					fallbackTransport: 'websocket',
					logLevel: 'debug', //TODO
					trackMessageLength: false,
					//data: "user=" + getString(user) + "&password=" + getString(password),
					onOpen: function(response) {
						console.log('Connected to server using ' + response.transport);
					},
					onMessage: function(response) {
						try {
							// Some bug in Atmosphere.js is forcing trackMessageLength to true
							var message = JSON.parse(response.responseBody.split("|")[1]);
						} catch (e) {
							console.log('Error parsing server JSON message: ' + response.responseBody.split("|")[1]);
							return;
						}

						try {
							var plaintext = decryptWebsocketMessage(message.message);
							var proto = decodeProtobuf(plaintext);
						} catch (e) {
							console.log("Error decoding message: " + e);
							return;
						}

						doAjax({call: 'push', httpType: 'PUT', urlParameters: '/' + message.id, do_auth: true});

						message_callback(proto);
					},
					onError: function(response) {
						console.log('Server is down :(');
						//TODO: GUI
					}};
	$.atmosphere.subscribe(request);
}

// success_callback(identity_key), error_callback(error_msg)
function getKeysForNumber(number, success_callback, error_callback) {
	doAjax({call: 'keys', httpType: 'GET', do_auth: true, urlParameters: "/" + getNumberFromString(number) + "?multikeys",
		success_callback: function(response) {
			for (var i = 0; i < response.length; i++) {
				try {
					saveDeviceObject({
						encodedNumber: number + "." + response[i].deviceId,
						identityKey: response[i].identityKey,
						publicKey: response[i].publicKey
					});
				} catch (e) {
					error_callback(e);
					return;
				}
			}
			success_callback(response[0].identityKey);
		}, error_callback: function(code) {
			error_callback("Error making HTTP request: " + code);
		}
	});
}

// success_callback(server success/failure map), error_callback(error_msg)
function sendMessageToDevices(deviceObjectList, message, success_callback, error_callback) {
	if (message.type === undefined)
		message.type = 0; //TODO: Change to 1 for ciphertext instead of plaintext

	var jsonData = [];
	for (var i = 0; i < deviceObjectList.legnth; i++) {
		jsonData[jsonData.length] = {
			type: message.type,
			destination: deviceObjectList[i].encodedNumber,
			body: encryptMessageFor(deviceObjectList[i], message.message),
			relay: deviceObjectList[i].relay,
			timestamp: new Date().getTime()
		};
	}
	doAjax({call: 'messages', httpType: 'POST', do_auth: true, jsonData: jsonData,
		success_callback: function(result) {
			success_callback(result);
		}, error_callback: function(code) {
			error_callback("Failed to conect to data channel: " + code);
		}
	});
}

// success_callback(success/failure map, see second-to-last line), error_callback(error_msg)
function sendMessageToNumbers(numbers, message, success_callback, error_callback) {
	var deviceObjectList = [];
	for (var i = 0; i < numbers.length; i++) {
		var devicesForNumber = getDeviceObjectListFromNumber(numbers[i]);
		for (var j = 0; j < devicesForNumber.length; j++)
			deviceObjectList[deviceObjectList.length] = devicesForNumber[j];
	}
	return sendMessageToDevices(deviceObjectList, message, function(result) {
		if (result.missingDeviceIds.length > 0) {
			var responsesLeft = result.missingDeviceIds.length;
			var errorThrown = 0;
			for (var i = 0; i < result.missingDeviceIds.length; i++) {
				getKeysForNumber(result.missingDeviceIds[i], function(identity_key) {
						responsesLeft--;
						if (responsesLeft == 0)
							sendMessageToNumbers(numbers, message, success_callback, error_callback);
					}, function(error_msg) {
						errorThrown++;
						if (errorThrown == 1)
							error_callback("Failed to retreive new device keys for number " + result.missingDeviceIds[i]);
					});
			}
		}

		var successNumbers = {};
		var failureNumbers = {};
		for (var i = 0; i < result.success; i++)
			successNumbers[getNumberFromString(result.success[i])] = 1;
		for (var i = 0; i < result.failure; i++)
			failureNumbers[getNumberFromString(result.success[i])] = 1;

		success_callback({success: successNumbers, failure: failureNumbers});
	}, error_callback);
}


function requestIdentityPrivKeyFromMasterDevice(number, identityKey) {
	sendMessage(number, {message: "Identity Key request"}, function() {}, function() {});//TODO
}
