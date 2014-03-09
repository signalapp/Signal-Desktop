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
			callback(message.body == text_message.body &&
					message.attachments.length == text_message.attachments.length &&
					text_message.attachments.length == 0);
		});
	}, 'Unencrypted PushMessageProto "decrypt"', true);

	TEST(function(callback) {
		crypto.generateKeys(function() {
			callback(true);
		});
	}, "Test simple create key", true);

	TEST(function(callback) {
		// These are just some random curve25519 test vectors I found online
		var alice_priv = hexToArrayBuffer("77076d0a7318a57d3c16c17251b26645df4c2f87ebc0992ab177fba51db92c2a");
		var alice_pub  = hexToArrayBuffer("8520f0098930a754748b7ddcb43ef75a0dbf3a0d26381af4eba4a98eaa9b4e6a");
		var bob_priv   = hexToArrayBuffer("5dab087e624a8a4b79e17f8b83800ee66f3bb1292618b6fd1c2f8b27ff88e0eb");
		var bob_pub    = hexToArrayBuffer("de9edb7d7b7dc1b4d35b61c2ece435373f8343c85b78674dadfc7e146f882b4f");
		var shared_sec = hexToArrayBuffer("4a5d9d5ba4ce2de1728e3bf480350f25e07e21c947d19e3376f09b3c1e161742");

		postNaclMessage({command: "bytesToPriv", priv: alice_priv}, function(message) {
			var target = new Uint8Array(alice_priv.slice(0));
			target[0] &= 248;
			target[31] &= 127;
			target[31] |= 64;
			if (String.fromCharCode.apply(null, new Uint8Array(message.res)) != String.fromCharCode.apply(null, target))
				callback(false);
			var alice_calc_priv = message.res;

			postNaclMessage({command: "bytesToPriv", priv: bob_priv}, function(message) {
				var target = new Uint8Array(bob_priv.slice(0));
				target[0] &= 248;
				target[31] &= 127;
				target[31] |= 64;
				if (String.fromCharCode.apply(null, new Uint8Array(message.res)) != String.fromCharCode.apply(null, target))
					callback(false);
				var bob_calc_priv = message.res;

				postNaclMessage({command: "privToPub", priv: alice_calc_priv}, function(message) {
					if (String.fromCharCode.apply(null, new Uint16Array(message.res)) != String.fromCharCode.apply(null, new Uint16Array(alice_pub)))
						callback(false);

					postNaclMessage({command: "privToPub", priv: bob_calc_priv}, function(message) {
						if (String.fromCharCode.apply(null, new Uint16Array(message.res)) != String.fromCharCode.apply(null, new Uint16Array(bob_pub)))
							callback(false);

						postNaclMessage({command: "ECDHE", priv: alice_calc_priv, pub: bob_pub}, function(message) {
							if (String.fromCharCode.apply(null, new Uint16Array(message.res)) != String.fromCharCode.apply(null, new Uint16Array(shared_sec)))
								callback(false);

							postNaclMessage({command: "ECDHE", priv: bob_calc_priv, pub: alice_pub}, function(message) {
								if (String.fromCharCode.apply(null, new Uint16Array(message.res)) != String.fromCharCode.apply(null, new Uint16Array(shared_sec)))
									callback(false);
								else
									callback(true);
							});
						});
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

	var axolotlTestVectors = {
aliceIdentityPriv: hexToArrayBuffer("08ebc1e1fdbbc88d1a833a9d8c287328d4f749b7b7eb20afda0957dc05efc258"),
aliceIdentityPub: hexToArrayBuffer("05b9c152cb9fefb0a12df319ae50c728c7909a8a080fcf22d5e1842352186d3870"),
bobIdentityPriv: hexToArrayBuffer("08491ea8a9aff03a724cfb44411502f3e974010e62b6db2703b9506a2e18554e"),
bobIdentityPub: hexToArrayBuffer("0562d9efab60407ac5f4b1bec9c3341db4b279f24a87234c9ff36a1f868fdd8104"),
alicePre0: hexToArrayBuffer("886ec9c65f0c8c1281ca4c8115e3baf5c2ac75d2762826a3cf098c2a093b2250"),
bobPre0: hexToArrayBuffer("009aa1809dbd29b15d3cc4c3c04ae45413b6396f286de46775e748c6daf36545"),
aliceToBob: hexToArrayBuffer("08031205414c4943452203424f4228cfb3dbeec92832860122080012210503d7fa229643c84d5b33d42e50985fc64b77e0b4ec32c52000ce81e857b1ec141a2105b9c152cb9fefb0a12df319ae50c728c7909a8a080fcf22d5e1842352186d3870223b220a21052a59b346373f79d2aee25503b071fd4704a40db12afd6288519eeccf9aacec5b10001801220917468a49c79f0588a5037512abf4f66557"),
plain: hexToArrayBuffer("0a07486920426f6221"),
sessionKey: hexToArrayBuffer("3d71b56ab9763865905597a90c6746640a946bf3a11632b31a87990579925f92f2132869dbf3f22646d00a68430ecd29cb38186b"),
encryptedMessage: hexToArrayBuffer("415a326e6f457937756a6c5355785876342f6b5856346970342b6d45636f636c35424d396c4978364f525948696438634f4a68374c4e2f48534b776a4755556f304e73582f634255742b6a58464b6357697368364b363441315963316f5a47304168676466734e572b53484f313131306e664b6e6c47595445723661624e57556b394c515145706b6f52385746626c5952312b636a4b576d554d5131646f477a376b345955415055544e4d474b78413349694135797575706d6544453173545359552b736133575876366f5a7a624a614275486b5044345a4f3773416b34667558434135466e724e2f462f34445a61586952696f4a76744849413d3d"),
	};

	function axolotlTestVectorsAsBob(v, callback) {
		localStorage.clear();
		storage.putEncrypted("25519KeyidentityKey", { pubKey: v.bobIdentityPub, privKey: v.bobIdentityPriv });
		postNaclMessage({command: "privToPub", priv: v.bobPre0}, function(message) {
			storage.putEncrypted("25519KeypreKey0", { pubKey: message.res, privKey: v.bobPre0 });

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
				callback(decrypted_message.body == "Hi Bob!" && decrypted_message.attachments.length == 0);
			});
		});
	};

	TEST(function(callback) {
		var v = {};
		for (key in axolotlTestVectors)
			v[key] = axolotlTestVectors[key];

		storage.putEncrypted("25519KeyidentityKey", { pubKey: v.aliceIdentityPub, privKey: v.aliceIdentityPriv });
		postNaclMessage({command: "privToPub", priv: v.alicePre0}, function(message) {
			storage.putEncrypted("25519KeypreKey0", { pubKey: message.res, privKey: v.alicePre0 });
			postNaclMessage({command: "privToPub", priv: v.bobPre0}, function(message) {
				var bobsDevice = {encodedNumber: "BOB", identityKey: v.bobIdentityPub, publicKey: message.res, preKeyId: 0};
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
					axolotlTestVectorsAsBob(v, callback);
				});
			});
		});
	}, "Axolotl test vectors as alice", true);

	TEST(function(callback) {
		axolotlTestVectorsAsBob(axolotlTestVectors, callback);
	}, "Axolotl test vectors as bob", true);

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
	}, 500);
});
