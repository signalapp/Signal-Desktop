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

/* START CRAP TO BE DELETED */
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
    nOutLen = nBlocksSize ? Math.ceil((nInLen * 3 + 1 >> 2) / nBlocksSize) * nBlocksSize : nInLen * 3 + 1 >> 2;
var aBBytes = new ArrayBuffer(nOutLen);
var taBytes = new Uint8Array(aBBytes);

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
  return aBBytes;
}

/* Base64 string to array encoding */

function uint6ToB64 (nUint6) {

  return nUint6 < 26 ?
      nUint6 + 65
    : nUint6 < 52 ?
      nUint6 + 71
    : nUint6 < 62 ?
      nUint6 - 4
    : nUint6 === 62 ?
      43
    : nUint6 === 63 ?
      47
    :
      65;

}

function base64EncArr (aBytes) {

  var nMod3, sB64Enc = "";

  for (var nLen = aBytes.length, nUint24 = 0, nIdx = 0; nIdx < nLen; nIdx++) {
    nMod3 = nIdx % 3;
    //if (nIdx > 0 && (nIdx * 4 / 3) % 76 === 0) { sB64Enc += "\r\n"; }
    nUint24 |= aBytes[nIdx] << (16 >>> nMod3 & 24);
    if (nMod3 === 2 || aBytes.length - nIdx === 1) {
      sB64Enc += String.fromCharCode(uint6ToB64(nUint24 >>> 18 & 63), uint6ToB64(nUint24 >>> 12 & 63), uint6ToB64(nUint24 >>> 6 & 63), uint6ToB64(nUint24 & 63));
      nUint24 = 0;
    }
  }

  return sB64Enc.replace(/A(?=A$|$)/g, "=");

}

/* END CRAP TO BE DELETED */

/*********************************
 *** Type conversion utilities ***
 *********************************/
function intToArrayBuffer(nInt) {
	var res = new ArrayBuffer(16);
	var thing = new Uint8Array(res);
	thing[0] = (nInt >> 24) & 0xff;
	thing[1] = (nInt >> 16) & 0xff;
	thing[2] = (nInt >> 8 ) & 0xff;
	thing[3] = (nInt >> 0 ) & 0xff;
	return res;
}

// Strings/arrays
//TODO: Throw all this shit in favor of consistent types
var StaticByteBufferProto = new dcodeIO.ByteBuffer().__proto__;
var StaticArrayBufferProto = new ArrayBuffer().__proto__;
var StaticUint8ArrayProto = new Uint8Array().__proto__;
var StaticWordArrayProto = CryptoJS.lib.WordArray.create('').__proto__;
function getString(thing) {
	if (thing === Object(thing)) {
		if (thing.__proto__ == StaticUint8ArrayProto)
			return String.fromCharCode.apply(null, thing);
		if (thing.__proto__ == StaticArrayBufferProto)
			return getString(new Uint8Array(thing));
		if (thing.__proto__ == StaticByteBufferProto)
			return thing.toString("binary");
		if (thing.__proto__ == StaticWordArrayProto)
			return thing.toString(CryptoJS.enc.Latin1);
	}
	return thing;
}

function getStringable(thing) {
	return (typeof thing == "string" || typeof thing == "number" || typeof thing == "boolean" ||
			(thing === Object(thing) &&
				(thing.__proto__ == StaticArrayBufferProto ||
				thing.__proto__ == StaticUint8ArrayProto ||
				thing.__proto__ == StaticByteBufferProto ||
				thing.__proto__ == StaticWordArrayProto)));
}

function toArrayBuffer(thing) {
	//TODO: Optimize this for specific cases
	if (thing === undefined)
		return undefined;
	if (thing === Object(thing) && thing.__proto__ == StaticArrayBufferProto)
		return thing;

	if (thing instanceof Array) {
		// Assuming Uint16Array from curve25519
		var res = new ArrayBuffer(thing.length * 2);
		var uint = new Uint16Array(res);
		for (var i = 0; i < thing.length; i++)
			uint[i] = thing[i];
		return res;
	}

	if (!getStringable(thing))
		throw new Error("Tried to convert a non-stringable thing of type " + typeof thing + " to an array buffer");
	var str = getString(thing);
	var res = new ArrayBuffer(str.length);
	var uint = new Uint8Array(res);
	for (var i = 0; i < str.length; i++)
		uint[i] = str.charCodeAt(i);
	return res;
}

