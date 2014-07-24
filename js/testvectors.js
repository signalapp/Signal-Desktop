function hexToArrayBuffer(str) {
	var ret = new ArrayBuffer(str.length / 2);
	var array = new Uint8Array(ret);
	for (var i = 0; i < str.length/2; i++)
		array[i] = parseInt(str.substr(i*2, 2), 16);
	return ret;
}
axolotlTestVectors = function() {
	// We're gonna throw the finalized tests in here:
	var tests = [];

	// The common-case ALICE test vectors themselves...
	var axolotlTwoPartyTestVectorsAlice = [
		["sendMessage",
			{
				smsText: "A",
				ourBaseKey: hexToArrayBuffer('21866b4c31971b7db06806fed4435a4fa9c163d591ea58b7d3019d017831b964'),
				ourEphemeralKey: hexToArrayBuffer('f1b80ca22c8442347622f14d5b9b4e5cd6998ae0aebfd74c618af9363e262a75'),
				ourIdentityKey: hexToArrayBuffer('f0fa85c5a95df57915426a650fb9822d6e34a54fab52b5a8245492950660b278'),
				registrationId: 13912,
				getKeys: {identityKey: hexToArrayBuffer('052f8905593aa6c1f59fa815c4f5e0042c7bf377b554f18d05be30842f1cd77077'),
						devices: [{
							deviceId: 1,
							preKey: {keyId: 12276633, publicKey: hexToArrayBuffer('052edc133abfab5b0b12e1c29b7f24197e08fbc5e2499dcc245d2c8d0ce113a00b')},
							signedPreKey: {keyId: 11658084, publicKey: hexToArrayBuffer('052c881422f830bb4baeedfc9b63931ba461783cb08fdf5c34f6402763c1f66c0d')},
							registrationId: 15439
						}]
					},
				expectedCiphertext: hexToArrayBuffer('330899a7ed0512210595eff8592a3b9b26a57fea18d2751dca9f7b9fa57416cffc9b02bbc9396593611a2105f09f2273e61d6f27e96751ace647cae60ee29b40d8e8a5bb0de061fbf6b6541d22d301330a210575278f3149ea8feca9cbcd0e334b8049b710e615f26777546e2d3bc82eb6b13e1000180022a001bf438c26af40a7179a6be5446ead6a6897028cf81db84dd2c67ab17457b7eb43f251feebdb63420554a5b1899948386b9c67566b446b56a929c31f1e72073985564a63dd130a6482f25a3c9184d947a8b69592f03d9cd581a9e78a1dbb02338563c9889e2df31ddce4396c86a1918b58616d34b336cfd999e51405f9ad5d416991f5388d3de4d29ac8fd9b41c9872d2c34af35c21b123eb313f68cdfbf33895bd4e59b951a89543828d86c30e4c6c705'),
			}],
		["sendMessage",
			{
				smsText: "B",
				expectedCiphertext: hexToArrayBuffer('330899a7ed0512210595eff8592a3b9b26a57fea18d2751dca9f7b9fa57416cffc9b02bbc9396593611a2105f09f2273e61d6f27e96751ace647cae60ee29b40d8e8a5bb0de061fbf6b6541d22d301330a210575278f3149ea8feca9cbcd0e334b8049b710e615f26777546e2d3bc82eb6b13e1001180022a001312a152b1109ae51be858e59064756294a5a5dce23ee2042141e1892558beb19dd856d0d3d0cd6e92a700f82a6de686de1f182a0f2e39ea1761ee2e68e1300f25e5dd33496cdd0e492b03ce163ae6d5e2470d7630267e8d01be4039caedc64f930ae41ee1389a07bf8d8aa7def0dc4090c933dac38c2041ad42127696fe83aad89847ec3b18e660accbae5c2d8ec763d28280733fc4e1750f5b31fac988cc7f7a07566f23f1051db28d86c30e4c6c705'),
			}],
		["receiveMessage",
			{
				message: hexToArrayBuffer('330a21058d98ffa47befe311852003698b2dbd4afff03af7f75260bbbeeb73c83a28266a1000180022a001160220b1ac75c1f5c68bcda7e57dc3d85e67c9811c5ddae3ba9a25b63bb83fa0747451191c35ecf0b11ef1ca797f37c77cff5ca983825ae90c0aa087116be75295417973c1a9c83c7f0412e034cf2c40bdb4ac750cb6663958070b3a29f31a44ca0e2cda7b3d6f136ff7a0421ee797758f530f2a835434d4ec2b4ec7f0e24c78005d9f941d97fda8b6f64ba07bbe304cf15bf0c41433b78a5094d661d934f7a1b9989e80d57aec7f'),
				type: 1,
				newEphemeralKey: hexToArrayBuffer('090a141aed9b5706ca0280d26d3b2583a45d4d0269fab9e50d42d1256bbf604f'),
				expectedSmsText: "C",
			}],
		["receiveMessage",
			{
				message: hexToArrayBuffer('330a21058d98ffa47befe311852003698b2dbd4afff03af7f75260bbbeeb73c83a28266a1001180022a001f8103c6bbdd5235f5d5e21be551a11b1425d3f8135c9fd971f7d1499cb27e547f56730e3aa25c27b1a0ef67f3c070b06d3973cbe630e4c95b4123053a046e5e03df4389d2e557e1bc9611d76fba49d32a11484635075660c4fcba2671f20d8afd35ce636d301f439687d3297e2b75d2ae1aa077a0966a705d34670f1f451280b9751cb7802cb2eb8b76baa2a5b2b431b1813baa9804e956939170e114ea098388894e9136d451dcd'),
				type: 1,
				expectedSmsText: "D",
			}],
		["sendMessage",
			{
				smsText: "E",
				expectedCiphertext: hexToArrayBuffer('330a210590f994e85aef8ef97403b3bc10614411612661df36fb5071f17c4eddf1a2ab031000180122a001cf3fe128ea42d71fe2e58b9804efacd723be2bc300701ea7be492a0dbdc31259ca573ba716ea8fa107690b9b798140dd5a0924d783179019d2bd08bc4bf053936c1c91fcb4f66b2e77ea1e208ae403dc0614cbd4649e1e5d973b99d7f022022a46942643f365335c1f90ab73b88c483a1c7770df597d93d7d6baaca1c4af3d2cc91d277184a2c31b650b2a04845bdb7ee4df7c26ba66df82524424ebd133437ac4f3526a6fbeca08'),
			}],
		];
	// Now change the order and make 2 tests out of them:
	tests[tests.length] = {name: "Standard Axolotl Test Vectors as Alice", vectors: axolotlTwoPartyTestVectorsAlice};

	tests[tests.length] = function() {
		var test = [];
		test[0] = axolotlTwoPartyTestVectorsAlice[0];
		test[1] = axolotlTwoPartyTestVectorsAlice[1];

		test[2] = ["receiveMessage", { message: axolotlTwoPartyTestVectorsAlice[3][1].message,
						type: axolotlTwoPartyTestVectorsAlice[3][1].type,
						expectedSmsText: axolotlTwoPartyTestVectorsAlice[3][1].expectedSmsText,
						newEphemeralKey: axolotlTwoPartyTestVectorsAlice[2][1].newEphemeralKey }] ;
		test[3] = ["receiveMessage", { message: axolotlTwoPartyTestVectorsAlice[2][1].message,
						type: axolotlTwoPartyTestVectorsAlice[2][1].type,
						expectedSmsText: axolotlTwoPartyTestVectorsAlice[2][1].expectedSmsText }];

		test[4] = axolotlTwoPartyTestVectorsAlice[4];
		return {name: "Shuffled Axolotl Test Vectors as Alice", vectors: test};
	}();

	// The common-case BOB test vectors themselves...
	var axolotlTwoPartyTestVectorsBob = [
		["receiveMessage",
			{
				message: hexToArrayBuffer('3308f7e5a307122105b4c506b0597283bbc7660cbad18d423f0c810aab007df7003d1cda16622fa27f1a21052f8905593aa6c1f59fa815c4f5e0042c7bf377b554f18d05be30842f1cd7707722d301330a210587164cfcd62b5133353aba2028317c0e1e8b590a63d51ce534d77212468ee57d1000180022a001126be8ea6120f1162b1e82931ecf35627d5ea99cf70196a49b8a84df9fbbc7e2b5a0bd6158514bf3ae71a9b2e4f11e4140fd376c60b8a0f1fa989e632e7ba5e7a15b1d242b01017750fc3b0f855e0394032ed2fd2c1b5c87c66af2ef6d1c441400f0d9bcec4b7e3058b5629b286eae6ea1041e1c74dd14887fceb99d45373572aa91eb44ba582582e3f4039ee846370a3643973c930ffe78ad077b6694c650e15b392b83c106bb2028cf7830b5d68c06'),
				type: 3,
				ourPreKey: hexToArrayBuffer('515c64408cbf2dfc5b98d42f64c1463a63cb977225c7b286d515eb31e1b8cb69'),
				preKeyId: 15266551,
				ourSignedPreKey: hexToArrayBuffer('e18cdb42e74881050a28c01511332919d39c322243831497bf59d76a368daf4a'),
				signedPreKeyId: 12790581,
				ourIdentityKey: hexToArrayBuffer('f0fa85c5a95df57915426a650fb9822d6e34a54fab52b5a8245492950660b278'),
				newEphemeralKey: hexToArrayBuffer('d9f5074018de79237270bdb6fba38e50acd5b60285df2ec480169840da11c972'),
				expectedSmsText: "A",
			}],
		["receiveMessage",
			{
				message: hexToArrayBuffer('3308f7e5a307122105b4c506b0597283bbc7660cbad18d423f0c810aab007df7003d1cda16622fa27f1a21052f8905593aa6c1f59fa815c4f5e0042c7bf377b554f18d05be30842f1cd7707722d301330a210587164cfcd62b5133353aba2028317c0e1e8b590a63d51ce534d77212468ee57d1001180022a0014e799f9a75e7d9d6acdbd9c14805fb479dc3bb1066962d709d1a287f825bfa23525c6fd5d148f92ccabe039d8b03daf9751d64696cacca3f8b2f1e2e7287b5675cf649fcda014d2f0007ff170e20863d42976d9268154c26300c092032c6378c57a4453d8f4f6f47afade84b5a441633881b4958c32289bf2280c8826f92846249a30711ef26d6faa29d8f1aca7523b73f6d07df4065c06aa8e3ac83d549f953d1da1ab86a5c6aa828cf7830b5d68c06'),
				type: 3,
				expectedSmsText: "B",
			}],
		["sendMessage",
			{
				smsText: "C",
				expectedCiphertext: hexToArrayBuffer('330a21059a4dcddc25653447f2ae38ae850592859caace2630e6351b2f8c4ed7795f01571000180022a001cbf8638afc1f79ca320093b2d07d2ec00d6f6bf3a3997ecd9444dc45a7d91beaa49e017f793d55fbfc3d155ef12980200ae4eef74aed794b4a663c81e5df1f273fa5075f0d8a5b0a751ca434cc9a918fc5f5488a0fc1a8fa4974cc6c494126deaf6ebf9955fe5f5bd52ef6121f5c13420269fa4157a39bd8f614e0b9eb4906fc953d14785ee1037c8ceebc173798f1ba31afdb7a40f686139da9ff77f0dcf4e1a338586f208c3c87'),
			}],
		["sendMessage",
			{
				smsText: "D",
				expectedCiphertext: hexToArrayBuffer('330a21059a4dcddc25653447f2ae38ae850592859caace2630e6351b2f8c4ed7795f01571001180022a00109535996341be5075eba25586722fb219fe07e362812273a50a5026dc2b6e25cf6ed821e5fc700ee9d2824f296bfe15d6dd03b3f4e991d7119b844358b911250a4451502b5c8efdd1673231652597f13c400e554e1bf5842b733344eb440c9d3f7e53180e1766a344d5325bc8c8346ebccb51be89c488cfe92c832f644e94828e323fa48b321c00fa02ea4276f8f8f9dc36da2379655618e2a91403eb47e42763b76acc16ff812d3'),
			}],
		["receiveMessage",
			{
				message: hexToArrayBuffer('330a2105d196165cbdbf67c3934213c5c4f7d776c7e7e22c86d8dcaca49b92ae5f269b051000180122a0011748da617e44e5e42a92a99c8b1f5ee429718687159d742129cdc2916a56626709579a82f4621c6290329c0862fcfe764abe65eccefd5b9b763685f49f1ef65fc6d22cf0bb8c95fa389219c3c9daf7ecddec996e99e22663b0da0a37019971de29ec5ed895d9d89960998dd4dd63a931a141a8d19eeca24b25887a6f21ba03ebb6fe449786a6e7fc06c5f0b64163e7ecac4c4d202236bbe83018de1d918332af4ecfbfd869af258e'),
				type: 1,
				newEphemeralKey: hexToArrayBuffer('e99b2d4806bb1e4b5366578795404a3222966454f13486dd9f9f6c0fce8d1858'),
				expectedSmsText: "E",
			}],
		];

	// Now change the order and make 5 tests out of them:
	tests[tests.length] = {name: "Standard Axolotl Test Vectors as Bob", vectors: axolotlTwoPartyTestVectorsBob};

	var axolotlTwoPartyTestVectorsBobCopy = function() {
		var orig = axolotlTwoPartyTestVectorsBob;
		var v = [];
		for (var i = 0; i < axolotlTwoPartyTestVectorsBob.length; i++) {
			v[i] = [];
			v[i][0] = orig[i][0];
			v[i][1] = orig[i][1];
		}
		return v;
	}

	tests[tests.length] = function() {
		// Copy axolotlTwoPartyTestVectorsBob into v
		var v = axolotlTwoPartyTestVectorsBobCopy();
		var orig = axolotlTwoPartyTestVectorsBob;

		// Swap first and second received prekey messages
		v[0][1] = { message: orig[1][1].message, type: orig[1][1].type, expectedSmsText: orig[1][1].expectedSmsText };
		v[0][1].ourPreKey = orig[0][1].ourPreKey;
		v[0][1].preKeyId = orig[0][1].preKeyId;
		v[0][1].ourSignedPreKey = orig[0][1].ourSignedPreKey;
		v[0][1].signedPreKeyId = orig[0][1].signedPreKeyId;
		v[0][1].registrationId = orig[0][1].registrationId;
		v[0][1].ourIdentityKey = orig[0][1].ourIdentityKey;
		v[0][1].newEphemeralKey = orig[0][1].newEphemeralKey;

		v[1][1] = { message: orig[0][1].message, type: orig[0][1].type, expectedSmsText: orig[0][1].expectedSmsText };
		return {name: "Shuffled Axolotl Test Vectors as Bob I", vectors: v};
	}();

	tests[tests.length] = function() {
		// Copy axolotlTwoPartyTestVectorsBob into v
		var v = axolotlTwoPartyTestVectorsBobCopy();
		var orig = axolotlTwoPartyTestVectorsBob;

		// Swap second received prekey msg with the first send
		v[1] = orig[2];
		v[2] = orig[1];

		return {name: "Shuffled Axolotl Test Vectors as Bob II", vectors: v};
	}();

	tests[tests.length] = function() {
		// Copy axolotlTwoPartyTestVectorsBob into v
		var v = axolotlTwoPartyTestVectorsBobCopy();
		var orig = axolotlTwoPartyTestVectorsBob;

		// Move second received prekey msg to the end (incl after the first received message in the second chain)
		v[4] = orig[1];
		v[1] = orig[2];
		v[2] = orig[3];
		v[3] = orig[4];

		return {name: "Shuffled Axolotl Test Vectors as Bob III", vectors: v};
	}();

	tests[tests.length] = function() {
		// Copy axolotlTwoPartyTestVectorsBob into v
		var v = axolotlTwoPartyTestVectorsBobCopy();
		var orig = axolotlTwoPartyTestVectorsBob;

		// Move first received prekey msg to the end (incl after the first received message in the second chain)
		// ... by first swapping first and second received prekey msg
		v[0][1] = { message: orig[1][1].message, type: orig[1][1].type, expectedSmsText: orig[1][1].expectedSmsText };
		v[0][1].ourPreKey = orig[0][1].ourPreKey;
		v[0][1].preKeyId = orig[0][1].preKeyId;
		v[0][1].ourSignedPreKey = orig[0][1].ourSignedPreKey;
		v[0][1].signedPreKeyId = orig[0][1].signedPreKeyId;
		v[0][1].registrationId = orig[0][1].registrationId;
		v[0][1].ourIdentityKey = orig[0][1].ourIdentityKey;
		v[0][1].newEphemeralKey = orig[0][1].newEphemeralKey;

		v[1][1] = { message: orig[0][1].message, type: orig[0][1].type, expectedSmsText: orig[0][1].expectedSmsText };

		// ... then moving the (now-second) message to the end
		v[4] = v[1];
		v[1] = orig[2];
		v[2] = orig[3];
		v[3] = orig[4];

		return {name: "Shuffled Axolotl Test Vectors as Bob IV", vectors: v};
	}();

	return tests;
}();
