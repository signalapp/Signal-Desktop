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
	}, "HMAC RFC5869 Test vectors");

	var axolotlTestVectors = {
aliceIdentityPriv: hexToArrayBuffer("d8dab419978a2693f2842691931e4c8aaa09a11e8a94b5817cc4f81a1c474a62"),
aliceIdentityPub: hexToArrayBuffer("0502e9e6c0528ea9e44d8cb759aeaa02ae3eccbe3107de4f0815240b414744fd22"),
bobIdentityPriv: hexToArrayBuffer("18bd2244222329293a303343759e8e9feb4a4e2771273111528ef97abb6a567e"),
bobIdentityPub: hexToArrayBuffer("05b1cb0b5f1e5c93d20a3db2af0ab2512d39d91e6b671ee8e462a62658ba064a5b"),
aliceLastResort: hexToArrayBuffer("8825a933b97d40f65ea37701800900f10d8ba6dff6979a5634e0dc6de8d9b24f"),
bobLastResort: hexToArrayBuffer("c054dbefd8eee42ff3c1bb873def01f05411304ee07014ff86088c11f57b8e76"),
alicePre0: hexToArrayBuffer("384db59677ea9545f1da2c10426b463fb3180bd30d294ad69cd91b44e3a3ad43"),
alicePre1: hexToArrayBuffer("a841ece2aab82a0542c59c0daca5bd0ae36bc81b3f375ba0ffcc73ab2feacf6f"),
bobPre0: hexToArrayBuffer("10b6b52b867f79e330a5fa3b46fd6a542a1dc21d1103f4d2e8f741c0dd989474"),
bobPre1: hexToArrayBuffer("70be59ec978e3aaa95b64635b09ad1a614c2eda2142ac577b1eb6b1ec8e7f270"),
aliceToBob: hexToArrayBuffer("08031205414c4943452203424f4228c3dfc6cac92832860122080012210518761fa74e002dbbbb140ca7950fb83a3aab3dd4fb7b75ec87eea17f0cde7e0a1a210502e9e6c0528ea9e44d8cb759aeaa02ae3eccbe3107de4f0815240b414744fd22223b220a2105fbad228c11ab8098c3fcb9c16ff1f9df705dce81ea4b6e3df988148e254270751000180122093cfc98c3bc5557b31ffe8deba6900bcfe6"),
plain: hexToArrayBuffer("0a07486920426f6221"),
sessionKey: hexToArrayBuffer("34400f1fde8f3b96beb435c280a6e93b829679b7e948a85c2f7250c6bfd419dd411a0e9cb5f62cd8b39e2ba23e013763169eb40a"),
encryptedMessage: hexToArrayBuffer("415733486e6d3165754275487778594d2f4b744a556e63364f67386e45754d6868663054704f486b45494b786c33616a79544552665531354c7539687a426736572f38546b7255583957653542724572724b3867367544554348425257555646774c4662614c67497446722f3242492f56434c31307a49666e2b765457524d324474475a46345a36553869717633566179443273354330417274386d6f48517342524970535a59387841566e584464572f466c4e7632706f6c5a6a2f464e597635552b56335933324552417572327464344a44654e6c544d4c6d4b7456387252384f354d7546626e735074336846456d496d374d7633573039673d3d")
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
					storage.putEncrypted("signaling_key", v.sessionKey);
					var aliceToBob = crypto.decryptWebsocketMessage(v.encryptedMessage);
					if (getString(aliceToBob) != getString(v.aliceToBob))
						callback(false);
					var b64 = base64EncArr(new Uint8Array(toArrayBuffer(aliceToBob)));
					crypto.handleIncomingPushMessageProto(IncomingPushMessageProtobuf.decode(b64), function(decrypted_message) {
						callback(decrypted_message.body == "Hi Bob!" && decrypted_message.attachments.length == 0);
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
	}, 500);
});