function ensureStringed(thing) {
	if (getStringable(thing))
		return getString(thing);
	else if (thing instanceof Array) {
		var res = [];
		for (var i = 0; i < thing.length; i++)
			res[i] = ensureStringed(thing[i]);
		return res;
	} else if (thing === Object(thing)) {
		var res = {};
		for (key in thing)
			res[key] = ensureStringed(thing[key]);
		return res;
	}
	throw new Error("unsure of how to jsonify object of type " + typeof thing);

}

function jsonThing(thing) {
	return JSON.stringify(ensureStringed(thing));
}

function base64ToArrayBuffer(string) {
	return base64DecToArr(string);
}

// Protobuf decodingA
//TODO: throw on missing fields everywhere
var IncomingPushMessageProtobuf = dcodeIO.ProtoBuf.loadProtoFile("protos/IncomingPushMessageSignal.proto").build("textsecure.IncomingPushMessageSignal");
function decodeIncomingPushMessageProtobuf(string) {
	return IncomingPushMessageProtobuf.decode(btoa(string));
}

var PushMessageContentProtobuf = dcodeIO.ProtoBuf.loadProtoFile("protos/IncomingPushMessageSignal.proto").build("textsecure.PushMessageContent");
function decodePushMessageContentProtobuf(string) {
	return PushMessageContentProtobuf.decode(btoa(string));
}

var WhisperMessageProtobuf = dcodeIO.ProtoBuf.loadProtoFile("protos/WhisperTextProtocol.proto").build("textsecure.WhisperMessage");
function decodeWhisperMessageProtobuf(string) {
	return WhisperMessageProtobuf.decode(btoa(string));
}

var PreKeyWhisperMessageProtobuf = dcodeIO.ProtoBuf.loadProtoFile("protos/WhisperTextProtocol.proto").build("textsecure.PreKeyWhisperMessage");
function decodePreKeyWhisperMessageProtobuf(string) {
	return PreKeyWhisperMessageProtobuf.decode(btoa(string));
}

var KeyExchangeMessageProtobuf = dcodeIO.ProtoBuf.loadProtoFile("protos/WhisperTextProtocol.proto").build("textsecure.KeyExchangeMessage");
function decodeKeyExchangeMessageProtobuf(string) {
	return KeyExchangeMessageProtobuf.decode(btoa(string));
}

// Number formatting
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

function verifyNumber(string) {
	//TODO: fancy country-code guessing and number verification
	return getEncodedNumber(string.trim());
}

function getDeviceId(encodedNumber) {
	var split = encodedNumber.split(".");
	if (split.length > 1)
		return split[1];
	return 1;
}

// Other

function timestampToHumanReadable(timestamp) {
	var date = new Date();
	date.setTime(timestamp*1000);
	return date.toUTCString();
}

function objectContainsKeys(object) {
	var count = 0;
	for (key in object) {
		count++;
		break;
	}
	return count != 0;
}

/************************************************
 *** Utilities to store data in local storage ***
 ************************************************/
var storage = {};

storage.putEncrypted = function(key, value) {
	//TODO
	if (value === undefined)
		throw new Error("Tried to store undefined");
	localStorage.setItem("e" + key, jsonThing(value));
}

storage.getEncrypted = function(key, defaultValue) {
//TODO
	var value = localStorage.getItem("e" + key);
	if (value === null)
		return defaultValue;
	return JSON.parse(value);
}

storage.removeEncrypted = function(key) {
	localStorage.removeItem("e" + key);
}

storage.putUnencrypted = function(key, value) {
	if (value === undefined)
		throw new Error("Tried to store undefined");
	localStorage.setItem("u" + key, jsonThing(value));
}

storage.getUnencrypted = function(key, defaultValue) {
	var value = localStorage.getItem("u" + key);
	if (value === null)
		return defaultValue;
	return JSON.parse(value);
}

storage.removeUnencrypted = function(key) {
	localStorage.removeItem("u" + key);
}

function registrationDone() {
	storage.putUnencrypted("registration_done", "");
	//TODO: Fix dirty hack:
	chrome.runtime.reload();
}

function isRegistrationDone() {
	return storage.getUnencrypted("registration_done") !== undefined;
}

function getMessageMap() {
	return storage.getEncrypted("messageMap", {});
}

function storeMessage(messageObject) {
	var messageMap = getMessageMap();
	var conversation = messageMap[messageObject.pushMessage.source]; //TODO: Also support Group message IDs here
	if (conversation === undefined) {
		conversation = [];
		messageMap[messageObject.pushMessage.source] = conversation;
	}

	conversation[conversation.length] = { message:    getString(messageObject.message.body),
										sender:       messageObject.pushMessage.source,
										timestamp:    messageObject.pushMessage.timestamp.div(dcodeIO.Long.fromNumber(1000)).toNumber() };
	storage.putEncrypted("messageMap", messageMap);
	chrome.runtime.sendMessage(conversation[conversation.length - 1]);
}

