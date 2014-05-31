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

window.textsecure = window.textsecure || {};

/*********************************
 *** Type conversion utilities ***
 *********************************/
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


function base64ToArrayBuffer(string) {
	return base64DecToArr(string);
}

// Protobuf decoding
//TODO: throw on missing fields everywhere
window.textsecure.protos = function() {
	var self = {};

	self.IncomingPushMessageProtobuf = dcodeIO.ProtoBuf.loadProtoFile("protos/IncomingPushMessageSignal.proto").build("textsecure.IncomingPushMessageSignal");
	self.decodeIncomingPushMessageProtobuf = function(string) {
		return self.IncomingPushMessageProtobuf.decode(btoa(string));
	}

	self.PushMessageContentProtobuf = dcodeIO.ProtoBuf.loadProtoFile("protos/IncomingPushMessageSignal.proto").build("textsecure.PushMessageContent");
	self.decodePushMessageContentProtobuf = function(string) {
		return self.PushMessageContentProtobuf.decode(btoa(string));
	}

	self.WhisperMessageProtobuf = dcodeIO.ProtoBuf.loadProtoFile("protos/WhisperTextProtocol.proto").build("textsecure.WhisperMessage");
	self.decodeWhisperMessageProtobuf = function(string) {
		return self.WhisperMessageProtobuf.decode(btoa(string));
	}

	self.PreKeyWhisperMessageProtobuf = dcodeIO.ProtoBuf.loadProtoFile("protos/WhisperTextProtocol.proto").build("textsecure.PreKeyWhisperMessage");
	self.decodePreKeyWhisperMessageProtobuf = function(string) {
		return self.PreKeyWhisperMessageProtobuf.decode(btoa(string));
	}

	self.KeyExchangeMessageProtobuf = dcodeIO.ProtoBuf.loadProtoFile("protos/WhisperTextProtocol.proto").build("textsecure.KeyExchangeMessage");
	self.decodeKeyExchangeMessageProtobuf = function(string) {
		return self.KeyExchangeMessageProtobuf.decode(btoa(string));
	}

	return self;
}();

// Number formatting utils
window.textsecure.utils = function() {
	var self = {};


	/****************************************
	 *** Number conversion/checking stuff ***
	 ****************************************/
	function isNumeric(string) {
		return string.replace(/\D/g, '') === string;
	}

	function splitPrefixedNumber(number) {
		// number == "+CCNumber"
		return [number.substr(1, 1), number.substr(2)]; //XXX
	}

	function validateNumber(number, countryCode) {
		return isNumeric(number) && number.length > 3 && number.length < 11; //XXX
	}

	function validateCountryCode(countryCode) {
		return isNumeric(countryCode) && countryCode.length < 4 && countryCode.length > 0;
	}

	self.verifyNumber = function(number, countryCode) {
		//XXX: All verifyNumber stuff needs to match the server-side verification
		var countryCodeValid = true;
		var numberValid = true;

		if (number.substr(0, 1) == '+') {
			if (countryCode === undefined) {
				var numberCCPair = splitPrefixedNumber(number);
				if (numberCCPair != null) {
					countryCode = numberCCPair[0];
					number = numberCCPair[1];
				} else
					numberValid = false;
			} else
				numberValid = false;
		} else if (countryCode === undefined)
			numberValid = false;

		if (numberValid && !validateNumber(number, countryCode))
			numberValid = false;
		if (countryCode !== undefined)
			countryCodeValid = validateCountryCode(countryCode);

		if (!countryCodeValid || !numberValid)
			throw { countryCodeValid: countryCodeValid, numberValid: numberValid };

		return '+' + countryCode + number;
	}

	self.unencodeNumber = function(number) {
		return number.split(".");
	}

	/**************************
	 *** JSON'ing Utilities ***
	 **************************/
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

	self.jsonThing = function(thing) {
		return JSON.stringify(ensureStringed(thing));
	}

	return self;
}();

window.textsecure.throwHumanError = function(error, type, humanError) {
	var e = new Error(error);
	if (type !== undefined)
		e.name = type;
	e.humanError = humanError;
	throw e;
}

/************************************************
 *** Utilities to store data in local storage ***
 ************************************************/
