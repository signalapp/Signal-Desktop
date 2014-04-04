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

// Setup dumb test wrapper
var testsdiv = $('#tests');
var testsOutstanding = [];

var exclusiveRunning = -1;
var exclusiveTestsWaiting = [];

var maxTestId = 0;

function startNextExclusiveTest() {
	for (var i = 0; i < maxTestId; i++) {
		if (exclusiveTestsWaiting[i] !== undefined) {
			exclusiveTestsWaiting[i]();
			break;
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

	function callback(result) {
		if (testsOutstanding[testIndex] == undefined)
			testsdiv.append('<p style="color: red;">' + funcName + ' called back multiple times</p>');
		else if (result)
			testsdiv.append('<p style="color: green;">' + funcName + ' passed</p>');
		else
			testsdiv.append('<p style="color: red;">' + funcName + ' returned false</p>');
		delete testsOutstanding[testIndex];

		if (exclusive) {
			exclusiveRunning = -1;
			localStorage.clear();
			if (exclusiveIndex != -1)
				delete exclusiveTestsWaiting[exclusiveIndex];
			startNextExclusiveTest();
		}
	}


	var runFunc = function() {
		if (exclusive) {
			exclusiveRunning = testIndex;
			localStorage.clear();
		}

		try {
			testsOutstanding[testIndex] = funcName;
			func(callback);
		} catch (e) {
			console.log(e.stack);
			testsdiv.append('<p style="color: red;">' + funcName + ' threw ' + e + '</p>');
		}
	}

	if (!exclusive || exclusiveRunning == -1)
		runFunc();
	else
		exclusiveTestsWaiting[exclusiveIndex] = runFunc;
}

function hexToArrayBuffer(str) {
	var ret = new ArrayBuffer(str.length / 2);
	var array = new Uint8Array(ret);
	for (var i = 0; i < str.length/2; i++)
		array[i] = parseInt(str.substr(i*2, 2), 16);
	return ret;
}

registerOnLoadFunction(function() {
	localStorage.clear();

	// Random tests to check my JS knowledge
	TEST(function(callback) { callback(!objectContainsKeys({})); });
	TEST(function(callback) { callback(objectContainsKeys({ a: undefined })); });
	TEST(function(callback) { callback(objectContainsKeys({ a: null })); });

	TEST(function(callback) {
		var b = new ArrayBuffer(3);
		var a = new Uint8Array(b);
		a[0] = 0;
		a[1] = 255;
		a[2] = 128;
		callback(getString(b) == "\x00\xff\x80");
	}, "ArrayBuffer->String conversion");

	// Basic sanity-checks on the crypto library
	TEST(function(callback) {
		var PushMessageProto = dcodeIO.ProtoBuf.loadProtoFile("protos/IncomingPushMessageSignal.proto").build("textsecure.PushMessageContent");
		var IncomingMessageProto = dcodeIO.ProtoBuf.loadProtoFile("protos/IncomingPushMessageSignal.proto").build("textsecure.IncomingPushMessageSignal");

		var text_message = new PushMessageProto();
		text_message.body = "Hi Mom";
		var server_message = {type: 0, // unencrypted
						source: "+19999999999", timestamp: 42, message: text_message.encode() };

		crypto.handleIncomingPushMessageProto(server_message, function(message) {
			callback(message.message.body == text_message.body &&
					message.message.attachments.length == text_message.attachments.length &&
					text_message.attachments.length == 0);
		});
	}, 'Unencrypted PushMessageProto "decrypt"', true);

	TEST(function(callback) {
		crypto.generateKeys(function() {
			callback(true);
		});
	}, "Test simple create key", true);

	TEST(function(callback) {
		// These are just some random curve25519 test vectors I found online (with a version byte prepended to pubkeys)
		var alice_priv = hexToArrayBuffer("77076d0a7318a57d3c16c17251b26645df4c2f87ebc0992ab177fba51db92c2a");
		var alice_pub  = hexToArrayBuffer("058520f0098930a754748b7ddcb43ef75a0dbf3a0d26381af4eba4a98eaa9b4e6a");
		var bob_priv   = hexToArrayBuffer("5dab087e624a8a4b79e17f8b83800ee66f3bb1292618b6fd1c2f8b27ff88e0eb");
		var bob_pub    = hexToArrayBuffer("05de9edb7d7b7dc1b4d35b61c2ece435373f8343c85b78674dadfc7e146f882b4f");
		var shared_sec = hexToArrayBuffer("4a5d9d5ba4ce2de1728e3bf480350f25e07e21c947d19e3376f09b3c1e161742");

		crypto_tests.privToPub(alice_priv, true, function(aliceKeyPair) {
			var target = new Uint8Array(alice_priv.slice(0));
			target[0] &= 248;
			target[31] &= 127;
			target[31] |= 64;
			if (String.fromCharCode.apply(null, new Uint8Array(aliceKeyPair.privKey)) != String.fromCharCode.apply(null, target))
				callback(false);

			crypto_tests.privToPub(bob_priv, true, function(bobKeyPair) {
				var target = new Uint8Array(bob_priv.slice(0));
				target[0] &= 248;
				target[31] &= 127;
				target[31] |= 64;
				if (String.fromCharCode.apply(null, new Uint8Array(bobKeyPair.privKey)) != String.fromCharCode.apply(null, target))
					callback(false);

				if (String.fromCharCode.apply(null, new Uint8Array(aliceKeyPair.pubKey)) != String.fromCharCode.apply(null, new Uint8Array(alice_pub)))
					callback(false);

				if (String.fromCharCode.apply(null, new Uint8Array(bobKeyPair.pubKey)) != String.fromCharCode.apply(null, new Uint8Array(bob_pub)))
					callback(false);

				crypto_tests.ECDHE(bobKeyPair.pubKey, aliceKeyPair.privKey, function(ss) {
					if (String.fromCharCode.apply(null, new Uint16Array(ss)) != String.fromCharCode.apply(null, new Uint16Array(shared_sec)))
						callback(false);

					crypto_tests.ECDHE(aliceKeyPair.pubKey, bobKeyPair.privKey, function(ss) {
						if (String.fromCharCode.apply(null, new Uint16Array(ss)) != String.fromCharCode.apply(null, new Uint16Array(shared_sec)))
							callback(false);
						else
							callback(true);
					});
				});
			});
		});
	}, "Simple Curve25519 test vector");

	// TextSecure implements a slightly tweaked version of RFC 5869 and thus this test fails
	// If you tweak the HKDF as noted in the comment there, this test passes
	/*TEST(function(callback) {
		var IKM = new Uint8Array(new ArrayBuffer(22));
		for (var i = 0; i < 22; i++)
			IKM[i] = 11;

		var salt = new Uint8Array(new ArrayBuffer(13));
		for (var i = 0; i < 13; i++)
			salt[i] = i;

		var info = new Uint8Array(new ArrayBuffer(10));
		for (var i = 0; i < 10; i++)
			info[i] = 240 + i;

		crypto_tests.HKDF(IKM, salt, info).then(function(OKM){
			var T1 = hexToArrayBuffer("3cb25f25faacd57a90434f64d0362f2a2d2d0a90cf1a5a4c5db02d56ecc4c5bf");
			var T2 = hexToArrayBuffer("34007208d5b887185865");
			callback(getString(OKM[0]) == getString(T1) && getString(OKM[1]).substring(0, 10) == getString(T2));
		}, console.log);
	}, "HMAC RFC5869 Test vectors");*/

	var axolotlTwoPartyTestVectorsAlice = [
		["sendMessage",
			{
				smsText: "A             ",
				ourBaseKey: hexToArrayBuffer('192b4892aa2e4cff1293999dc7c367874456c4d920aae7d9d42e5e62c965546c'),
				ourEphemeralKey: hexToArrayBuffer('f12704787bab04a3cf544ebd9d421b6fe36147519eb5afa7c90e3fb67c141e64'),
				ourIdentityKey: hexToArrayBuffer('a05fd14abb42ff393004eee526e3167441ee51021c6d801b784720c15637747c'),
				theirPreKey: hexToArrayBuffer('05fee424a5b6ccb717d85ef2207e2057ab1144c40afe89cdc80e9c424dd90c146e'),
				theirPreKeyId: 13845842,
				theirRegistrationId: 11593,//TODO: Figure out wtf this is for
				theirIdentityKey: hexToArrayBuffer('05276e4df34557386f67df38b708eeddb1a8924e0428b9eefdc9213c3e8927cc7d'),
				//expectedPlaintext: hexToArrayBuffer('0a0e4120202020202020202020202020'),
				//expectedCounter: 0,
				expectedCiphertext: hexToArrayBuffer('2208d28acd061221059ab4e844771bfeb96382edac5f80e757a1109b5611c770b2ba9f28b363d7c2541a2105bd61aea7fa5304f4dc914892bc3795812cda8bb90b73de9920e22c609cf0ec4e2242220a21058c0c357a3a25e6da46b0186d93fec31d5b86a4ac4973742012d8e9de2346be161000180022104bd27ab87ee151d71cdfe89828050ef4b05bddfb56da491728c95a'),
			}],
		["sendMessage",
			{
				smsText: "B             ",
				//expectedPlaintext: hexToArrayBuffer('0a0e4220202020202020202020202020'),
				//expectedCounter: 1,
				expectedCiphertext: hexToArrayBuffer('2208d28acd061221059ab4e844771bfeb96382edac5f80e757a1109b5611c770b2ba9f28b363d7c2541a2105bd61aea7fa5304f4dc914892bc3795812cda8bb90b73de9920e22c609cf0ec4e2242220a21058c0c357a3a25e6da46b0186d93fec31d5b86a4ac4973742012d8e9de2346be16100118002210b40da85e4998984b4bac1748045b3661f46657badd576b4128c95a'),
			}],
		["receiveMessage",
			{
				message: hexToArrayBuffer('220a2105edf6feeea8ee95f4b227453d5942d15731cb7a962eff6d04706860a4d577476f100018ffffffff0f22032a53da435b5477336965c6'),
				type: 1,
				newEphemeralKey: hexToArrayBuffer('a92a28cf21fb48745ebf68b425a1811476fed69f8623ff5941fd4e547ee4027c'),
				//expectedPlaintext: hexToArrayBuffer(''),
				expectedSmsText: "C",
			}],
		["receiveMessage",
			{
				message: hexToArrayBuffer('220a2105edf6feeea8ee95f4b227453d5942d15731cb7a962eff6d04706860a4d577476f100118ffffffff0f2203a439d199228e124820c28b'),
				type: 1,
				//expectedPlaintext: hexToArrayBuffer(''),
				expectedSmsText: "D",
			}],
		["sendMessage",
			{
				smsText: "E",
				//expectedPlaintext: hexToArrayBuffer('0a0145'),
				//expectedCounter: 0,
				expectedCiphertext: hexToArrayBuffer('220a2105f94173eeb7ff19ab9196461d596324385611fadef0ca29592cc182d92eb653281000180122031b67b3e2c43b9a672c9cb0'),
			}],
		];

	var axolotlTwoPartyTestVectorsBob = [
		["receiveMessage",
			{
				message: hexToArrayBuffer('2208d28acd061221059ab4e844771bfeb96382edac5f80e757a1109b5611c770b2ba9f28b363d7c2541a2105bd61aea7fa5304f4dc914892bc3795812cda8bb90b73de9920e22c609cf0ec4e2242220a21058c0c357a3a25e6da46b0186d93fec31d5b86a4ac4973742012d8e9de2346be161000180022104bd27ab87ee151d71cdfe89828050ef4b05bddfb56da491728c95a'),
				type: 3,
				ourPreKey: hexToArrayBuffer('799706c9a19c663b6970690beccb5ffdc55b9f592f1dcbcd954f3662842c076b'),
				preKeyId: 13845842,
				ourIdentityKey: hexToArrayBuffer('5024f863ed4a17505a5588cb464aa3cb349201f786e6f871a22cbed1ea6dd97c'),
				newEphemeralKey: hexToArrayBuffer('d1d52b5a4403c32e81bc242b10502ad222ed47af16ba6548496217416c934252'),
				//expectedPlaintext: hexToArrayBuffer(''),
				expectedSmsText: "A             ",
			}],
		["receiveMessage",
			{
				message: hexToArrayBuffer('2208d28acd061221059ab4e844771bfeb96382edac5f80e757a1109b5611c770b2ba9f28b363d7c2541a2105bd61aea7fa5304f4dc914892bc3795812cda8bb90b73de9920e22c609cf0ec4e2242220a21058c0c357a3a25e6da46b0186d93fec31d5b86a4ac4973742012d8e9de2346be16100118002210b40da85e4998984b4bac1748045b3661f46657badd576b4128c95a'),
				type: 3,
				//expectedPlaintext: hexToArrayBuffer(''),
				expectedSmsText: "B             ",
			}],
		["sendMessage",
			{
				smsText: "C",
				//expectedPlaintext: hexToArrayBuffer('0a0143'),
				//expectedCounter: 0,
				expectedCiphertext: hexToArrayBuffer('220a2105edf6feeea8ee95f4b227453d5942d15731cb7a962eff6d04706860a4d577476f100018ffffffff0f22032a53da435b5477336965c6'),
			}],
		["sendMessage",
			{
				smsText: "D",
				//expectedPlaintext: hexToArrayBuffer('0a0144'),
				//expectedCounter: 1,
				expectedCiphertext: hexToArrayBuffer('220a2105edf6feeea8ee95f4b227453d5942d15731cb7a962eff6d04706860a4d577476f100118ffffffff0f2203a439d199228e124820c28b'),
			}],
		["receiveMessage",
			{
				message: hexToArrayBuffer('220a2105f94173eeb7ff19ab9196461d596324385611fadef0ca29592cc182d92eb653281000180122031b67b3e2c43b9a672c9cb0'),
				type: 1,
				newEphemeralKey: hexToArrayBuffer('c1ad88addc5a74b0028e669c70d2860dfdd315af542ebd7394921d91f5cd5558'),
				expectedSmsText: "E",
			}],
		];

	var axolotlTestVectors = function(v, remoteDevice, callback) {
		var origCreateNewKeyPair = crypto_tests.createNewKeyPair;
		var doStep;

		var stepDone = function(res) {
			if (!res || privKeyQueue.length != 0) {
				crypto_tests.createNewKeyPair = origCreateNewKeyPair;
				callback(false);
			} else if (step == v.length) {
				crypto_tests.createNewKeyPair = origCreateNewKeyPair;
				callback(true);
			} else
				doStep();
		}

		var privKeyQueue = [];
		crypto_tests.createNewKeyPair = function(isIdentity, callback) {
			if (privKeyQueue.length == 0 || isIdentity)
				stepDone(false);
			else {
				var privKey = privKeyQueue.shift();
				crypto_tests.privToPub(privKey, false, function(keyPair) {
					var a = btoa(getString(keyPair.privKey)); var b = btoa(getString(privKey));
					if (getString(keyPair.privKey) != getString(privKey))
						stepDone(false);
					else
						callback(keyPair);
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

					var message = new IncomingPushMessageProtobuf();
					message.type = data.type;
					message.source = remoteDevice.encodedNumber;
					message.message = data.message;
					crypto.handleIncomingPushMessageProto(decodeIncomingPushMessageProtobuf(getString(message.encode())), function(res) {
						stepDone(res.message.body == data.expectedSmsText);
					});
				}

				if (data.ourIdentityKey !== undefined)
					crypto_tests.privToPub(data.ourIdentityKey, true, function(keyPair) {
						storage.putEncrypted("25519KeyidentityKey", keyPair);
						crypto_tests.privToPub(data.ourPreKey, false, function(keyPair) {
							storage.putEncrypted("25519KeypreKey" + data.preKeyId, keyPair);
							postLocalKeySetup();
						});
					});
				else
					postLocalKeySetup();

				break;
			case "sendMessage":
				var postLocalKeySetup = function() {
					if (data.theirIdentityKey !== undefined)
						remoteDevice.identityKey = data.theirIdentityKey;
					if (data.theirPreKey !== undefined) {
						remoteDevice.publicKey = data.theirPreKey;
						remoteDevice.preKeyId = data.theirPreKeyId;
						remoteDevice.registrationId = data.theirRegistrationId;
					}

					var message = new PushMessageContentProtobuf();
					message.body = data.smsText;

					crypto.encryptMessageFor(remoteDevice, message, function(res) {
						//XXX: This should be all we do: stepDone(getString(data.expectedCiphertext) == getString(res.body));
						if (res.type == 1) { //XXX: This should be used for everything...
							var expectedString = getString(data.expectedCiphertext);
							var decoded = decodeWhisperMessageProtobuf(expectedString.substring(1, expectedString.length - 8));
							var result = getString(res.body);
							stepDone(getString(decoded.encode()) == result.substring(1, result.length - 8));
							return;
						} else {
							var decoded = decodePreKeyWhisperMessageProtobuf(getString(data.expectedCiphertext).substr(1));
							var result = getString(res.body).substring(1);
							stepDone(getString(decoded.encode()) == result);
						}
					});
				}

				if (data.ourBaseKey !== undefined)
					privKeyQueue.push(data.ourBaseKey);
				if (data.ourEphemeralKey !== undefined)
					privKeyQueue.push(data.ourEphemeralKey);

				if (data.ourIdentityKey !== undefined)
					crypto_tests.privToPub(data.ourIdentityKey, true, function(keyPair) {
						storage.putEncrypted("25519KeyidentityKey", keyPair);
						postLocalKeySetup();
					});
				else
					postLocalKeySetup();

				break;
			default:
				stepDone(false);
			}
		}
		doStep();
	}

	TEST(function(callback) {
		axolotlTestVectors(axolotlTwoPartyTestVectorsAlice, { encodedNumber: "BOB" }, callback);
	}, "Standard Axolotl Test Vectors as Alice", true);

	TEST(function(callback) {
		var t = axolotlTwoPartyTestVectorsAlice[2][1];
		axolotlTwoPartyTestVectorsAlice[2][1] = axolotlTwoPartyTestVectorsAlice[3][1];
		axolotlTwoPartyTestVectorsAlice[2][1].newEphemeralKey = t.newEphemeralKey;
		axolotlTwoPartyTestVectorsAlice[3][1] = t;
		delete axolotlTwoPartyTestVectorsAlice[3][1]['newEphemeralKey'];
		axolotlTestVectors(axolotlTwoPartyTestVectorsAlice, { encodedNumber: "BOB" }, callback);
	}, "Shuffled Axolotl Test Vectors as Alice", true);

	TEST(function(callback) {
		axolotlTestVectors(axolotlTwoPartyTestVectorsBob, { encodedNumber: "ALICE" }, callback);
	}, "Standard Axolotl Test Vectors as Bob", true);

	TEST(function(callback) {
		var v0 = axolotlTwoPartyTestVectorsBob[0][1];
		var v1 = axolotlTwoPartyTestVectorsBob[1][1];

		axolotlTwoPartyTestVectorsBob[0][1] = v1;
		axolotlTwoPartyTestVectorsBob[0][1].ourPreKey = v0.ourPreKey;
		axolotlTwoPartyTestVectorsBob[0][1].preKeyId = v0.preKeyId;
		axolotlTwoPartyTestVectorsBob[0][1].ourIdentityKey = v0.ourIdentityKey;
		axolotlTwoPartyTestVectorsBob[0][1].newEphemeralKey = v0.newEphemeralKey;

		axolotlTwoPartyTestVectorsBob[1][1] = { message: v0.message, type: v0.type, expectedSmsText: v0.expectedSmsText };
		axolotlTestVectors(axolotlTwoPartyTestVectorsBob, { encodedNumber: "ALICE" }, callback);
	}, "Shuffled Axolotl Test Vectors as Bob", true);

	TEST(function(callback) {
		var key = getString(hexToArrayBuffer('6f35628d65813435534b5d67fbdb54cb33403d04e843103e6399f806cb5df95febbdd61236f33245'));
		var input = getString(hexToArrayBuffer('752cff52e4b90768558e5369e75d97c69643509a5e5904e0a386cbe4d0970ef73f918f675945a9aefe26daea27587e8dc909dd56fd0468805f834039b345f855cfe19c44b55af241fff3ffcd8045cd5c288e6c4e284c3720570b58e4d47b8feeedc52fd1401f698a209fccfa3b4c0d9a797b046a2759f82a54c41ccd7b5f592b'));
		var mac = getString(hexToArrayBuffer('05d1243e6465ed9620c9aec1c351a186'));
		HmacSHA256(key, input).then(function(result) {
			callback(result.substring(0, mac.length) === mac)
		});
	}, "HMAC SHA-256", true);

	TEST(function(callback) {
		var key = getString(hexToArrayBuffer('2b7e151628aed2a6abf7158809cf4f3c'));
		var counter = getString(hexToArrayBuffer('f0f1f2f3f4f5f6f7f8f9fafbfcfdfeff'));
		var plaintext = getString(hexToArrayBuffer('6bc1bee22e409f96e93d7e117393172a'));
		var ciphertext = getString(hexToArrayBuffer('874d6191b620e3261bef6864990db6ce'));
		encryptAESCTR(plaintext, key, counter).then(function(result) {
			callback(result === ciphertext);
		});
	}, "Encrypt AES-CTR", true);

	TEST(function(callback) {
		var key = getString(hexToArrayBuffer('2b7e151628aed2a6abf7158809cf4f3c'));
		var counter = getString(hexToArrayBuffer('f0f1f2f3f4f5f6f7f8f9fafbfcfdfeff'));
		var plaintext = getString(hexToArrayBuffer('6bc1bee22e409f96e93d7e117393172a'));
		var ciphertext = getString(hexToArrayBuffer('874d6191b620e3261bef6864990db6ce'));
		decryptAESCTR(ciphertext, key, counter).then(function(result) {
			callback(result === plaintext);
		});
	}, "Decrypt AES-CTR", true);

	TEST(function(callback) {
		var key = getString(hexToArrayBuffer('603deb1015ca71be2b73aef0857d77811f352c073b6108d72d9810a30914dff4'));
		var iv = getString(hexToArrayBuffer('000102030405060708090a0b0c0d0e0f'));
		var plaintext  = getString(hexToArrayBuffer('6bc1bee22e409f96e93d7e117393172aae2d8a571e03ac9c9eb76fac45af8e5130c81c46a35ce411e5fbc1191a0a52eff69f2445df4f9b17ad2b417be66c3710'));
		var ciphertext = getString(hexToArrayBuffer('f58c4c04d6e5f1ba779eabfb5f7bfbd69cfc4e967edb808d679f777bc6702c7d39f23369a9d9bacfa530e26304231461b2eb05e2c39be9fcda6c19078c6a9d1b3f461796d6b0d6b2e0c2a72b4d80e644'));
		decryptAESCBC(ciphertext, key, iv).then(function(result) {
			callback(result === plaintext);
		});
	}, "Decrypt AES-CBC", true);

	// Setup test timeouts (note that this will only work if things are actually
	// being run async, ie in the case of NaCL)
	window.setInterval(function() {
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

		startNextExclusiveTest();

		localStorage.clear();
	}, 5000);
});
