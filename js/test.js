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

		var OKM = crypto_tests.HKDF(IKM, salt, info);
		var T1 = hexToArrayBuffer("3cb25f25faacd57a90434f64d0362f2a2d2d0a90cf1a5a4c5db02d56ecc4c5bf");
		var T2 = hexToArrayBuffer("34007208d5b887185865");
		callback(getString(OKM[0]) == getString(T1) && getString(OKM[1]).substring(0, 10) == getString(T2));
	}, "HMAC RFC5869 Test vectors");*/


	/*var simpleAxolotlTestVectors = {
aliceIdentityPriv: hexToArrayBuffer("08ebc1e1fdbbc88d1a833a9d8c287328d4f749b7b7eb20afda0957dc05efc258"),
aliceIdentityPub: hexToArrayBuffer("05b9c152cb9fefb0a12df319ae50c728c7909a8a080fcf22d5e1842352186d3870"),
bobIdentityPriv: hexToArrayBuffer("08491ea8a9aff03a724cfb44411502f3e974010e62b6db2703b9506a2e18554e"),
bobIdentityPub: hexToArrayBuffer("0562d9efab60407ac5f4b1bec9c3341db4b279f24a87234c9ff36a1f868fdd8104"),
bobPre0: hexToArrayBuffer("009aa1809dbd29b15d3cc4c3c04ae45413b6396f286de46775e748c6daf36545"),
aliceToBob: hexToArrayBuffer("08031205414c4943452203424f4228cfb3dbeec92832860122080012210503d7fa229643c84d5b33d42e50985fc64b77e0b4ec32c52000ce81e857b1ec141a2105b9c152cb9fefb0a12df319ae50c728c7909a8a080fcf22d5e1842352186d3870223b220a21052a59b346373f79d2aee25503b071fd4704a40db12afd6288519eeccf9aacec5b10001801220917468a49c79f0588a5037512abf4f66557"),
sessionKey: hexToArrayBuffer("3d71b56ab9763865905597a90c6746640a946bf3a11632b31a87990579925f92f2132869dbf3f22646d00a68430ecd29cb38186b"),
encryptedMessage: hexToArrayBuffer("415a326e6f457937756a6c5355785876342f6b5856346970342b6d45636f636c35424d396c4978364f525948696438634f4a68374c4e2f48534b776a4755556f304e73582f634255742b6a58464b6357697368364b363441315963316f5a47304168676466734e572b53484f313131306e664b6e6c47595445723661624e57556b394c515145706b6f52385746626c5952312b636a4b576d554d5131646f477a376b345955415055544e4d474b78413349694135797575706d6544453173545359552b736133575876366f5a7a624a614275486b5044345a4f3773416b34667558434135466e724e2f462f34445a61586952696f4a76744849413d3d"),
	};

	function simpleAxolotlTestVectorsAsBob(v, callback) {
		localStorage.clear();
		storage.putEncrypted("25519KeyidentityKey", { pubKey: v.bobIdentityPub, privKey: v.bobIdentityPriv });
		crypto_tests.privToPub(v.bobPre0, true, function(keyPair) {
			storage.putEncrypted("25519KeypreKey0", { pubKey: keyPair.pubKey, privKey: keyPair.privKey });

			if (v.sessionKey !== undefined) {
				storage.putEncrypted("signaling_key", v.sessionKey);
				var aliceToBob = crypto.decryptWebsocketMessage(v.encryptedMessage);
				if (getString(aliceToBob) != getString(v.aliceToBob)) {
					callback(false);
					return;
				}
			}

			var b64 = base64EncArr(new Uint8Array(toArrayBuffer(v.aliceToBob)));
			var thing = IncomingPushMessageProtobuf.decode(b64);
			crypto.handleIncomingPushMessageProto(thing, function(decrypted_message) {
				callback(decrypted_message.message.body == "Hi Bob!" && decrypted_message.message.attachments.length == 0);
			});
		});
	};

	TEST(function(callback) {
		var v = {};
		for (key in simpleAxolotlTestVectors)
			v[key] = simpleAxolotlTestVectors[key];

		storage.putEncrypted("25519KeyidentityKey", { pubKey: v.aliceIdentityPub, privKey: v.aliceIdentityPriv });
		crypto_tests.privToPub(v.bobPre0, true, function(keyPair) {
			var bobsDevice = {encodedNumber: "BOB", identityKey: keyPair.privKey, publicKey: keyPair.pubKey, preKeyId: 0};
			saveDeviceObject = bobsDevice;

			var message = new PushMessageContentProtobuf();
			message.body = "Hi Bob!";
			crypto.encryptMessageFor(bobsDevice, message, function(encryptedMsg) {
				var message = new IncomingPushMessageProtobuf();
				message.message = toArrayBuffer(encryptedMsg.body);
				message.type = encryptedMsg.type;
				if (message.type != 3) { callback(false); return; }
				message.source = "ALICE";

				delete v['sessionKey'];
				v.aliceToBob = getString(message.encode());
				simpleAxolotlTestVectorsAsBob(v, callback);
			});
		});
	}, "Simple Axolotl test vectors as Alice", true);

	TEST(function(callback) {
		simpleAxolotlTestVectorsAsBob(simpleAxolotlTestVectors, callback);
	}, "Simple Axolotl test vectors as bob", true);*/


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
				newEphemeralKey: hexToArrayBuffer('a92a28cf21fb48745ebf68b425a1811476fed69f8623ff5941fd4e547ee4027c'),
				//expectedPlaintext: hexToArrayBuffer(''),
				expectedSmsText: "C",
			}],
		["receiveMessage",
			{
				message: hexToArrayBuffer('220a2105edf6feeea8ee95f4b227453d5942d15731cb7a962eff6d04706860a4d577476f100118ffffffff0f2203a439d199228e124820c28b'),
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
				message: hexToArrayBuffer(''),
				ourPreKey: hexToArrayBuffer(''),
				ourIdentityKey: hexToArrayBuffer(''),
				newEphemeralKey: hexToArrayBuffer(''),
				//expectedPlaintext: hexToArrayBuffer(''),
				expectedSmsText: "A",
			}],
		["receiveMessage",
			{
				message: hexToArrayBuffer(''),
				//expectedPlaintext: hexToArrayBuffer(''),
				expectedSmsText: "B",
			}],
		["sendMessage",
			{
				smsText: "C",
				//expectedPlaintext: hexToArrayBuffer('0a0143'),
				//expectedCounter: 0,
				expectedCiphertext: hexToArrayBuffer(''),
			}],
		["sendMessage",
			{
				smsText: "D",
				//expectedPlaintext: hexToArrayBuffer('0a0144'),
				//expectedCounter: 1,
				expectedCiphertext: hexToArrayBuffer(''),
			}],
		["receiveMessage",
			{
				message: hexToArrayBuffer(''),
				newEphemeralKey: hexToArrayBuffer(''),
				//expectedPlaintext: hexToArrayBuffer(''),
				expectedSmsText: "E",
			}],
		];

	TEST(function(callback) {
		var v = axolotlTwoPartyTestVectorsAlice;
		var origCreateNewKeyPair = crypto_tests.createNewKeyPair;
		var remoteDevice = { encodedNumber: "BOB" };

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
				if (data.newEphemeralKey !== undefined)
					privKeyQueue.push(data.newEphemeralKey);

				var message = new IncomingPushMessageProtobuf();
				message.type = 1;
				message.source = "BOB";
				message.message = data.message;
				crypto.handleIncomingPushMessageProto(decodeIncomingPushMessageProtobuf(getString(message.encode())), function(res) {
					stepDone(res.message.body == data.expectedSmsText);
				});
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
						if (res.type == 1) { //XXX: This should be used for everything...
							stepDone(getString(data.expectedCiphertext) == getString(res.body));
							return;
						}
						// Reencode expectedCiphertext...?
						var decoded = decodePreKeyWhisperMessageProtobuf(getString(data.expectedCiphertext).substr(1));
						var reencoded = String.fromCharCode((2<<4) | 2) + getString(decoded.encode());

						stepDone(getString(data.expectedCiphertext)[0] == String.fromCharCode((2 << 4) | 2) &&
								reencoded == res.body);
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
	}, "Standard Axolotl Test Vectors as Alice", true);

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
