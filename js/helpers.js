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

var USE_NACL = false;

/*********************************
 *** Type conversion utilities ***
 *********************************/
function intToArrayBuffer(nInt) {
	return new ArrayBuffer([
		(nInt >> 24) && 0xFF,
		(nInt >> 16) && 0xFF,
		(nInt >> 8)  && 0xFF,
		nInt && 0xFF
	]);
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

function getArrayBuffer(string) {
	return base64DecToArr(btoa(string));
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

function postNaclMessage(message, callback) {
	if (!USE_NACL)
		throw new Error("Attempted to make NaCL call with !USE_NACL?");

	naclMessageIdCallbackMap[naclMessageNextId] = callback;
	message.call_id = naclMessageNextId++;

	common.naclModule.postMessage(message);
}

/*******************************************
 *** Utilities to manage keys/randomness ***
 *******************************************/
function getRandomBytes(size) {
	//TODO: Better random (https://www.grc.com/r&d/js.htm?)
	try {
		var buffer = new ArrayBuffer(size);
		var array = new Uint8Array(buffer);
		window.crypto.getRandomValues(array);
		return buffer;
	} catch (err) {
		//TODO: ummm...wat?
		throw err;
	}
}

// functions exposed for replacement and direct calling in test code
var crypto_tests = {};

(function(crypto, $, undefined) {
	crypto_tests.privToPub = function(privKey, isIdentity, callback) {
		if (privKey.byteLength != 32)
			throw new Error("Invalid private key");

		var prependVersion = function(pubKey) {
			var origPub = new Uint8Array(pubKey);
			var pub = new ArrayBuffer(33);
			var pubWithPrefix = new Uint8Array(pub);
			for (var i = 0; i < 32; i++)
				pubWithPrefix[i+1] = origPub[i];
			pubWithPrefix[0] = 5;
			return pub;
		}

		if (USE_NACL) {
			postNaclMessage({command: "bytesToPriv", priv: privKey}, function(message) {
				var priv = message.res;
				if (!isIdentity)
					new Uint8Array(priv)[0] |= 0x01;
				postNaclMessage({command: "privToPub", priv: priv}, function(message) {
					callback({ pubKey: prependVersion(message.res), privKey: priv });
				});
			});
		} else {
			privKey = privKey.slice(0);
			var priv = new Uint16Array(privKey);
			priv[0] &= 0xFFF8;
			priv[15] = (priv[15] & 0x7FFF) | 0x4000;

			if (!isIdentity)
				priv[0] |= 0x0001;

			//TODO: fscking type conversion
			callback({ pubKey: prependVersion(toArrayBuffer(curve25519(priv))), privKey: privKey});
		}
	
	}
	var privToPub = function(privKey, isIdentity, callback) { return crypto_tests.privToPub(privKey, isIdentity, callback); }

	crypto_tests.createNewKeyPair = function(isIdentity, callback) {
		return privToPub(getRandomBytes(32), isIdentity, callback);
	}
	var createNewKeyPair = function(isIdentity, callback) { return crypto_tests.createNewKeyPair(isIdentity, callback); }

	var crypto_storage = {};

	crypto_storage.getNewPubKeySTORINGPrivKey = function(keyName, isIdentity, callback) {
		createNewKeyPair(isIdentity, function(keyPair) {
			storage.putEncrypted("25519Key" + keyName, keyPair);
			callback(keyPair.pubKey);
		});
	}

	crypto_storage.getStoredPubKey = function(keyName) {
		return toArrayBuffer(storage.getEncrypted("25519Key" + keyName, { pubKey: undefined }).pubKey);
	}

	crypto_storage.getStoredKeyPair = function(keyName) {
		var res = storage.getEncrypted("25519Key" + keyName);
		if (res === undefined)
			return undefined;
		return { pubKey: toArrayBuffer(res.pubKey), privKey: toArrayBuffer(res.privKey) };
	}

	crypto_storage.getAndRemoveStoredKeyPair = function(keyName) {
		var keyPair = this.getStoredKeyPair(keyName);
		storage.removeEncrypted("25519Key" + keyName);
		return keyPair;
	}

	crypto_storage.getAndRemovePreKeyPair = function(keyId) {
		return this.getAndRemoveStoredKeyPair("preKey" + keyId);
	}

	crypto_storage.getIdentityPrivKey = function() {
		return this.getStoredKeyPair("identityKey").privKey;
	}

	crypto_storage.saveSession = function(encodedNumber, session) {
		storage.putEncrypted("session" + getEncodedNumber(encodedNumber), session);
	}

	crypto_storage.getSession = function(encodedNumber) {
		return storage.getEncrypted("session" + getEncodedNumber(encodedNumber));
	}


	/*****************************
	 *** Internal Crypto stuff ***
	 *****************************/
	//TODO: Think about replacing CryptoJS stuff with optional NaCL-based implementations
	// Probably means all of the low-level crypto stuff here needs pulled out into its own file
	crypto_tests.ECDHE = function(pubKey, privKey, callback) {
		if (privKey !== undefined) {
			privKey = toArrayBuffer(privKey);
			if (privKey.byteLength != 32)
				throw new Error("Invalid private key");
		} else
			throw new Error("Invalid private key");

		if (pubKey !== undefined) {
			pubKey = toArrayBuffer(pubKey);
			var pubView = new Uint8Array(pubKey);
			if (pubKey.byteLength == 33 && pubView[0] == 5) {
				pubKey = new ArrayBuffer(32);
				var pubCopy = new Uint8Array(pubKey);
				for (var i = 0; i < 32; i++)
					pubCopy[i] = pubView[i+1];
			} else if (pubKey.byteLength != 32)
				throw new Error("Invalid public key");
		}

		if (USE_NACL) {
			postNaclMessage({command: "ECDHE", priv: privKey, pub: pubKey}, function(message) {
				callback(message.res);
			});
		} else {
			callback(toArrayBuffer(curve25519(new Uint16Array(privKey), new Uint16Array(pubKey))));
		}
	}
	var ECDHE = function(pubKey, privKey, callback) { return crypto_tests.ECDHE(pubKey, privKey, callback); }

	crypto_tests.HKDF = function(input, salt, info) {
		// Specific implementation of RFC 5869 that only returns exactly 64 bytes
		return HmacSHA256(salt, input).then(function(PRK) {
			var infoString = getString(info);
			// TextSecure implements a slightly tweaked version of RFC 5869: the 0 and 1 should be 1 and 2 here
			return HmacSHA256(PRK, infoString + String.fromCharCode(0)).then(function(T1) {
				return HmacSHA256(PRK, getString(T1) + infoString + String.fromCharCode(1)).then(function(T2) {
					return [ T1, T2 ];
				});
			});
		});
	}

	var HKDF = function(input, salt, info) {
		// HKDF for TextSecure has a bit of additional handling - salts always end up being 32 bytes
		if (salt == '') {
			salt = new ArrayBuffer(32);
			var uintKey = new Uint8Array(salt);
			for (var i = 0; i < 32; i++)
				uintKey[i] = 0;
		}

		salt = toArrayBuffer(salt);

		if (salt.byteLength != 32)
			throw new Error("Got salt of incorrect length");

		return crypto_tests.HKDF(input, salt, info);
	}

	var verifyMACWithVersionByte = function(data, key, mac, version) {
		if (version === undefined)
			version = 1;

		HmacSHA256(key, String.fromCharCode(version) + getString(data)).then(function(calculated_mac) {
			var macString = getString(mac);

			if (calculated_mac.substring(0, macString.length) != macString)
				throw new Error("Bad MAC");
		});
	}

	var calculateMACWithVersionByte = function(data, key, version) {
		if (version === undefined)
			version = 1;

		return HmacSHA256(key, String.fromCharCode(version) + getString(data));
	}

	/******************************
	 *** Ratchet implementation ***
	 ******************************/
	var calculateRatchet = function(session, remoteKey, sending, callback) {
		var ratchet = session.currentRatchet;

		ECDHE(remoteKey, ratchet.ephemeralKeyPair.privKey, function(sharedSecret) {
			HKDF(sharedSecret, ratchet.rootKey, "WhisperRatchet").then(function(masterKey) {
				if (sending)
					session[getString(ratchet.ephemeralKeyPair.pubKey)]	= { messageKeys: {}, chainKey: { counter: -1, key: masterKey[1] } };
				else
					session[getString(remoteKey)]						= { messageKeys: {}, chainKey: { counter: -1, key: masterKey[1] } };
				ratchet.rootKey = masterKey[0];
				callback();
			});
		});
	}

	var initSession = function(isInitiator, ourEphemeralKey, encodedNumber, theirIdentityPubKey, theirEphemeralPubKey, callback) {
		var ourIdentityPrivKey = crypto_storage.getIdentityPrivKey();

		var sharedSecret;
		ECDHE(theirEphemeralPubKey, ourIdentityPrivKey, function(ecRes) {
			sharedSecret = getString(ecRes);

			function finishInit() {
				ECDHE(theirEphemeralPubKey, ourEphemeralKey.privKey, function(ecRes) {
					sharedSecret += getString(ecRes);

					HKDF(sharedSecret, '', "WhisperText").then(function(masterKey) {
						var session = {currentRatchet: { rootKey: masterKey[0], lastRemoteEphemeralKey: theirEphemeralPubKey },
										oldRatchetList: []
									};

						// If we're initiating we go ahead and set our first sending ephemeral key now,
						// otherwise we figure it out when we first maybeStepRatchet with the remote's ephemeral key
						if (isInitiator) {
							createNewKeyPair(false, function(ourSendingEphemeralKey) {
								session.currentRatchet.ephemeralKeyPair = ourSendingEphemeralKey;
								calculateRatchet(session, theirEphemeralPubKey, true, function() {
									crypto_storage.saveSession(encodedNumber, session);
									callback();
								});
							});
						} else {
							session.currentRatchet.ephemeralKeyPair = ourEphemeralKey;
							crypto_storage.saveSession(encodedNumber, session);
							callback();
						}
					});
				});
			}

			if (isInitiator) {
				ECDHE(theirIdentityPubKey, ourEphemeralKey.privKey, function(ecRes) {
					sharedSecret = sharedSecret + getString(ecRes);
					finishInit();
				});
			} else {
				ECDHE(theirIdentityPubKey, ourEphemeralKey.privKey, function(ecRes) {
					sharedSecret = getString(ecRes) + sharedSecret;
					finishInit();
				});
			}
		});
	}

	var initSessionFromPreKeyWhisperMessage = function(encodedNumber, message, callback) {
		//TODO: Check remote identity key matches known-good key

		var preKeyPair = crypto_storage.getAndRemovePreKeyPair(message.preKeyId);
		if (preKeyPair === undefined) {
			if (crypto_storage.getSession(encodedNumber) !== undefined)
				callback();
			else
				throw new Error("Missing preKey for PreKeyWhisperMessage");
		} else {
			initSession(false, preKeyPair, encodedNumber, message.identityKey, message.baseKey, function() {
				callback();
			});
		}
	}

	var fillMessageKeys = function(chain, counter) {
		if (chain.chainKey.counter + 1000 < counter) //TODO: maybe 1000 is too low/high in some cases?
			return new Promise(function(resolve) { resolve() }); // Stalker, much?

		if (chain.chainKey.counter < counter) {
			return HmacSHA256(chain.chainKey.key, String.fromCharCode(1)).then(function(mac) {
				HmacSHA256(chain.chainKey.key, String.fromCharCode(2)).then(function(key) {
					chain.messageKeys[chain.chainKey.counter + 1] = mac;
					chain.chainKey.key = key
					chain.chainKey.counter += 1;
					fillMessageKeys(chain, counter);//XXX: return?
				});
			});
		} else {
			return new Promise(function(resolve) { resolve() });
		}
	}

	var maybeStepRatchet = function(session, remoteKey, previousCounter, callback) {
		if (session[getString(remoteKey)] !== undefined) {
			callback();
			return;
		}

		var ratchet = session.currentRatchet;

		var finish = function() {
			calculateRatchet(session, remoteKey, false, function() {
				// Now swap the ephemeral key and calculate the new sending chain
				var previousRatchet = getString(ratchet.ephemeralKeyPair.pubKey);
				if (session[previousRatchet] !== undefined) {
					ratchet.previousCounter = session[previousRatchet].chainKey.counter;
					delete session[getString(ratchet.ephemeralKeyPair.pubKey)];
				} else
					// TODO: This is just an idiosyncrasy upstream, which we match for testing
					// it should be changed upstream to something more reasonable.
					ratchet.previousCounter = 4294967295;

				createNewKeyPair(false, function(keyPair) {
					ratchet.ephemeralKeyPair = keyPair;
					calculateRatchet(session, remoteKey, true, function() {
						ratchet.lastRemoteEphemeralKey = remoteKey;
						callback();
					});
				});
			});
		}

		var previousRatchet = session[getString(ratchet.lastRemoteEphemeralKey)];
		if (previousRatchet !== undefined) {
			fillMessageKeys(previousRatchet, previousCounter).then(function() {
				if (!objectContainsKeys(previousRatchet.messageKeys))
					delete session[getString(ratchet.lastRemoteEphemeralKey)];
				else
					session.oldRatchetList[session.oldRatchetList.length] = { added: new Date().getTime(), ephemeralKey: ratchet.lastRemoteEphemeralKey };
				finish();
			});
		} else
			finish();
	}

	// returns decrypted protobuf
	var decryptWhisperMessage = function(encodedNumber, messageBytes, callback) {
		var session = crypto_storage.getSession(encodedNumber);
		if (session === undefined)
			throw new Error("No session currently open with " + encodedNumber);

		if (messageBytes[0] != String.fromCharCode((2 << 4) | 2))
			throw new Error("Bad version number on WhisperMessage");

		var messageProto = messageBytes.substring(1, messageBytes.length - 8);
		var mac = messageBytes.substring(messageBytes.length - 8, messageBytes.length);

		var message = decodeWhisperMessageProtobuf(messageProto);

		maybeStepRatchet(session, message.ephemeralKey, message.previousCounter, function() {
			var chain = session[getString(message.ephemeralKey)];

			fillMessageKeys(chain, message.counter).then(function() {
				HKDF(chain.messageKeys[message.counter], '', "WhisperMessageKeys").then(function(keys) {
					delete chain.messageKeys[message.counter];

					verifyMACWithVersionByte(messageProto, keys[1], mac, (2 << 4) | 2);
					var iv = getString(intToArrayBuffer(message.counter));
					decryptAESCTR(message.ciphertext, keys[0], iv).then(function(plaintext) {

						//TODO: removeOldChains(session);
						delete session['pendingPreKey'];

						crypto_storage.saveSession(encodedNumber, session);
						callback(decodePushMessageContentProtobuf(plaintext));
					});
				});
			});
		});
	}

	/*************************
	 *** Public crypto API ***
	 *************************/
	// Decrypts message into a raw string
	crypto.decryptWebsocketMessage = function(message) {
		var signaling_key = storage.getEncrypted("signaling_key"); //TODO: in crypto_storage
		var aes_key = signaling_key.substring(0, 32);
		var mac_key = signaling_key.substring(32, 32 + 20);

		var decodedMessage = new Uint8Array(base64DecToArr(getString(message)));
		if (decodedMessage[0] != 1)
			throw new Error("Got bad version number: " + decodedMessage[0]);

		var iv = decodedMessage.subarray(1, 1 + 16);
		var ciphertext = decodedMessage.subarray(1 + 16, decodedMessage.length - 10);
		var ivAndCipherText = decodedMessage.subarray(1, decodedMessage.length - 10);
		var mac = decodedMessage.subarray(decodedMessage.length - 10, decodedMessage.length);

		verifyMACWithVersionByte(ivAndCipherText, mac_key, mac);

		return decryptAESCBC(ciphertext, aes_key, iv);
	}

	crypto.handleIncomingPushMessageProto = function(proto, callback) {
		switch(proto.type) {
		case 0: //TYPE_MESSAGE_PLAINTEXT
			callback({message: decodePushMessageContentProtobuf(getString(proto.message)), pushMessage:proto});
			break;
		case 1: //TYPE_MESSAGE_CIPHERTEXT
			decryptWhisperMessage(proto.source, getString(proto.message), function(result) {
				callback({message: result, pushMessage: proto});
			});
			break;
		case 3: //TYPE_MESSAGE_PREKEY_BUNDLE
			if (proto.message.readUint8() != (2 << 4 | 2))
				throw new Error("Bad version byte");
			var preKeyProto = decodePreKeyWhisperMessageProtobuf(getString(proto.message));
			initSessionFromPreKeyWhisperMessage(proto.source, preKeyProto, function() {
				decryptWhisperMessage(proto.source, getString(preKeyProto.message), function(result) {
					callback({message: result, pushMessage: proto});
				});
			});
			break;
		}
	}

	// callback(encoded [PreKey]WhisperMessage)
	crypto.encryptMessageFor = function(deviceObject, pushMessageContent, callback) {
		var session = crypto_storage.getSession(deviceObject.encodedNumber);

		var doEncryptPushMessageContent = function(callback) {
			var msg = new WhisperMessageProtobuf();
			var plaintext = toArrayBuffer(pushMessageContent.encode());

			msg.ephemeralKey = toArrayBuffer(session.currentRatchet.ephemeralKeyPair.pubKey);
			var chain = session[getString(msg.ephemeralKey)];

			fillMessageKeys(chain, chain.counter + 1).then(function() {
				HKDF(chain.messageKeys[chain.chainKey.counter], '', "WhisperMessageKeys").then(function(keys) {
					delete chain.messageKeys[chain.chainKey.counter];
					msg.counter = chain.chainKey.counter;
					msg.previousCounter = session.currentRatchet.previousCounter;

					var iv = intToArrayBuffer(chain.counter);
					encryptAESCTR(plaintext, keys[0], iv).then(function(ciphertext) {
						msg.ciphertext = ciphertext;
						var encodedMsg = getString(msg.encode());

						calculateMACWithVersionByte(encodedMsg, keys[1], (2 << 4) | 2).then(function(mac) {
							var result = String.fromCharCode((2 << 4) | 2) + encodedMsg + mac.substring(0, 8);

							crypto_storage.saveSession(deviceObject.encodedNumber, session);
							callback(result);
						});
					});
				});
			});
		}

		var preKeyMsg = new PreKeyWhisperMessageProtobuf();
		preKeyMsg.identityKey = toArrayBuffer(crypto_storage.getStoredPubKey("identityKey"));
		preKeyMsg.preKeyId = deviceObject.preKeyId;
		preKeyMsg.registrationId = deviceObject.registrationId;

		if (session === undefined) {
			createNewKeyPair(false, function(baseKey) {
				preKeyMsg.baseKey = toArrayBuffer(baseKey.pubKey);
				initSession(true, baseKey, deviceObject.encodedNumber, deviceObject.identityKey, deviceObject.publicKey, function() {
					//TODO: Delete preKey info on first message received back
					session = crypto_storage.getSession(deviceObject.encodedNumber);
					session.pendingPreKey = baseKey.pubKey;
					doEncryptPushMessageContent(function(message) {
						preKeyMsg.message = toArrayBuffer(message);
						var result = String.fromCharCode((2 << 4) | 2) + getString(preKeyMsg.encode());
						callback({type: 3, body: result});
					});
				});
			});
		} else
			doEncryptPushMessageContent(function(message) {
				if (session.pendingPreKey !== undefined) {
					preKeyMsg.baseKey = toArrayBuffer(session.pendingPreKey);
					preKeyMsg.message = toArrayBuffer(message);
					var result = String.fromCharCode((2 << 4) | 2) + getString(preKeyMsg.encode());
					callback({type: 3, body: result});
				} else
					callback({type: 1, body: getString(message)});
			});
	}

	var GENERATE_KEYS_KEYS_GENERATED = 100;
	crypto.generateKeys = function(callback) {
		var identityKey = crypto_storage.getStoredPubKey("identityKey");
		var identityKeyCalculated = function(pubKey) {
			identityKey = pubKey;

			var firstKeyId = storage.getEncrypted("maxPreKeyId", -1) + 1;
			storage.putEncrypted("maxPreKeyId", firstKeyId + GENERATE_KEYS_KEYS_GENERATED);

			if (firstKeyId > 16777000)
				throw new Error("You crazy motherfucker");

			var keys = {};
			keys.keys = [];
			var keysLeft = GENERATE_KEYS_KEYS_GENERATED;
			for (var i = firstKeyId; i < firstKeyId + GENERATE_KEYS_KEYS_GENERATED; i++) {
				crypto_storage.getNewPubKeySTORINGPrivKey("preKey" + i, false, function(pubKey) {
					keys.keys[i] = {keyId: i, publicKey: pubKey, identityKey: identityKey};
					keysLeft--;
					if (keysLeft == 0) {
						// 0xFFFFFF == 16777215
						keys.lastResortKey = {keyId: 16777215, publicKey: crypto_storage.getStoredPubKey("preKey16777215"), identityKey: identityKey};//TODO: Rotate lastResortKey
						if (keys.lastResortKey.publicKey === undefined) {
							crypto_storage.getNewPubKeySTORINGPrivKey("preKey16777215", false, function(pubKey) {
								keys.lastResortKey.publicKey = pubKey;
								callback(keys);
							});
						} else
							callback(keys);
					}
				});
			}
		}
		if (identityKey === undefined)
			crypto_storage.getNewPubKeySTORINGPrivKey("identityKey", true, function(pubKey) { identityKeyCalculated(pubKey); });
		else
			identityKeyCalculated(identityKey);
	}

}( window.crypto = window.crypto || {}, jQuery ));


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
				var proto = decodeIncomingPushMessageProtobuf(plaintext);
				// After this point, a) decoding errors are not the server's fault, and
				// b) we should handle them gracefully and tell the user they received an invalid message
				console.log("Successfully decoded message with id: " + message.id);
				socket.send(JSON.stringify({type: 1, id: message.id}));
				crypto.handleIncomingPushMessageProto(proto, function(decrypted) {
					storeMessage(decrypted);
					message_callback(decrypted);
				}); // Decrypts/decodes/fills in fields/etc
			}).catch(function(e) {
				console.log("Error decoding message: " + e);
			});
		}
	};
}

