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
	}, "Test simple create key");

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

	var axolotlTestVectors = {
aliceIdentityPriv: hexToArrayBuffer("38115e981295947fb6130c3a9521760e9692476143810c64bb502d2a7757f953"),
aliceIdentityPub: hexToArrayBuffer("057f6f0cf5a353e3c2fa73774d36b07d491c2ba5285388a4dc7be3b08de4528933"),
bobIdentityPriv: hexToArrayBuffer("9069fadc08faaf6265a90a41fd1a9214bc70eb44ab30aa92ea5ad5a6b8609557"),
bobIdentityPub: hexToArrayBuffer("05889d0f94f4049fac36cc939c50dabec18c2af8e344f2cdf72cb5b0b02323337c"),
aliceLastResort: hexToArrayBuffer("10cd8adcbbf5a0157ed45e3be2e0bde5e91c3cdf77954530ac75c6ae9b8c2458"),
bobLastResort: hexToArrayBuffer("9855c7ce178404bb02c6c026103cc7d74d68a12f77d35d03df40a5f2dff6784d"),
alicePre0: hexToArrayBuffer("981bea233e094a34f7d564c63515af4691d3059268371c3b26f37a141e4fb553"),
alicePre1: hexToArrayBuffer("18b27cac90879c8ba5b1d6eb29d08ee380bac2e1022ead9a7dbe5ddfa0009852"),
bobPre0: hexToArrayBuffer("780fc02d2b8ffce8cd6f92233ce28b46a487dafeb97597461b1ed964fb118e5c"),
bobPre1: hexToArrayBuffer("c8e218839b33ae6c54d73ef56ad77551b6575e64c5b4acc0f0710b93799c3b56"),
aliceToBob: hexToArrayBuffer("08031205414c4943452203424f4228bff1f9c3c92832860122080012210541ef7f7215ffb6260413ab2c95bbd39d5d8d55241de87a6a7fa50ae5d99cbe741a21057f6f0cf5a353e3c2fa73774d36b07d491c2ba5285388a4dc7be3b08de4528933223b220a2105c851726034e7181614e21c6349d33f9bcff4f4becfc08c4422c6606cdc976d2c100018012209bb4876c684c88dd05207274341f4e3aa91"),
plain: hexToArrayBuffer("0a07486920426f6221"),
sessionKey: hexToArrayBuffer("03a3a58503e91c9e5ae179fa87bbb755f7afe35a2bffce4932cec2c2fcaa28832389e20000c7e1e7c7365959e4146d98f3620df9"),
encryptedMessage: hexToArrayBuffer("41576d4e6f7431327748385470366f724c7735416a62425446767139314c376857757a663854394e54775256326955384f76376265494463587030396634356441506159515a456a6e71704176364852574f3539584e35796d73507548423342716f78594e7136396346424c6e4145766439495a2f6674593835555a586e5668493574704e673946354c56627a4e70474563436672762f6a69393661675837755936335867746342683177412b5967364a472b37626a4a3044542b526e67383579325852705473644d3931794144776b5a744478616d7976412f714746556b37447a7353367061704a364459532b6e35673841457230764f37413d3d"),
	};

	// Axolotl test vectors
	TEST(function(callback) {
		var v = axolotlTestVectors;
		storage.putEncrypted("25519KeyidentityKey", { pubKey: v.aliceIdentityPub, privKey: v.aliceIdentityPriv });
		callback(true);
	}, "Axolotl test vectors as alice", true);

	// Axolotl test vectors
	TEST(function(callback) {
		var v = axolotlTestVectors;
		storage.putEncrypted("25519KeyidentityKey", { pubKey: v.bobIdentityPub, privKey: v.bobIdentityPriv });
		postNaclMessage({command: "privToPub", priv: v.bobPre0}, function(message) {
			storage.putEncrypted("25519KeypreKey0", { pubKey: message.res, privKey: v.bobPre0 });
			postNaclMessage({command: "privToPub", priv: v.bobPre1}, function(message) {
				storage.putEncrypted("25519KeypreKey1", { pubKey: message.res, privKey: v.bobPre1 });
				postNaclMessage({command: "privToPub", priv: v.bobLastResort}, function(message) {
					storage.putEncrypted("signaling_key", v.sessionKey);
					var aliceToBob = crypto.decryptWebsocketMessage(v.encryptedMessage);
					if (getString(aliceToBob) != getString(v.aliceToBob))
						callback(false);
					storage.putEncrypted("25519KeypreKey16777215", { pubKey: message.res, privKey: v.bobLastResort });
					var b64 = base64EncArr(new Uint8Array(v.aliceToBob));
					crypto.handleIncomingPushMessageProto(IncomingPushMessageProtobuf.decode(b64), function(decrypted_message) {
						callback(decrypted_message == "Hi, Bob!");
					});
				});
			});
		});
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
	}, 250);
});