function getDeviceObject(encodedNumber) {
	return storage.getEncrypted("deviceObject" + getEncodedNumber(encodedNumber));
}

function getDeviceIdListFromNumber(number) {
	return storage.getEncrypted("deviceIdList" + getNumberFromString(number), []);
}

function addDeviceIdForNumber(number, deviceId) {
	var deviceIdList = getDeviceIdListFromNumber(getNumberFromString(number));
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
	if (existing === undefined)
		existing = {encodedNumber: getEncodedNumber(deviceObject.encodedNumber)};
	for (key in deviceObject) {
		if (key == "encodedNumber")
			continue;

		if (key == "identityKey" && deviceObject.identityKey != deviceObject.identityKey)
			throw new Error("Identity key mismatch");

		existing[key] = deviceObject[key];
	}
	storage.putEncrypted("deviceObject" + getEncodedNumber(deviceObject.encodedNumber), existing);
	addDeviceIdForNumber(deviceObject.encodedNumber, getDeviceId(deviceObject.encodedNumber));
}

function getDeviceObjectListFromNumber(number) {
	var deviceObjectList = [];
	var deviceIdList = getDeviceIdListFromNumber(number);
	for (var i = 0; i < deviceIdList.length; i++)
		deviceObjectList[deviceObjectList.length] = getDeviceObject(getNumberFromString(number) + "." + deviceIdList[i]);
	return deviceObjectList;
}

/**********************
 *** NaCL Interface ***
 **********************/
var USE_NACL = false;

var onLoadCallbacks = [];
var naclLoaded = 0;
function registerOnLoadFunction(func) {
	if (naclLoaded || !USE_NACL) {
		func();
		return;
	}
	onLoadCallbacks[onLoadCallbacks.length] = func;
}

var naclMessageNextId = 0;
var naclMessageIdCallbackMap = {};
function moduleDidLoad() {
	common.hideModule();
	naclLoaded = 1;
	for (var i = 0; i < onLoadCallbacks.length; i++)
		onLoadCallbacks[i]();
	onLoadCallbacks = [];
}

function handleMessage(message) {
	naclMessageIdCallbackMap[message.data.call_id](message.data);
}

function postNaclMessage(message) {
	if (!USE_NACL)
		throw new Error("Attempted to make NaCL call with !USE_NACL?");

	return new Promise(function(resolve) {
		naclMessageIdCallbackMap[naclMessageNextId] = resolve;
		message.call_id = naclMessageNextId++;

		common.naclModule.postMessage(message);
	});
}

// message_callback(decoded_protobuf) (use decodeMessage(proto))
var subscribeToPushMessageSemaphore = 0;
function subscribeToPush(message_callback) {
	subscribeToPushMessageSemaphore++;
	if (subscribeToPushMessageSemaphore <= 0)
		return;

	var user = storage.getUnencrypted("number_id");
	var password = storage.getEncrypted("password");
	var URL = URL_BASE.replace(/^http:/g, "ws:").replace(/^https:/g, "wss:") + URL_CALLS['push'] + "/?user=%2B" + getString(user).substring(1) + "&password=" + getString(password);
	var socket = new WebSocket(URL);

	var pingInterval;

	//TODO: GUI
	socket.onerror = function(socketEvent) {
		console.log('Server is down :(');
		clearInterval(pingInterval);
		subscribeToPushMessageSemaphore--;
		setTimeout(function() { subscribeToPush(message_callback); }, 60000);
	};
	socket.onclose = function(socketEvent) {
		console.log('Server closed :(');
		clearInterval(pingInterval);
		subscribeToPushMessageSemaphore--;
		setTimeout(function() { subscribeToPush(message_callback); }, 60000);
	};
	socket.onopen = function(socketEvent) {
		console.log('Connected to server!');
		pingInterval = setInterval(function() { console.log("Sending server ping message."); socket.send(JSON.stringify({type: 2})); }, 30000);
	};

	socket.onmessage = function(response) {
		try {
			var message = JSON.parse(response.data);
		} catch (e) {
			console.log('Error parsing server JSON message: ' + response.responseBody.split("|")[1]);
			return;
		}

		if (message.type == 3) {
			console.log("Got pong message");
		} else if (message.type === undefined && message.id !== undefined) {
			crypto.decryptWebsocketMessage(message.message).then(function(plaintext) {
				var proto = decodeIncomingPushMessageProtobuf(getString(plaintext));
				// After this point, a) decoding errors are not the server's fault, and
				// b) we should handle them gracefully and tell the user they received an invalid message
				console.log("Successfully decoded message with id: " + message.id);
				socket.send(JSON.stringify({type: 1, id: message.id}));
				return crypto.handleIncomingPushMessageProto(proto).then(function(decrypted) {
					var handleAttachment = function(attachment) {
						return API.getAttachment(attachment.id).then(function(encryptedBin) {
							return crypto.decryptAttachment(encryptedBin, attachment.key).then(function(decryptedBin) {
								attachment.decrypted = decryptedBin;
							});
						});
					};

					var promises = [];
					for (var i = 0; i < decrypted.message.attachments.length; i++) {
						promises[i] = handleAttachment(decrypted.message.attachments[i]);
					}
					return Promise.all(promises).then(function() {
						storeMessage(decrypted);
						message_callback(decrypted);
					});
				})
			}).catch(function(e) {
				console.log("Error handling incoming message: ");
				console.log(e);
			});
		}
	};
}