window.textsecure.storage = function() {
	var self = {};

	/*****************************
	 *** Base Storage Routines ***
	 *****************************/
	self.putEncrypted = function(key, value) {
		//TODO
		if (value === undefined)
			throw new Error("Tried to store undefined");
		localStorage.setItem("e" + key, textsecure.utils.jsonThing(value));
	}

	self.getEncrypted = function(key, defaultValue) {
	//TODO
		var value = localStorage.getItem("e" + key);
		if (value === null)
			return defaultValue;
		return JSON.parse(value);
	}

	self.removeEncrypted = function(key) {
		localStorage.removeItem("e" + key);
	}

	self.putUnencrypted = function(key, value) {
		if (value === undefined)
			throw new Error("Tried to store undefined");
		localStorage.setItem("u" + key, textsecure.utils.jsonThing(value));
	}

	self.getUnencrypted = function(key, defaultValue) {
		var value = localStorage.getItem("u" + key);
		if (value === null)
			return defaultValue;
		return JSON.parse(value);
	}

	self.removeUnencrypted = function(key) {
		localStorage.removeItem("u" + key);
	}

	/**********************
	 *** Device Storage ***
	 **********************/
	self.devices = function() {
		var self = {};

		self.saveDeviceObject = function(deviceObject) {
			if (deviceObject.identityKey === undefined || deviceObject.registrationId === undefined || deviceObject.encodedNumber === undefined)
				throw new Error("Tried to store invalid deviceObject");

			var number = textsecure.utils.unencodeNumber(deviceObject.encodedNumber)[0];
			var map = textsecure.storage.getEncrypted("devices" + number);

			if (map === undefined)
				map = { devices: [deviceObject], identityKey: deviceObject.identityKey };
			else if (map.identityKey != getString(deviceObject.identityKey))
				throw new Error("Identity key changed");
			else {
				var updated = false;
				for (i in map.devices) {
					if (map.devices[i].encodedNumber == deviceObject.encodedNumber) {
						map.devices[i] = deviceObject;
						updated = true;
					}
				}

				if (!updated)
					map.devices.push(deviceObject);
			}

			textsecure.storage.putEncrypted("devices" + number, map);
		}

		self.getDeviceObjectsForNumber = function(number) {
			var map = textsecure.storage.getEncrypted("devices" + number);
			return map === undefined ? [] : map.devices;
		}

		self.getDeviceObject = function(encodedNumber) {
			var number = textsecure.utils.unencodeNumber(encodedNumber);
			var devices = self.getDeviceObjectsForNumber(number[0]);
			if (devices === undefined)
				return undefined;

			for (i in devices)
				if (devices[i].encodedNumber == encodedNumber)
					return devices[i];

			return undefined;
		}

		self.removeDeviceIdsForNumber = function(number, deviceIdsToRemove) {
			var map = textsecure.storage.getEncrypted("devices" + number);
			if (map === undefined)
				throw new Error("Tried to remove device for unknown number");

			var newDevices = [];
			var devicesRemoved = 0;
			for (i in map.devices) {
				var keep = true;
				for (idToRemove in deviceIdsToRemove)
					if (map.devices[i].encodedNumber == number + "." + idToRemove)
						keep = false;

				if (keep)
					newDevices.push(map.devices[i]);
				else
					devicesRemoved++;
			}

			if (devicesRemoved != deviceIdsToRemove.length)
				throw new Error("Tried to remove unknown device");
		}

		return self;
	}();

	return self;
}();

/**********************
 *** NaCL Interface ***
 **********************/
window.textsecure.nacl = function() {
	var self = {};

	self.USE_NACL = false;

	var onLoadCallbacks = [];
	var naclLoaded = 0;
	self.registerOnLoadFunction = function(func) {
		if (naclLoaded || !self.USE_NACL) {
			func();
			return;
		}
		onLoadCallbacks[onLoadCallbacks.length] = func;
	}

	var naclMessageNextId = 0;
	var naclMessageIdCallbackMap = {};
	window.moduleDidLoad = function() {
		common.hideModule();
		naclLoaded = 1;
		for (var i = 0; i < onLoadCallbacks.length; i++)
			onLoadCallbacks[i]();
		onLoadCallbacks = [];
	}

	window.handleMessage = function(message) {
		naclMessageIdCallbackMap[message.data.call_id](message.data);
	}

	self.postNaclMessage = function(message) {
		if (!self.USE_NACL)
			throw new Error("Attempted to make NaCL call with !USE_NACL?");

		return new Promise(function(resolve) {
			naclMessageIdCallbackMap[naclMessageNextId] = resolve;
			message.call_id = naclMessageNextId++;

			common.naclModule.postMessage(message);
		});
	}

	return self;
}();

