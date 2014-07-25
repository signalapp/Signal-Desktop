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

// Setup dumb test wrapper
var testsdiv = $('#tests');
var testsOutstanding = [];

var exclusiveRunning = -1;
var exclusiveTestsWaiting = [];

var maxTestId = 0;
var forceNextTestInverval;

var allTestsDefined = false;
function printTestsDone() {
	if (!allTestsDefined)
		return;
	for (var i = 0; i < maxTestId; i++)
		if (testsOutstanding[i] !== undefined)
			return;
	testsdiv.append('<p>All tests done</p>');
	window.clearInterval(forceNextTestInverval);
}

function startNextExclusiveTest() {
	for (var i = 0; i < maxTestId; i++) {
		if (exclusiveTestsWaiting[i] !== undefined) {
			exclusiveTestsWaiting[i]();
			return;
		}
	}
}

function TEST(func, name, exclusive) {
	if (exclusive == undefined)
		exculsive = false;

	var funcName = name === undefined ? func + "" : name;
	var testIndex = maxTestId;

	var exclusiveIndex = -1;
	if (exclusive && exclusiveRunning != -1)
		exclusiveIndex = maxTestId;

	maxTestId = maxTestId + 1;

	function resolve(result, error) {
		if (testsOutstanding[testIndex] == undefined)
			testsdiv.append('<p style="color: red;">' + funcName + ' called back multiple times</p>');
		else if (error !== undefined) {
			if (error && error.stack) {
				console.log(error.stack);
				testsdiv.append('<p style="color: red;">' + funcName + ' threw ' + error + '</p>');
			} else
				testsdiv.append('<p style="color: red;">' + funcName + ' threw non-Error: ' + error + '</p>');
		} else if (result === true)
			testsdiv.append('<p style="color: green;">' + funcName + ' passed</p>');
		else
			testsdiv.append('<p style="color: red;">' + funcName + ' returned ' + result + '</p>');
		delete testsOutstanding[testIndex];

		if (exclusive) {
			exclusiveRunning = -1;
			localStorage.clear();
			if (exclusiveIndex != -1)
				delete exclusiveTestsWaiting[exclusiveIndex];
			startNextExclusiveTest();
		}
		printTestsDone();
	}


	var runFunc = function() {
		if (exclusive) {
			exclusiveRunning = testIndex;
			localStorage.clear();
		}

		try {
			testsOutstanding[testIndex] = funcName;
			func().then(resolve).catch(function(e) { resolve(null, e); });
		} catch (e) {
			resolve(null, e);
		}
	}

	if (!exclusive || exclusiveRunning == -1)
		runFunc();
	else
		exclusiveTestsWaiting[exclusiveIndex] = runFunc;
}

