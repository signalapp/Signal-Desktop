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
aliceIdentityPriv: hexToArrayBuffer("5087904a02ae0179650f03fc2936d8e34a2620f3b9949858d520617918f9e243"),
aliceIdentityPub: hexToArrayBuffer("05a7aff211e3c2c0eb98f49be243a998c56bf68faa2e41ba28ac3d755f30418f0b"),
bobIdentityPriv: hexToArrayBuffer("c840406d2f749b5e0529193f9b782acbc3b256d1bd425613e299ccc4c31cef4c"),
bobIdentityPub: hexToArrayBuffer("05f48c076e6a9730fa430edcb1c36818197589ef5e41a5874fa90ce1d48c7e4b3e"),
aliceLastResort: hexToArrayBuffer("f04babb890c02b64afddfbdc749c4412d48aebc9154de9542bd5430ad412b54f"),
bobLastResort: hexToArrayBuffer("3857c27f00fb284e1841f42611c4919bb3a99ac45cb7696fbd37fbb5e63d8748"),
alicePre0: hexToArrayBuffer("88e31d1796eaa4a2dd5da6515157904e921d0b578b4b5089c056e922ae6d2554"),
alicePre1: hexToArrayBuffer("a8ad7da1d1bbdf2f5a4dd2ad801cb081a158c66e5c7346a1a8ba1d5c91ef3145"),
bobPre0: hexToArrayBuffer("e0b3c8a483b0499404df078d82d4f13e47c0f201c1001602be422728043a0f43"),
bobPre1: hexToArrayBuffer("f0b65e60a10652b4eb30705b048040d5a69b26640b9b5736ba187f909336df56"),
aliceToBob: hexToArrayBuffer("08031205414c4943452203424f4228fd90aebfc62832860122080012210554a41389487db5b021f9bb7bfb3741cb4dd270e1a0b5a6c02e960c492eb5343c1a2105a7aff211e3c2c0eb98f49be243a998c56bf68faa2e41ba28ac3d755f30418f0b223b220a21056c2b1e63ad99214e72518331f30c69d7eb6b5c0cd8ba074ac2cf16252ca48f06100018012209b5ffc5e00bfd41f3a0e6619ee91abd5184"),
plain: hexToArrayBuffer("0a07486920426f6221")
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