//TODO: Some kind of textsecure.init(use_nacl)
window.textsecure.registerOnLoadFunction = window.textsecure.nacl.registerOnLoadFunction;

// message_callback({message: decryptedMessage, pushMessage: server-providedPushMessage})
window.textsecure.subscribeToPush = function() {
	var subscribeToPushMessageSemaphore = 0;
	return function(message_callback) {
		subscribeToPushMessageSemaphore++;
		if (subscribeToPushMessageSemaphore <= 0)
			return;

		var socket = textsecure.api.getWebsocket();

		var pingInterval;

		//TODO: GUI
		socket.onerror = function(socketEvent) {
			console.log('Server is down :(');
			clearInterval(pingInterval);
			subscribeToPushMessageSemaphore--;
			setTimeout(function() { textsecure.subscribeToPush(message_callback); }, 60000);
		};
		socket.onclose = function(socketEvent) {
			console.log('Server closed :(');
			clearInterval(pingInterval);
			subscribeToPushMessageSemaphore--;
			setTimeout(function() { textsecure.subscribeToPush(message_callback); }, 60000);
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
				textsecure.crypto.decryptWebsocketMessage(message.message).then(function(plaintext) {
					var proto = textsecure.protos.decodeIncomingPushMessageProtobuf(getString(plaintext));
					// After this point, a) decoding errors are not the server's fault, and
					// b) we should handle them gracefully and tell the user they received an invalid message
					console.log("Successfully decoded message with id: " + message.id);
					socket.send(JSON.stringify({type: 1, id: message.id}));
					return textsecure.crypto.handleIncomingPushMessageProto(proto).then(function(decrypted) {
						var handleAttachment = function(attachment) {
							return textsecure.api.getAttachment(attachment.id).then(function(encryptedBin) {
								return textsecure.crypto.decryptAttachment(encryptedBin, toArrayBuffer(attachment.key)).then(function(decryptedBin) {
									attachment.decrypted = decryptedBin;
								});
							});
						};

						var promises = [];
						for (var i = 0; i < decrypted.attachments.length; i++)
							promises[i] = handleAttachment(decrypted.attachments[i]);
						return Promise.all(promises).then(function() {
							message_callback({pushMessage: proto, message: decrypted});
						});
					})
				}).catch(function(e) {
					// TODO: Show "Invalid message" messages?
					console.log("Error handling incoming message: ");
					console.log(e);
				});
			}
		};
	}
}();