// success_callback(identity_key), error_callback(error_msg)
function getKeysForNumber(number, success_callback, error_callback) {
	API.getKeysForNumber(number,
		function(response) {
			for (var i = 0; i < response.length; i++) {
				try {
					saveDeviceObject({
						encodedNumber: number + "." + response[i].deviceId,
						identityKey: response[i].identityKey,
						publicKey: response[i].publicKey,
						preKeyId: response[i].keyId,
						registrationId: response[i].registrationId
					});
				} catch (e) {
					error_callback(e);
					return;
				}
			}
			success_callback(response[0].identityKey);
		}, function(code) {
			error_callback("Error making HTTP request: " + code);
		});
}

// success_callback(server success/failure map), error_callback(error_msg)
// message == PushMessageContentProto (NOT STRING)
function sendMessageToDevices(number, deviceObjectList, message, success_callback, error_callback) {
	var jsonData = [];
	var relay = undefined;

	var doSend = function() {
		API.sendMessages(number, jsonData,
			function(result) {
				success_callback(result);
			}, function(code) {
				error_callback(code);
			}
		);
	}

	var addEncryptionFor;
	addEncryptionFor = function(i) {
		crypto.encryptMessageFor(deviceObjectList[i], message, function(encryptedMsg) {
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
				else if (relay != jsonData[i].relay) {
					error_callback("Mismatched relays for number " + number);
					return;
				}
			} else {
				if (relay === undefined)
					relay = "";
				else if (relay != "") {
					error_callback("Mismatched relays for number " + number);
					return;
				}
			}

			if (i+1 < deviceObjectList.length)
				addEncryptionFor(i+1);
			else
				doSend();
		});
//TODO: need to encrypt with session key?
	}
	addEncryptionFor(0);
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

	var registerError = function(number, message) {
		errors[errors.length] = { number: number, reason: message };
		numberCompleted();
	}

	var doSendMessage = function(number, devicesForNumber, message) {
		sendMessageToDevices(number, devicesForNumber, message, function(result) {
			successfulNumbers[successfulNumbers.length] = number;
			numberCompleted();
		}, function(error_code) {
			//TODO: Re-request keys for number here
			if (error_code == 410 || error_code == 409) {}
			registerError(number, message);
		});
	}

	for (var i = 0; i < numbers.length; i++) {
		var number = numbers[i];
		var devicesForNumber = getDeviceObjectListFromNumber(number);

		if (devicesForNumber.length == 0) {
			getKeysForNumber(number, function(identity_key) {
					devicesForNumber = getDeviceObjectListFromNumber(number);
					if (devicesForNumber.length == 0)
						registerError(number, "Failed to retreive new device keys for number " + number);
					else
						doSendMessage(number, devicesForNumber, message);
				}, function(error_msg) {
					registerError(number, "Failed to retreive new device keys for number " + number);
				});
		} else
			doSendMessage(number, devicesForNumber, message);
	}
}

function requestIdentityPrivKeyFromMasterDevice(number, identityKey) {
	sendMessageToDevices([getDeviceObject(getNumberFromString(number)) + ".1"],
						{message: "Identity Key request"}, function() {}, function() {});//TODO
}