textsecure.registerOnLoadFunction(function() {
	TEST(function() {
		var b = new ArrayBuffer(3);
		var a = new Uint8Array(b);
		a[0] = 0;
		a[1] = 255;
		a[2] = 128;
		return Promise.resolve(getString(b) == "\x00\xff\x80");
	}, "ArrayBuffer->String conversion");

	// Basic sanity-checks on the crypto library
	TEST(function() {
		var PushMessageProto = dcodeIO.ProtoBuf.loadProtoFile("protos/IncomingPushMessageSignal.proto").build("textsecure.PushMessageContent");
		var IncomingMessageProto = dcodeIO.ProtoBuf.loadProtoFile("protos/IncomingPushMessageSignal.proto").build("textsecure.IncomingPushMessageSignal");

		var text_message = new PushMessageProto();
		text_message.body = "Hi Mom";
		var server_message = {type: 4, // unencrypted
						source: "+19999999999", timestamp: 42, message: text_message.encode() };

		return textsecure.crypto.handleIncomingPushMessageProto(server_message).then(function(message) {
			return (message.body == text_message.body &&
					message.attachments.length == text_message.attachments.length &&
					text_message.attachments.length == 0);
		});
	}, 'Unencrypted PushMessageProto "decrypt"', true);

	TEST(function() {
		return textsecure.crypto.generateKeys().then(function() {
			if (textsecure.storage.getEncrypted("25519KeyidentityKey") === undefined)
				return false;
			if (textsecure.storage.getEncrypted("25519KeysignedKey0") === undefined)
				return false;

			for (var i = 0; i < 100; i++)
				if (textsecure.storage.getEncrypted("25519KeypreKey" + i) === undefined)
					return false;

			var origIdentityKey = getString(textsecure.storage.getEncrypted("25519KeyidentityKey").privKey);
			return textsecure.crypto.generateKeys().then(function() {
				if (textsecure.storage.getEncrypted("25519KeyidentityKey") === undefined ||
						getString(textsecure.storage.getEncrypted("25519KeyidentityKey").privKey) != origIdentityKey)
					return false;

				if (textsecure.storage.getEncrypted("25519KeysignedKey0") === undefined ||
						textsecure.storage.getEncrypted("25519KeysignedKey1") === undefined)
					return false;

				for (var i = 0; i < 200; i++)
					if (textsecure.storage.getEncrypted("25519KeypreKey" + i) === undefined)
						return false;

				return textsecure.crypto.generateKeys().then(function() {
					if (textsecure.storage.getEncrypted("25519KeyidentityKey") === undefined ||
							getString(textsecure.storage.getEncrypted("25519KeyidentityKey").privKey) != origIdentityKey)
						return false;

					if (textsecure.storage.getEncrypted("25519KeysignedKey0") !== undefined ||
							textsecure.storage.getEncrypted("25519KeysignedKey1") === undefined ||
							textsecure.storage.getEncrypted("25519KeysignedKey2") === undefined)
						return false;

					for (var i = 0; i < 300; i++)
						if (textsecure.storage.getEncrypted("25519KeypreKey" + i) === undefined)
							return false;

					return true;
				});
			});
		});
	}, "Test Identity/Pre Key Creation", true);

	TEST(function() {
		// These are just some random curve25519 test vectors I found online (with a version byte prepended to pubkeys)
		var alice_priv = hexToArrayBuffer("77076d0a7318a57d3c16c17251b26645df4c2f87ebc0992ab177fba51db92c2a");
		var alice_pub  = hexToArrayBuffer("058520f0098930a754748b7ddcb43ef75a0dbf3a0d26381af4eba4a98eaa9b4e6a");
		var bob_priv   = hexToArrayBuffer("5dab087e624a8a4b79e17f8b83800ee66f3bb1292618b6fd1c2f8b27ff88e0eb");
		var bob_pub    = hexToArrayBuffer("05de9edb7d7b7dc1b4d35b61c2ece435373f8343c85b78674dadfc7e146f882b4f");
		var shared_sec = hexToArrayBuffer("4a5d9d5ba4ce2de1728e3bf480350f25e07e21c947d19e3376f09b3c1e161742");

		return textsecure.crypto.testing_only.privToPub(alice_priv, true).then(function(aliceKeyPair) {
			var target = new Uint8Array(alice_priv.slice(0));
			target[0] &= 248;
			target[31] &= 127;
			target[31] |= 64;
			if (getString(aliceKeyPair.privKey) != getString(target))
				return false;

			return textsecure.crypto.testing_only.privToPub(bob_priv, true).then(function(bobKeyPair) {
				var target = new Uint8Array(bob_priv.slice(0));
				target[0] &= 248;
				target[31] &= 127;
				target[31] |= 64;
				if (getString(bobKeyPair.privKey) != getString(target))
					return false;

				if (getString(aliceKeyPair.pubKey) != getString(alice_pub))
					return false;

				if (getString(bobKeyPair.pubKey) != getString(bob_pub))
					return false;

				return textsecure.crypto.testing_only.ECDHE(bobKeyPair.pubKey, aliceKeyPair.privKey).then(function(ss) {
					if (getString(ss) != getString(shared_sec))
						return false;

					return textsecure.crypto.testing_only.ECDHE(aliceKeyPair.pubKey, bobKeyPair.privKey).then(function(ss) {
						if (getString(ss) != getString(shared_sec))
							return false;
						else
							return true;
					});
				});
			});
		});
	}, "Simple Curve25519 test vectors");

	TEST(function() {
		// Some self-generated test vectors
		var priv = hexToArrayBuffer("48a8892cc4e49124b7b57d94fa15becfce071830d6449004685e387c62409973");
		var pub  = hexToArrayBuffer("0555f1bfede27b6a03e0dd389478ffb01462e5c52dbbac32cf870f00af1ed9af3a");
		var msg  = hexToArrayBuffer("617364666173646661736466");
		var sig  = hexToArrayBuffer("2bc06c745acb8bae10fbc607ee306084d0c28e2b3bb819133392473431291fd0"+
								"dfa9c7f11479996cf520730d2901267387e08d85bbf2af941590e3035a545285");

		return textsecure.crypto.testing_only.privToPub(priv, false).then(function(pubCalc) {
			//if (getString(pub) != getString(pubCalc))
			//	return false;

			return textsecure.crypto.testing_only.Ed25519Sign(priv, msg).then(function(sigCalc) {
				if (getString(sig) != getString(sigCalc))
					return false;

				return textsecure.crypto.testing_only.Ed25519Verify(pub, msg, sig).then(function() {
					return true;
				});
			});
		});
	}, "Simple Ed25519 tests");

	TEST(function() {
		var IKM = new Uint8Array(new ArrayBuffer(22));
		for (var i = 0; i < 22; i++)
			IKM[i] = 11;

		var salt = new Uint8Array(new ArrayBuffer(13));
		for (var i = 0; i < 13; i++)
			salt[i] = i;

		var info = new Uint8Array(new ArrayBuffer(10));
		for (var i = 0; i < 10; i++)
			info[i] = 240 + i;

		return textsecure.crypto.testing_only.HKDF(IKM.buffer, salt.buffer, info.buffer).then(function(OKM){
			var T1 = hexToArrayBuffer("3cb25f25faacd57a90434f64d0362f2a2d2d0a90cf1a5a4c5db02d56ecc4c5bf");
			var T2 = hexToArrayBuffer("34007208d5b887185865");
			return (getString(OKM[0]) == getString(T1) && getString(OKM[1]).substring(0, 10) == getString(T2));
		});
	}, "HMAC RFC5869 Test vectors");

	var runAxolotlTest = function(v) {
		var origCreateNewKeyPair = textsecure.crypto.testing_only.createNewKeyPair;
		var doStep;
		var stepDone;

		stepDone = function(res) {
			if (!res || privKeyQueue.length != 0 || Object.keys(getKeysForNumberMap).length != 0 || Object.keys(messagesSentMap).length != 0) {
				textsecure.crypto.testing_only.createNewKeyPair = origCreateNewKeyPair;
				return false;
			} else if (step == v.length) {
				textsecure.crypto.testing_only.createNewKeyPair = origCreateNewKeyPair;
				return true;
			} else
				return doStep().then(stepDone);
		}

		var privKeyQueue = [];
		textsecure.crypto.testing_only.createNewKeyPair = function(isIdentity) {
			if (privKeyQueue.length == 0 || isIdentity)
				throw new Error('Out of private keys');
			else {
				var privKey = privKeyQueue.shift();
				return textsecure.crypto.testing_only.privToPub(privKey, false).then(function(keyPair) {
					var a = btoa(getString(keyPair.privKey)); var b = btoa(getString(privKey));
					if (getString(keyPair.privKey) != getString(privKey))
						throw new Error('Failed to rederive private key!');
					else
						return keyPair;
				});
			}
		}

		var step = 0;
		var doStep = function() {
			var data = v[step][1];

			switch(v[step++][0]) {
			case "receiveMessage":
				var postLocalKeySetup = function() {
					if (data.newEphemeralKey !== undefined)
						privKeyQueue.push(data.newEphemeralKey);

					var message = new textsecure.protos.IncomingPushMessageProtobuf();
					message.type = data.type;
					message.source = "SNOWDEN";
					message.message = data.message;
					message.sourceDevice = 1;
					return textsecure.crypto.handleIncomingPushMessageProto(textsecure.protos.decodeIncomingPushMessageProtobuf(getString(message.encode()))).then(function(res) {
						if (data.expectTerminateSession)
							return res.flags == textsecure.protos.PushMessageContentProtobuf.Flags.END_SESSION;
						return res.body == data.expectedSmsText;
					});
				}

				if (data.ourIdentityKey !== undefined)
					return textsecure.crypto.testing_only.privToPub(data.ourIdentityKey, true).then(function(keyPair) {
						textsecure.storage.putEncrypted("25519KeyidentityKey", keyPair);
						return textsecure.crypto.testing_only.privToPub(data.ourPreKey, false).then(function(keyPair) {
							textsecure.storage.putEncrypted("25519KeypreKey" + data.preKeyId, keyPair);
							return textsecure.crypto.testing_only.privToPub(data.ourSignedPreKey, false).then(function(keyPair) {
								textsecure.storage.putEncrypted("25519KeysignedKey" + data.signedPreKeyId, keyPair);
								return postLocalKeySetup();
							});
						});
					});
				else
					return postLocalKeySetup();

			case "sendMessage":
				var postLocalKeySetup = function() {
					if (data.registrationId !== undefined)
						textsecure.storage.putUnencrypted("registrationId", data.registrationId);

					if (data.getKeys !== undefined)
						getKeysForNumberMap["SNOWDEN"] = data.getKeys;

					var checkMessage = function() {
						var msg = messagesSentMap["SNOWDEN.1"];
						delete messagesSentMap["SNOWDEN.1"];
						//XXX: This should be all we do: isEqual(data.expectedCiphertext, msg.body, false);
						if (msg.type == 1) {
							var expected = getString(data.expectedCiphertext);
							var decoded = textsecure.protos.decodeWhisperMessageProtobuf(expected.substring(1, expected.length - 8));
							var result = getString(msg.body);
							return getString(decoded.encode()) == result.substring(1, result.length - 8);
						} else {
							var decoded = textsecure.protos.decodePreKeyWhisperMessageProtobuf(getString(data.expectedCiphertext).substr(1));
							var result = getString(msg.body).substring(1);
							return getString(decoded.encode()) == result;
						}
					}

					if (data.endSession)
						return textsecure.messaging.closeSession("SNOWDEN").then(checkMessage);
					else
						return textsecure.messaging.sendMessageToNumber("SNOWDEN", data.smsText, []).then(checkMessage);
				}

				if (data.ourBaseKey !== undefined)
					privKeyQueue.push(data.ourBaseKey);
				if (data.ourEphemeralKey !== undefined)
					privKeyQueue.push(data.ourEphemeralKey);

				if (data.ourIdentityKey !== undefined)
					return textsecure.crypto.testing_only.privToPub(data.ourIdentityKey, true).then(function(keyPair) {
						textsecure.storage.putEncrypted("25519KeyidentityKey", keyPair);
						return postLocalKeySetup();
					});
				else
					return postLocalKeySetup();

			default:
				return Promise.resolve(false);
			}
		}
		return doStep().then(stepDone);
	}

	for (index in axolotlTestVectors) {
		var _ = function(i) {
			TEST(function() {
				return runAxolotlTest(axolotlTestVectors[i].vectors);
			}, axolotlTestVectors[i].name, true);
		}(index);
	}

	TEST(function() {
		var key = hexToArrayBuffer('6f35628d65813435534b5d67fbdb54cb33403d04e843103e6399f806cb5df95febbdd61236f33245');
		var input = hexToArrayBuffer('752cff52e4b90768558e5369e75d97c69643509a5e5904e0a386cbe4d0970ef73f918f675945a9aefe26daea27587e8dc909dd56fd0468805f834039b345f855cfe19c44b55af241fff3ffcd8045cd5c288e6c4e284c3720570b58e4d47b8feeedc52fd1401f698a209fccfa3b4c0d9a797b046a2759f82a54c41ccd7b5f592b');
		var mac = getString(hexToArrayBuffer('05d1243e6465ed9620c9aec1c351a186'));
		return window.crypto.subtle.sign({name: "HMAC", hash: "SHA-256"}, key, input).then(function(result) {
			return getString(result).substring(0, mac.length) === mac;
		});
	}, "HMAC SHA-256", false);

	TEST(function() {
		var key = hexToArrayBuffer('2b7e151628aed2a6abf7158809cf4f3c');
		var counter = hexToArrayBuffer('f0f1f2f3f4f5f6f7f8f9fafbfcfdfeff');
		var plaintext = hexToArrayBuffer('6bc1bee22e409f96e93d7e117393172a');
		var ciphertext = hexToArrayBuffer('874d6191b620e3261bef6864990db6ce');
		return window.crypto.subtle.encrypt({name: "AES-CTR", counter: counter}, key, plaintext).then(function(result) {
			return getString(result) === getString(ciphertext);
		});
	}, "Encrypt AES-CTR", false);

	TEST(function() {
		var key = hexToArrayBuffer('2b7e151628aed2a6abf7158809cf4f3c');
		var counter = hexToArrayBuffer('f0f1f2f3f4f5f6f7f8f9fafbfcfdfeff');
		var plaintext = hexToArrayBuffer('6bc1bee22e409f96e93d7e117393172a');
		var ciphertext = hexToArrayBuffer('874d6191b620e3261bef6864990db6ce');
		return window.crypto.subtle.decrypt({name: "AES-CTR", counter: counter}, key, ciphertext).then(function(result) {
			return getString(result) === getString(plaintext);
		});
	}, "Decrypt AES-CTR", false);

	TEST(function() {
		var key = hexToArrayBuffer('603deb1015ca71be2b73aef0857d77811f352c073b6108d72d9810a30914dff4');
		var iv = hexToArrayBuffer('000102030405060708090a0b0c0d0e0f');
		var plaintext  = hexToArrayBuffer('6bc1bee22e409f96e93d7e117393172aae2d8a571e03ac9c9eb76fac45af8e5130c81c46a35ce411e5fbc1191a0a52eff69f2445df4f9b17ad2b417be66c3710');
		var ciphertext = hexToArrayBuffer('f58c4c04d6e5f1ba779eabfb5f7bfbd69cfc4e967edb808d679f777bc6702c7d39f23369a9d9bacfa530e26304231461b2eb05e2c39be9fcda6c19078c6a9d1b3f461796d6b0d6b2e0c2a72b4d80e644');
		return window.crypto.subtle.decrypt({name: "AES-CBC", iv: iv}, key, ciphertext).then(function(result) {
			return getString(result) === getString(plaintext);
		});
	}, "Decrypt AES-CBC", false);

	// Setup test timeouts
	forceNextTestInverval = window.setInterval(function() {
		for (var i = 0; i < maxTestId; i++) {
			if (testsOutstanding[i] !== undefined) {
				testsdiv.append('<p style="color: red;">' + testsOutstanding[i] + ' timed out</p>');
				if (exclusiveRunning == i) {
					testsdiv.append('<p style="color: red;">WARNING: exclusive test left running, further results may be unreliable.</p>');
					delete exclusiveTestsWaiting[i];
				}
			}
			delete testsOutstanding[i];
		}
		printTestsDone();

		startNextExclusiveTest();
	}, 10000);

	allTestsDefined = true;
	printTestsDone();
});