// sendMessage(numbers = [], message = PushMessageContentProto, callback(success/failure map))
window.textsecure.sendMessage = function() {
	function getKeysForNumber(number, updateDevices) {
		return textsecure.api.getKeysForNumber(number).then(function(response) {
			var identityKey = getString(response[0].identityKey);
			for (i in response)
				if (getString(response[i].identityKey) != identityKey)
					throw new Error("Identity key changed");

			for (i in response) {
				var updateDevice = (updateDevices === undefined);
				if (!updateDevice)
					for (deviceId in updateDevices)
						if (deviceId == response[i].deviceId)
							updateDevice = true;

				if (updateDevice)
					textsecure.storage.devices.saveDeviceObject({
						encodedNumber: number + "." + response[i].deviceId,
						identityKey: response[i].identityKey,
						publicKey: response[i].publicKey,
						preKeyId: response[i].keyId,
						registrationId: response[i].registrationId
					});
			}
		});
	}

	// success_callback(server success/failure map), error_callback(error_msg)
	// message == PushMessageContentProto (NOT STRING)
	function sendMessageToDevices(number, deviceObjectList, message, success_callback, error_callback) {
		var jsonData = [];
		var relay = undefined;
		var promises = [];

		var addEncryptionFor = function(i) {
			if (deviceObjectList[i].relay !== undefined) {
				if (relay === undefined)
					relay = deviceObjectList[i].relay;
				else if (relay != deviceObjectList[i].relay)
					return new Promise(function() { throw new Error("Mismatched relays for number " + number); });
			} else {
				if (relay === undefined)
					relay = "";
				else if (relay != "")
					return new Promise(function() { throw new Error("Mismatched relays for number " + number); });
			}

			return textsecure.crypto.encryptMessageFor(deviceObjectList[i], message).then(function(encryptedMsg) {
				jsonData[i] = {
					type: encryptedMsg.type,
					destination: number,
					destinationDeviceId: textsecure.utils.unencodeNumber(deviceObjectList[i].encodedNumber)[1],
					destinationRegistrationId: deviceObjectList[i].registrationId,
					body: encryptedMsg.body,
					timestamp: new Date().getTime()
				};

				if (deviceObjectList[i].relay !== undefined)
					jsonData[i].relay = deviceObjectList[i].relay;
			});
		}

		for (var i = 0; i < deviceObjectList.length; i++)
			promises[i] = addEncryptionFor(i);
		return Promise.all(promises).then(function() {
			return textsecure.api.sendMessages(number, jsonData);
		});
	}

	return function(numbers, message, callback) {
		var numbersCompleted = 0;
		var errors = [];
		var successfulNumbers = [];

		var numberCompleted = function() {
			numbersCompleted++;
			if (numbersCompleted >= numbers.length)
				callback({success: successfulNumbers, failure: errors});
		}

		var registerError = function(number, message, error) {
			if (error.humanError)
				message = error.humanError;
			errors[errors.length] = { number: number, reason: message, error: error };
			numberCompleted();
		}

		var doSendMessage = function(number, devicesForNumber, message) {
			return sendMessageToDevices(number, devicesForNumber, message).then(function(result) {
				successfulNumbers[successfulNumbers.length] = number;
				numberCompleted();
			}).catch(function(error) {
				if (error instanceof Error && error.name == "HTTPError" && (error.message == 410 || error.message == 409)) {
					var resetDevices = ((error.message == 410) ? error.response.staleDevices : error.response.missingDevices);
					getKeysForNumber(number, resetDevices).then(function() {
						if (error.message == 409)
							resetDevices = resetDevices.concat(error.response.extraDevices);

						textsecure.storage.devices.removeDeviceIdsForNumber(number, resetDevices);
						for (i in resetDevices)
							textsecure.crypto.forceRemoveAllSessions(number + "." + resetDevices[i]);

						//TODO: Try again
					}).catch(function(error) {
						if (error.message !== "Identity key changed")
							registerError(number, "Failed to reload device keys", error);
						else {
							// TODO: Identity key changed, check which devices it changed for and get upset
							registerError(number, "Identity key changed!!!!", error);
						}
					});
				} else
					registerError(number, "Failed to create or send message", error);
			});
		}

		for (var i = 0; i < numbers.length; i++) {
			var number = numbers[i];
			var devicesForNumber = textsecure.storage.devices.getDeviceObjectsForNumber(number);

			if (devicesForNumber.length == 0) {
				getKeysForNumber(number).then(function() {
					devicesForNumber = textsecure.storage.devices.getDeviceObjectsForNumber(number);
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
}();

window.textsecure.register = function() {
	return function(number, verificationCode, singleDevice, stepDone) {
		var signalingKey = textsecure.crypto.getRandomBytes(32 + 20);
		textsecure.storage.putEncrypted('signaling_key', signalingKey);

		var password = btoa(getString(textsecure.crypto.getRandomBytes(16)));
		password = password.substring(0, password.length - 2);
		textsecure.storage.putEncrypted("password", password);

		var registrationId = new Uint16Array(textsecure.crypto.getRandomBytes(2))[0];
		registrationId = registrationId & 0x3fff;
		textsecure.storage.putUnencrypted("registrationId", registrationId);

		return textsecure.api.confirmCode(number, verificationCode, password, signalingKey, registrationId, singleDevice).then(function(response) {
			if (singleDevice)
				response = 1;
			var numberId = number + "." + response;
			textsecure.storage.putUnencrypted("number_id", numberId);
			stepDone(1);

			if (!singleDevice) {
				//TODO: Do things???
				stepDone(2);
			}

			return textsecure.crypto.generateKeys().then(function(keys) {
				stepDone(3);
				return textsecure.api.registerKeys(keys).then(function() {
					stepDone(4);
				});
			});
		});
	}
}();
