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

function hexToArrayBuffer(str) {
	var ret = new ArrayBuffer(str.length / 2);
	var array = new Uint8Array(ret);
	for (var i = 0; i < str.length/2; i++)
		array[i] = parseInt(str.substr(i*2, 2), 16);
	return ret;
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

	var axolotlTwoPartyTestVectorsAlice = [
		["sendMessage",
			{
				smsText: "A",
				ourBaseKey: hexToArrayBuffer('11b6e10b1f6505d80b7d93d244c17e510114b789aa69fef8a81aefc79871e477'),
				ourEphemeralKey: hexToArrayBuffer('21b2cc7af0e27ad92422711387a9e3dcfc4e6e17d316a2a0c1f2330b44a6a37f'),
				ourIdentityKey: hexToArrayBuffer('c063b14b5d3282293acb065e73a45c0b02db15ff775d66469c01de023fd9c340'),
				registrationId: 16291,
				getKeys: {identityKey: hexToArrayBuffer('05eeef4cd089a1b01cbd27ae8c5c4fc46c949c40db889ac1bd5363c3767167bf51'),
						devices: [{
							deviceId: 1,
							preKey: {keyId: 3328164, publicKey: hexToArrayBuffer('05b46f16b9ee54ce7d163404eceb4bcb8d8b57b03adacddccb2232d13155dbac37')},
							signedPreKey: {keyId: 16568186, publicKey: hexToArrayBuffer('0512937334f6ef3c84868928e74eed4afe21ad88bbc838c579e0baea97cfd6c00e')},
							registrationId: 7042
						}]
					},
				expectedCiphertext: hexToArrayBuffer('3308a491cb01122105984ae307e9cde59e80e0300330b746bf171feef43254652237739f785eb620141a210599fadc3bb88361690cb07a0bb5a11a60c9a21a747056789c7b15998e20a45e2d22d301330a2105c54e7484cdc551d4cba0f31dd710a95e9a522268959fa949b65f5318b938c2591000180022a00167154fa64892563602ecdabc62ed3e1712274a408ab6c6797ef45d2d610fb13b7dcbe95d1c26011420b8f49fbed96409fba5886e76701786d35a22c2b97e85f33734bed6174bc7e6920c6ba7a9f039436a832ea9220ebe4bcc889c893b74ce1e6c128253be92c040b2355c2bf10b33e7629ccacb370fb980a281c1b0d95dddbc1499abf4bb205835aeca9ddcef014175c56aee20abc3f104b693ae76b8949dab004c32bc0db4a9c328a37f30fa9ef3073a088115423e3185e911'),
			}],
		["sendMessage",
			{
				smsText: "B",
				expectedCiphertext: hexToArrayBuffer('3308a491cb01122105984ae307e9cde59e80e0300330b746bf171feef43254652237739f785eb620141a210599fadc3bb88361690cb07a0bb5a11a60c9a21a747056789c7b15998e20a45e2d22d301330a2105c54e7484cdc551d4cba0f31dd710a95e9a522268959fa949b65f5318b938c2591001180022a0017aa3e76b7118dc0b313b87b6121b72280ab620bca40e825f0e962cc44352d6d6fcf7315499f5032d2af10fe1b39f9a0cba9c375ae0c04040d80a48ec418e485f6aa9ffe02183dc7ae6bd0c2524113fb99d7125e6fad3803734502113842beea64010249c7db490462ab7db2476f16d0847dfdaa8b0d798c277e5d56e472cd18049b0dd4fca4b54257cee8b15eeff885ded246d4622c8b3d6d95d68ad799fc63e8488bdd1f844879028a37f30fa9ef3073a088115423e3185e911'),
			}],
		["receiveMessage",
			{
				message: hexToArrayBuffer('330a2105ad3bab32f6513bcb1e26dec03aa185e83299ee21c4ec4258d5f706403cd0e831100018ffffffff0f22a001767377b0e9d63fe5ea65f4fa3a06eec161fde84f7adb60c7e5a289686b0a9aa0f2169d00a951c2435fadb41a7b2fabd8ec786dbd4bc2fb28d63c5130c332e18b7dcd1b700ef7c285f9c5f6e0f1b8d4ab08ed4d2dd73e6fe578dc70bebf83384254ec4d6b58e0f47f34e0a4f8fd6f75571c8103d53f5577830fd4906dd96d3d9eccf1f788a2f614a8487b0559ad1fde449658a49d8a51638de4b35d23359e8fb9c50954eba9d6be09'),
				type: 1,
				newEphemeralKey: hexToArrayBuffer('c178de34b4a1abce2e17f8afdaa27fd34c0eeda8385825f464b5faa55492194b'),
				expectedSmsText: "C",
			}],
		["receiveMessage",
			{
				message: hexToArrayBuffer('330a2105ad3bab32f6513bcb1e26dec03aa185e83299ee21c4ec4258d5f706403cd0e831100118ffffffff0f22a0015689918069ff733000e789c276efa2d6321a94b8bdabb21bfc9eae4a4c80c8046f846c86955f69b778a4a28f17719a6fa1bd3fe1c95e00e8946708d004bdce70d48f912931b85631e61f797391b3d7681bcbc47718f924d40cb911c70cd0d12ccfa1ad2454d3caef23702859dd9692a2acd97d0a84a18e434bb9fea1e5cbc1c072d3db29fa7385444c62a01cfc26ed036911794118226a8f683a8476b212a0293c7f841a600f6be3'),
				type: 1,
				expectedSmsText: "D",
			}],
		["sendMessage",
			{
				smsText: "E",
				expectedCiphertext: hexToArrayBuffer('330a2105f9f6061f063849e5957880e62b7b96526ab4bae4bf4135ebe5a3c231b7a867421000180122a001989aa9d32f1425eebec0695129d1b0952d79a39a107764862afecb02cc56bd699f2f080df5368eee8cf043bda845b92589f61af233d731146420701355b85e4a0aefef6c9b83c91caf79a285c26b021569129d23e8147b09a65d705d9a3c095b9d60ad8fe4b4cb4ea139e894527bdf076d9f096f4776497be427eef3b22fe6ff07c7030e0a3c063c0a84d0aee95063d62355f9cb9b75c4cb5c162fb2af2675847040357010464726'),
			}],
		];

	var axolotlTwoPartyTestVectorsBob = [
		["receiveMessage",
			{
				message: hexToArrayBuffer('2208d28acd061221059ab4e844771bfeb96382edac5f80e757a1109b5611c770b2ba9f28b363d7c2541a2105bd61aea7fa5304f4dc914892bc3795812cda8bb90b73de9920e22c609cf0ec4e2242220a21058c0c357a3a25e6da46b0186d93fec31d5b86a4ac4973742012d8e9de2346be161000180022104bd27ab87ee151d71cdfe89828050ef4b05bddfb56da491728c95a'),
				type: 3,
				ourPreKey: hexToArrayBuffer('799706c9a19c663b6970690beccb5ffdc55b9f592f1dcbcd954f3662842c076b'),
				preKeyId: 13845842,
				ourSignedPreKey: hexToArrayBuffer('5024f863ed4a17505a5588cb464aa3cb349201f786e6f871a22cbed1ea6dd97c'),
				preSignedPreKeyId: 13845842,
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

	var axolotlTestVectors = function(v, remoteNumber) {
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
					message.source = remoteNumber;
					message.message = data.message;
					message.sourceDevice = 1;
					return textsecure.crypto.handleIncomingPushMessageProto(textsecure.protos.decodeIncomingPushMessageProtobuf(getString(message.encode()))).then(function(res) {
						return res.body == data.expectedSmsText;
					});
				}

				if (data.ourIdentityKey !== undefined)
					return textsecure.crypto.testing_only.privToPub(data.ourIdentityKey, true).then(function(keyPair) {
						textsecure.storage.putEncrypted("25519KeyidentityKey", keyPair);
						return textsecure.crypto.testing_only.privToPub(data.ourPreKey, false).then(function(keyPair) {
							textsecure.storage.putEncrypted("25519KeypreKey" + data.preKeyId, keyPair);
							return postLocalKeySetup();
						});
					});
				else
					return postLocalKeySetup();

			case "sendMessage":
				var postLocalKeySetup = function() {
					if (data.registrationId !== undefined)
						textsecure.storage.putUnencrypted("registrationId", data.registrationId);

					if (data.getKeys !== undefined)
						getKeysForNumberMap[remoteNumber] = data.getKeys;

					return textsecure.messaging.sendMessageToNumber(remoteNumber, data.smsText, []).then(function() {
						var msg = messagesSentMap[remoteNumber + "." + 1];
						delete messagesSentMap[remoteNumber + "." + 1];
						//XXX: This should be all we do: stepDone(getString(data.expectedCiphertext) == getString(res.body));
						if (msg.type == 1) {
							return isEqual(data.expectedCiphertext, msg.body, false);
						} else {
							var decoded = textsecure.protos.decodePreKeyWhisperMessageProtobuf(getString(data.expectedCiphertext).substr(1));
							var result = getString(msg.body).substring(1);
							return getString(decoded.encode()) == result;
						}
					});
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

	TEST(function() {
		return axolotlTestVectors(axolotlTwoPartyTestVectorsAlice, "BOB");
	}, "Standard Axolotl Test Vectors as Alice", true);

	TEST(function() {
		var t = axolotlTwoPartyTestVectorsAlice[2][1];
		axolotlTwoPartyTestVectorsAlice[2][1] = axolotlTwoPartyTestVectorsAlice[3][1];
		axolotlTwoPartyTestVectorsAlice[2][1].newEphemeralKey = t.newEphemeralKey;
		axolotlTwoPartyTestVectorsAlice[3][1] = t;
		delete axolotlTwoPartyTestVectorsAlice[3][1]['newEphemeralKey'];
		return axolotlTestVectors(axolotlTwoPartyTestVectorsAlice, "BOB");
	}, "Shuffled Axolotl Test Vectors as Alice", true);

	/*TEST(function() {
		return axolotlTestVectors(axolotlTwoPartyTestVectorsBob, "ALICE");
	}, "Standard Axolotl Test Vectors as Bob", true);

	TEST(function() {
		// Copy axolotlTwoPartyTestVectorsBob into v
		var orig = axolotlTwoPartyTestVectorsBob;
		var v = [];
		for (var i = 0; i < axolotlTwoPartyTestVectorsBob.length; i++) {
			v[i] = [];
			v[i][0] = orig[i][0];
			v[i][1] = orig[i][1];
		}

		// Swap first and second received prekey messages
		v[0][1] = { message: orig[1][1].message, type: orig[1][1].type, expectedSmsText: orig[1][1].expectedSmsText };
		v[0][1].ourPreKey = orig[0][1].ourPreKey;
		v[0][1].preKeyId = orig[0][1].preKeyId;
		v[0][1].registrationId = orig[0][1].registrationId;
		v[0][1].ourIdentityKey = orig[0][1].ourIdentityKey;
		v[0][1].newEphemeralKey = orig[0][1].newEphemeralKey;

		v[1][1] = { message: orig[0][1].message, type: orig[0][1].type, expectedSmsText: orig[0][1].expectedSmsText };
		return axolotlTestVectors(v, "ALICE");
	}, "Shuffled Axolotl Test Vectors as Bob I", true);

	TEST(function() {
		// Copy axolotlTwoPartyTestVectorsBob into v
		var orig = axolotlTwoPartyTestVectorsBob;
		var v = [];
		for (var i = 0; i < axolotlTwoPartyTestVectorsBob.length; i++) {
			v[i] = [];
			v[i][0] = orig[i][0];
			v[i][1] = orig[i][1];
		}

		// Swap second received prekey msg with the first send
		v[1] = orig[2];
		v[2] = orig[1];

		return axolotlTestVectors(v, "ALICE");
	}, "Shuffled Axolotl Test Vectors as Bob II", true);

	TEST(function() {
		// Copy axolotlTwoPartyTestVectorsBob into v
		var orig = axolotlTwoPartyTestVectorsBob;
		var v = [];
		for (var i = 0; i < axolotlTwoPartyTestVectorsBob.length; i++) {
			v[i] = [];
			v[i][0] = orig[i][0];
			v[i][1] = orig[i][1];
		}

		// Move second received prekey msg to the end (incl after the first received message in the second chain)
		v[4] = orig[1];
		v[1] = orig[2];
		v[2] = orig[3];
		v[3] = orig[4];

		return axolotlTestVectors(v, "ALICE");
	}, "Shuffled Axolotl Test Vectors as Bob III", true);

	TEST(function() {
		// Copy axolotlTwoPartyTestVectorsBob into v
		var orig = axolotlTwoPartyTestVectorsBob;
		var v = [];
		for (var i = 0; i < axolotlTwoPartyTestVectorsBob.length; i++) {
			v[i] = [];
			v[i][0] = orig[i][0];
			v[i][1] = orig[i][1];
		}

		// Move first received prekey msg to the end (incl after the first received message in the second chain)
		// ... by first swapping first and second received prekey msg
		v[0][1] = { message: orig[1][1].message, type: orig[1][1].type, expectedSmsText: orig[1][1].expectedSmsText };
		v[0][1].ourPreKey = orig[0][1].ourPreKey;
		v[0][1].preKeyId = orig[0][1].preKeyId;
		v[0][1].registrationId = orig[0][1].registrationId;
		v[0][1].ourIdentityKey = orig[0][1].ourIdentityKey;
		v[0][1].newEphemeralKey = orig[0][1].newEphemeralKey;

		v[1][1] = { message: orig[0][1].message, type: orig[0][1].type, expectedSmsText: orig[0][1].expectedSmsText };

		// ... then moving the (now-second) message to the end
		v[4] = v[1];
		v[1] = orig[2];
		v[2] = orig[3];
		v[3] = orig[4];

		return axolotlTestVectors(v, "ALICE");
	}, "Shuffled Axolotl Test Vectors as Bob IV", true);*/

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

		startNextExclusiveTest();
	}, 10000);

	allTestsDefined = true;
	printTestsDone();
});