// success_callback(identity_key), error_callback(error_msg)
function getKeysForNumber(number) {
	return API.getKeysForNumber(number).then(function(response) {
		for (var i = 0; i < response.length; i++) {
			saveDeviceObject({
				encodedNumber: number + "." + response[i].deviceId,
				identityKey: response[i].identityKey,
				publicKey: response[i].publicKey,
				preKeyId: response[i].keyId,
				registrationId: response[i].registrationId
			});
		}
		return response[0].identityKey;
	});
}

// success_callback(server success/failure map), error_callback(error_msg)
// message == PushMessageContentProto (NOT STRING)
function sendMessageToDevices(number, deviceObjectList, message, success_callback, error_callback) {
	var jsonData = [];
	var relay = undefined;
	var promises = [];

	var addEncryptionFor = function(i) {
		return crypto.encryptMessageFor(deviceObjectList[i], message).then(function(encryptedMsg) {
			jsonData[i] = {
				type: encryptedMsg.type,
				destination: deviceObjectList[i].encodedNumber,
				destinationRegistrationId: deviceObjectList[i].registrationId,
				body: encryptedMsg.body,
				timestamp: new Date().getTime()
			};

			if (deviceObjectList[i].relay !== undefined) {
				jsonData[i].relay = deviceObjectList[i].relay;
				if (relay === undefined)
					relay = jsonData[i].relay;
				else if (relay != jsonData[i].relay)
					throw new Error("Mismatched relays for number " + number);
			} else {
				if (relay === undefined)
					relay = "";
				else if (relay != "")
					throw new Error("Mismatched relays for number " + number);
			}
		});
	}
	for (var i = 0; i < deviceObjectList.length; i++)
		promises[i] = addEncryptionFor(i);
	return Promise.all(promises).then(function() {
		return API.sendMessages(number, jsonData);
	});
}

// callback(success/failure map, see code)
// message == PushMessageContentProto (NOT STRING)
function sendMessageToNumbers(numbers, message, callback) {
	var numbersCompleted = 0;
	var errors = [];
	var successfulNumbers = [];

	var numberCompleted = function() {
		numbersCompleted++;
		if (numbersCompleted >= numbers.length)
			callback({success: successfulNumbers, failure: errors});
	}

	var registerError = function(number, message, error) {
		errors[errors.length] = { number: number, reason: message, error: error };
		numberCompleted();
	}

	var doSendMessage = function(number, devicesForNumber, message) {
		return sendMessageToDevices(number, devicesForNumber, message).then(function(result) {
			successfulNumbers[successfulNumbers.length] = number;
			numberCompleted();
		}).catch(function(error) {
			if (error instanceof Error && error.name == "HTTPError" && (error.message == 410 || error.message == 409)) {
				//TODO: Re-request keys for number here
			}
			registerError(number, "Failed to create or send message", error);
		});
	}

	for (var i = 0; i < numbers.length; i++) {
		var number = numbers[i];
		var devicesForNumber = getDeviceObjectListFromNumber(number);

		if (devicesForNumber.length == 0) {
			getKeysForNumber(number).then(function(identity_key) {
				devicesForNumber = getDeviceObjectListFromNumber(number);
				if (devicesForNumber.length == 0)
					registerError(number, "Failed to retreive new device keys for number " + number, null);
				else
					doSendMessage(number, devicesForNumber, message);
			}).catch(function(error) {
				registerError(number, "Failed to retreive new device keys for number " + number, error);
			});
		} else
			doSendMessage(number, devicesForNumber, message);
	}
}

function requestIdentityPrivKeyFromMasterDevice(number, identityKey) {
	sendMessageToDevices([getDeviceObject(getNumberFromString(number)) + ".1"],
						{message: "Identity Key request"}, function() {}, function() {});//TODO
}

