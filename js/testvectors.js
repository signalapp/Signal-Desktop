// Copyright (c) 2014 Matt Corallo
// Distributed under the X11 software license, see the accompanying
// file MIT

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

	// Test vectors around an end-session
	var axolotlEndSessionTestVectorsBob = [
		["receiveMessage",
			{
				message: hexToArrayBuffer('3308d49d980512210513595fc079c0170ea2e849ae4d63d5f5828bb804770a441032b6184ddfe79f7c1a21053841429a37322af3f786be4df3dd8cea5403a79f258e254d4738970acbbe633422d301330a2105fde2b4eca4b7a66a53cd838a45b4ce5847684b3ac2fcb966afabd7e160ada5701000180022a0014949fd0f39d5990f2d1954c84ce626ab4a10149df50daf06f033ec16680d32c479dff81d3782b9042e44d0e3d57096c8b36199360dd1b985afa70033d9c918a4a4355c7d314256225bbc66ace964ddc24d1cd6927a4a878dd97353dd07c298b2c440027009ce28c2cff7b42f7cfd3a1fc16d1e586c9319f011651efe41d98dd585314c7859c1f334aa0f3083f93940757debf1760642954d23b50ed96b0b13f277033dc529eefc3728ac3930a0b68d01'),
				type: 3,
				ourPreKey: hexToArrayBuffer('89cca67d7e79ad337735876666b284e4f0aa4ccc7a1a9a1d3d6432898923d179'),
				preKeyId: 10882772,
				ourSignedPreKey: hexToArrayBuffer('b1899b87fa3f6e84894cffded76843ef339f41474ec1ccf1a1c068046c18fb61'),
				signedPreKeyId: 2317088,
				ourIdentityKey: hexToArrayBuffer('18a3c6d4e4522e8f224c0b1efffdc1d91e6aced52f9fa18e14b888eec462394b'),
				newEphemeralKey: hexToArrayBuffer('21daf6374126ee4c2a15bcaa57eb869ece53f6020d55ad20809eb9fe8917457e'),
				expectedSmsText: "A",
			}],
		["receiveMessage",
			{
				message: hexToArrayBuffer('3308d49d980512210513595fc079c0170ea2e849ae4d63d5f5828bb804770a441032b6184ddfe79f7c1a21053841429a37322af3f786be4df3dd8cea5403a79f258e254d4738970acbbe633422d301330a2105fde2b4eca4b7a66a53cd838a45b4ce5847684b3ac2fcb966afabd7e160ada5701001180022a0010f4a39c86969af983c89b38aa9f968046fdac3e8b1bb59befc998a734bb5f91d457b26eadb7b54ccc07e16a236581fddf73cdcc0c19ca59fd0e261c23ba9d22d351c51aa307cf69e8446ada5d4131cb58f4324e183d059797dcba4d7cc0babd7beda6e25327907d97c39e24d4270c0bdb593da09fdc955f50b228d918b6e03d178737bb42b81b6f4080f92db80a5e0c07dcca1220014f71631401734ac97b723e366e771a85b942128ac3930a0b68d01'),
				type: 3,
				expectedSmsText: "B",
			}],
		["receiveMessage",
			{
				message: hexToArrayBuffer('3308d49d980512210513595fc079c0170ea2e849ae4d63d5f5828bb804770a441032b6184ddfe79f7c1a21053841429a37322af3f786be4df3dd8cea5403a79f258e254d4738970acbbe633422d301330a2105fde2b4eca4b7a66a53cd838a45b4ce5847684b3ac2fcb966afabd7e160ada5701002180022a001b75b0124e0a077de4ceae3addfb722469638fad82577680afe7060da2f7c6dbc9ffe924af37952141ef6f5a78138ba93f2e71102432ee1ed0f1b05cfed069c7cace2103432c92160785ac07d111fbaf535b2a740bc73391a2e370a05db41c883592d7f12129e7c1ee12ac99793b0d9fb38a696e5410d9e3f2df45de2f72ee7812cc66b6770c37e5c882a193b42236563968974ce57c0f9d73631790dce3460f16712a351c428853d28ac3930a0b68d01'),
				type: 3,
				expectTerminateSession: true,
			}],
		["receiveMessage",
			{
				message: hexToArrayBuffer('3308d59d98051221052338a4fb6cbb6d39936ab8b623802d684871c4c4eaf285f2afb7692b5183132c1a21053841429a37322af3f786be4df3dd8cea5403a79f258e254d4738970acbbe633422d301330a2105418a8942643b5278746f1740e05a8ad403380bfaff87a7a8f9b6cbc5db6f38381000180022a00165ffb1279d2d0c25e3f4c3e51e8b6e480724e5858f9078e15346df33b84d61ca33a88fe883c312e93cd560e0d76975aa09fac2c6f348051f6e2a035f08960e3c94001037fb3e6e2328471ac24cc35d6d19f568e27de3d091ff5d7fb861c81ed21ca8da5ece8d4dab705391a03072fbd34b30b1614c4083e0679a66bb487364d36e8b21bd40ba9271c9cc31414e925971b5936000d191724bbfaf6d653f3ecfd0d6f201dbafe17c0d28ac3930a0b68d01'),
				type: 3,
				ourPreKey: hexToArrayBuffer('e187c9f9a1d6b46e12df13c80b8b51f02cdc8859ff65a222968c1f3ab2484440'),
				preKeyId: 10882773,
				ourSignedPreKey: hexToArrayBuffer('b1899b87fa3f6e84894cffded76843ef339f41474ec1ccf1a1c068046c18fb61'),
				signedPreKeyId: 2317088,
				ourIdentityKey: hexToArrayBuffer('18a3c6d4e4522e8f224c0b1efffdc1d91e6aced52f9fa18e14b888eec462394b'),
				newEphemeralKey: hexToArrayBuffer('5108fbaaf136969412c691dfbf6108c64cde5235fc30015c5b62d2188784887b'),
				expectedSmsText: "C",
			}],
		["sendMessage",
			{
				smsText: "D",
				expectedCiphertext: hexToArrayBuffer('330a21051b6216eb6bb717294b6140f129f1c706b073e80a57f9c44a912be90489f5214f1000180022a0011b73670e71cc82d5f4d487bfbdf0c6210eacefdb45fe4a4b7aeda5b390873d0e66aa9b2b968d74bbed4dfff9c3ce2c3613afc6cd6711d68335e3b07929ae92c2083ebbb7e212a6af4a799a8f5245806c96dc7f73e99e8b45a6ee81be3fbe2ddc52b1eee7c888e29070ffacbb8adcb4eca9165a7a7036acd5adda63a1a7fb5ee45f9fefb697e96c205f069a2e0d7b005a1255c4ca5fc0c6d263920dd2657835bc7888c173a441b9f4'),
			}],
		];

	// Now shuffle them around and make 6 tests
	tests[tests.length] = {name: "Axolotl End Session Test Vectors as Bob", vectors: axolotlEndSessionTestVectorsBob};

	var axolotlEndSessionTestVectorsBobCopy = function() {
		var orig = axolotlEndSessionTestVectorsBob;
		var v = [];
		for (var i = 0; i < axolotlEndSessionTestVectorsBob.length; i++) {
			v[i] = [];
			v[i][0] = orig[i][0];
			v[i][1] = orig[i][1];
		}
		return v;
	}

	tests[tests.length] = function() {
		// Copy axolotlTwoPartyTestVectorsBob into v
		var v = axolotlEndSessionTestVectorsBobCopy();
		var orig = axolotlEndSessionTestVectorsBob;

		// Swap message 2 and 3, moving 2 after its session close
		var tmp = v[2][1];
		v[2][1] = v[1][1];
		v[1][1] = tmp;

		return {name: "Shuffled End Session Axolotl Test Vectors as Bob I", vectors: v};
	}();

	tests[tests.length] = function() {
		// Copy axolotlTwoPartyTestVectorsBob into v
		var v = axolotlEndSessionTestVectorsBobCopy();
		var orig = axolotlEndSessionTestVectorsBob;

		// Swap message 2 and 4, moving 2 after the new session
		var tmp = v[3][1];
		v[3][1] = v[1][1];
		v[1][1] = tmp;

		return {name: "Shuffled End Session Axolotl Test Vectors as Bob II", vectors: v};
	}();

	tests[tests.length] = function() {
		// Copy axolotlTwoPartyTestVectorsBob into v
		var v = axolotlEndSessionTestVectorsBobCopy();
		var orig = axolotlEndSessionTestVectorsBob;

		// Swap message 3 and 4, starting a new session before closing the last
		var tmp = v[3][1];
		v[3][1] = v[2][1];
		v[2][1] = tmp;

		return {name: "Shuffled End Session Axolotl Test Vectors as Bob III", vectors: v};
	}();

	tests[tests.length] = function() {
		// Copy axolotlTwoPartyTestVectorsBob into v
		var v = axolotlEndSessionTestVectorsBobCopy();
		var orig = axolotlEndSessionTestVectorsBob;

		// Swap message 3 and 4, starting a new session before closing the last
		var tmp = v[3][1];
		v[3][1] = v[2][1];
		v[2][1] = tmp;

		//...and also swap 4 and 5, sending before the last is closed
		tmp = v[3][1];
		v[3] = ["sendMessage", v[4][1]];
		v[4] = ["receiveMessage", tmp];

		return {name: "Shuffled End Session Axolotl Test Vectors as Bob IV", vectors: v};
	}();

	tests[tests.length] = function() {
		// Copy axolotlTwoPartyTestVectorsBob into v
		var v = axolotlEndSessionTestVectorsBobCopy();
		var orig = axolotlEndSessionTestVectorsBob;

		// Put the end session message before all the cooresponding messages
		var tmp = v[0][1];
		v[0][1] = { message: orig[2][1].message, type: orig[2][1].type, expectTerminateSession: orig[2][1].expectTerminateSession };
		v[0][1].ourPreKey = orig[0][1].ourPreKey;
		v[0][1].preKeyId = orig[0][1].preKeyId;
		v[0][1].ourSignedPreKey = orig[0][1].ourSignedPreKey;
		v[0][1].signedPreKeyId = orig[0][1].signedPreKeyId;
		v[0][1].registrationId = orig[0][1].registrationId;
		v[0][1].ourIdentityKey = orig[0][1].ourIdentityKey;
		v[0][1].newEphemeralKey = orig[0][1].newEphemeralKey;
		v[2][1] = { message: tmp.message, type: tmp.type, expectedSmsText: tmp.expectedSmsText };

		return {name: "Shuffled End Session Axolotl Test Vectors as Bob V", vectors: v};
	}();

	tests[tests.length] = function() {
		// Copy axolotlTwoPartyTestVectorsBob into v
		var v = axolotlEndSessionTestVectorsBobCopy();
		var orig = axolotlEndSessionTestVectorsBob;

		// Put the end session message before all the cooresponding messages
		var tmp = v[0][1];
		v[0][1] = { message: orig[2][1].message, type: orig[2][1].type, expectTerminateSession: orig[2][1].expectTerminateSession };
		v[0][1].ourPreKey = orig[0][1].ourPreKey;
		v[0][1].preKeyId = orig[0][1].preKeyId;
		v[0][1].ourSignedPreKey = orig[0][1].ourSignedPreKey;
		v[0][1].signedPreKeyId = orig[0][1].signedPreKeyId;
		v[0][1].registrationId = orig[0][1].registrationId;
		v[0][1].ourIdentityKey = orig[0][1].ourIdentityKey;
		v[0][1].newEphemeralKey = orig[0][1].newEphemeralKey;
		v[2][1] = { message: tmp.message, type: tmp.type, expectedSmsText: tmp.expectedSmsText };

		// ... and also open a new session before receiving the pending messages
		tmp = v[3][1];
		v[3][1] = v[2][1];
		v[2][1] = tmp;

		return {name: "Shuffled End Session Axolotl Test Vectors as Bob VI", vectors: v};
	}();

	// Nearly same as above except as Alice
	var axolotlEndSessionTestVectorsAlice = [
		["sendMessage",
			{
				smsText: "A",
				ourBaseKey: hexToArrayBuffer('b9f458404bb8d9a50b4c58fd373ec109f83dc820ae410d6f933c6f9a72e35e4c'),
				ourEphemeralKey: hexToArrayBuffer('9133b17c81c14cdf89b3cd449c7b2ad9c91c223a2e627cc9619e20fbac1b8b6a'),
				ourIdentityKey: hexToArrayBuffer('a898043b1b447cfae63e2633e34c49d91cfbad8562c815e300c879e10d4c3456'),
				registrationId: 5405,
				getKeys: {identityKey: hexToArrayBuffer('056c8e7e99343ae057d3962465a42f9b493e35d06c29140fb95bf01bf8b185852f'),
						devices: [{
							deviceId: 1,
							preKey: {keyId: 6598766, publicKey: hexToArrayBuffer('05cbb234552f2b607fc0b08d76d78dd8ce1f6fc7e2dab8dc5103747cfb398b990d')},
							signedPreKey: {keyId: 1564819, publicKey: hexToArrayBuffer('05ac707620d65fe630483f17b43f281d6310d43c3a8d2a27d870300a992f241b5e')},
							registrationId: 2966
						}]
					},
				expectedCiphertext: hexToArrayBuffer('3308eee09203122105266863a2585d725c244d440ef03a4ffee9a194a454f92b48500210342cf47e171a2105a028c496fa0850958a9ff1a1dfa528f75fa26a763b168de533f01be99b6b971422d301330a2105cbacb784b46fff7eed25243c96d280306b6336ffb6072b425f3fad2d3f9a1c581000180022a001efa8f1802e2e407754ec82aa7cfc18285733dce8d1bdd9ef934599c816b6d942949391184a74f2f1f156d515a91d9b09352d4116bdb023704c7d5d45b1ed7c9a2555d272fd81d871b9a1c8946ea84d094bb44e184ba03a0fd46c8ac827a05e682c6adb10626cfd98d8e267d6bb7daba7dff77affea1d090592fbe6929736154c16c4648da485b3a5996c8e3536b25844fb2763b2c62fbbcecd21608252e27b34dfd3eb6c618c284b289d2a3093c15f'),
			}],
		["sendMessage",
			{
				smsText: "B",
				expectedCiphertext: hexToArrayBuffer('3308eee09203122105266863a2585d725c244d440ef03a4ffee9a194a454f92b48500210342cf47e171a2105a028c496fa0850958a9ff1a1dfa528f75fa26a763b168de533f01be99b6b971422d301330a2105cbacb784b46fff7eed25243c96d280306b6336ffb6072b425f3fad2d3f9a1c581001180022a001744576061111ffb4e2df634cf2b155e1cc6d252d3f72cd5d7bad5cb68dc46fc7822176975087abddc65b34d5dc2f644314b4be4deb01e050904ff2c067491324736305c8fc8ce7527d1b6e1c20a08f2d3b3208eacb6e6ce0b8af80f941cc7de1b2d625ae8cdd2e40a2ab27aafe13377bc2a407014492a3a9f21cbf0207997873697d02cd7eea97981860a574333e098c4f55094742c24cfbc73da2640609dc2566e9ed7834240ac5289d2a3093c15f'),
			}],
		["sendMessage",
			{
				endSession: true,
				expectedCiphertext: hexToArrayBuffer('3308eee09203122105266863a2585d725c244d440ef03a4ffee9a194a454f92b48500210342cf47e171a2105a028c496fa0850958a9ff1a1dfa528f75fa26a763b168de533f01be99b6b971422d301330a2105cbacb784b46fff7eed25243c96d280306b6336ffb6072b425f3fad2d3f9a1c581002180022a001e0b7b0679fa466e677a3e18a28b574c286c59ac48dbf5b5e24e289b7222a2353726ad190aa4ab1cc57d8ac50711adb32ebbed369214bde90a66bcc0b042970224206cb05dd02fab534f12e07e7c909fbbf77e678fb282b81298bc01eae024db13eba6b915651487a06a9b62606c844406496c0c878c6c3422d709d8b08db4d22a7c09a036a3aed6479e0ad07da2f6dfc0b9ee58b11a46d72fe38b662e1c09604a76358b7856dadd7289d2a3093c15f'),
			}],
		["sendMessage",
			{
				smsText: "C",
				ourBaseKey: hexToArrayBuffer('49a4bb5a4da5ddd29697ff77f787177cd9da36007e456e77bc9107a9f4392b66'),
				ourEphemeralKey: hexToArrayBuffer('a189e070781266fbc55e27180a6654e496e98f47e98b0a9e9c4e5e66219dd56e'),
				ourIdentityKey: hexToArrayBuffer('a898043b1b447cfae63e2633e34c49d91cfbad8562c815e300c879e10d4c3456'),
				registrationId: 5405,
				getKeys: {identityKey: hexToArrayBuffer('056c8e7e99343ae057d3962465a42f9b493e35d06c29140fb95bf01bf8b185852f'),
						devices: [{
							deviceId: 1,
							preKey: {keyId: 6598767, publicKey: hexToArrayBuffer('054508c2343459b6a0085f216885096ffa7b8312d073b9bcd1748423b1bfc1ab42')},
							signedPreKey: {keyId: 1564819, publicKey: hexToArrayBuffer('05ac707620d65fe630483f17b43f281d6310d43c3a8d2a27d870300a992f241b5e')},
							registrationId: 2966
						}]
					},
				expectedCiphertext: hexToArrayBuffer('3308efe092031221054057ff80fb53953c149baf1628fb91b8fcd7df883bf63e94b1bab4037d20966a1a2105a028c496fa0850958a9ff1a1dfa528f75fa26a763b168de533f01be99b6b971422d301330a210591ce9658f1587e42d16b76bfc5035837becde75d630802353c5a215612b385431000180022a001cfd82605cf03277ea76d0c65c9c906a0c4568e312ae9c869ebfcca8c5fe4fe2e80e8eb8d674da589cc45522431903fd0540d4c84bc296332273c165ccbb443859fa697a809a33009a7df03a6f32ac9621807433a456227020e209eec06898af1291e5acf2285ea77aeb04c416464b1e5345a4bf237c3004a0b6f8d334c5783599ea4c1e68d2198872cda7e4e224b24a8fac5e17ce641763f4b14a45a48cc7bcf14e69b2a9272a156289d2a3093c15f'),
			}],
		];

	tests[tests.length] = {name: "Standard End Session Axolotl Test Vectors as Alice", vectors: axolotlEndSessionTestVectorsAlice};

	// Nearly same as above except as Alice
	var axolotlNoPreKeyEndSessionTestVectorsBob = [
		["receiveMessage",
			{
				message: hexToArrayBuffer('3308ffffffff0f1221050a1fe3a769c05c50e8f09747969099d072f4c343b09ceae56543391349b5bc701a21053841429a37322af3f786be4df3dd8cea5403a79f258e254d4738970acbbe633422d301330a2105896760e61f619db748eb761225b49890aa4e5b286ff8d0575a06660158e40d4e1000180022a0010ced8428b53359fcf2f3dbb6f8be97e77309481df1013a86db4bd41aebc94f7c9d0077c81f53b96501caeece31bd8171f25255ebfe774a981f007849aa38da51904c57a1334a5a11d983205c4cb49e9dd7f308678e34734e6eb9a9297cf03abc8bdd1b1a07c9445474136656ac38cf5ddf41606cf511e20c002fd74bf4b1f8cec738c380b8d4dae0afa0ffc7e091ef5382787eb678b2d9c61dd6fa4ec146c8c30aade6666ee4325228ac3930a0b68d01'),
				type: 3,
				//ourPreKey: hexToArrayBuffer(''),
				//preKeyId: -1,
				ourSignedPreKey: hexToArrayBuffer('b1899b87fa3f6e84894cffded76843ef339f41474ec1ccf1a1c068046c18fb61'),
				signedPreKeyId: 2317088,
				ourIdentityKey: hexToArrayBuffer('18a3c6d4e4522e8f224c0b1efffdc1d91e6aced52f9fa18e14b888eec462394b'),
				newEphemeralKey: hexToArrayBuffer('d10237bd4906b68aa3c9105376747a30fb71ef8a2de9f4f5121f4ca458347355'),
				expectedSmsText: "A",
			}],
		["receiveMessage",
			{
				message: hexToArrayBuffer('3308ffffffff0f1221050a1fe3a769c05c50e8f09747969099d072f4c343b09ceae56543391349b5bc701a21053841429a37322af3f786be4df3dd8cea5403a79f258e254d4738970acbbe633422d301330a2105896760e61f619db748eb761225b49890aa4e5b286ff8d0575a06660158e40d4e1001180022a0019ac9ba3b905c2a92bef7ece4d3c741cedcd05d15dd848be7fa5034db6de7835414f803b40301cf5b8c144b13582322d81dfbe3cf5db237595d16706b1cf2258bcf75b5ac69174341eb931c65a52130825c1f1f97641a7cc1c90c530e7cde0c09919ceb0ada3ea8d987295884f4d42561d793129035b8d298cab1fcba8f7a0bec75a1fe4a3440d59dd48c18f0372ab6952da75bf7f350d28132900e8c48210795aaf4296255be120428ac3930a0b68d01'),
				type: 3,
				expectedSmsText: "B",
			}],
		["sendMessage",
			{
				smsText: "C",
				expectedCiphertext: hexToArrayBuffer('330a21051b4f7303e61b8e0f08dca7b31ce01151831d572e31270b3d291214a6e193b27b1000180022a0015b2f37c95192845d947febe6be26ded465f6d98ccef660216d17887dc32d32609ba7a91d3a332539faf483315952c79383fdd5b9768d4b42c665f5c117e2e1f82e10e07a61f63e8318ff687b3e3704336a9ed76565e088706704b680a6931f9adeacb7320c69c043b72db6b3d19646d67be2112be53e782e3b0f4523c6a019f4a693d1ced9d2379763e867ab2d7a03eb222948e1ce86a515d2da519336f7be53bc19af1c68326b3b'),
			}],
		["sendMessage",
			{
				smsText: "D",
				expectedCiphertext: hexToArrayBuffer('330a21051b4f7303e61b8e0f08dca7b31ce01151831d572e31270b3d291214a6e193b27b1001180022a0016637465b06e81e2bf100cc7ff5dada7c837374b6a51123e6770d7c2ef032436255cdf866487da20de412efa5b99633aa76d833f8542d6d93d21cd2672904783079e4908a126708dfdfb087f48053bc16e3e28e8ac913d55fc25fb59e9bb3f6009a6938aaa86dbb911984d1425f4b4c959e71faeb85a0a017662d5d5a315b341966baf6dc8fa2e9736655d82249741fdcdb93a432346e218b153e5fbef5f064d9e6f6211cb9a6af36'),
			}],
		["receiveMessage",
			{
				message: hexToArrayBuffer('330a21056076ed503123ff2662f1c3fce3f0d49084351d0a25fc08d67115a336e8d4be5c1000180122a0012cc6305372c347f141f7690ecc7cf2cc3a47c2c12d3a492e3be7fd6e2723e29e5e858378781d45eb795f32d47f8539987687db4b54e420b06980700b9c5bfe1780445a097c8a47f94080a4e8d88fe12a2c37e04bcb22e23685b7b955391f99ac2da52fbbb25d83269b6584c68de3b61f7f37ffda8c7350a15e798ca59891dd8f62f59afe3544c4a99118edddda322f4aa516536a64dce05e091b125fb06a9c37501e344b993f2a8b'),
				type: 1,
				expectTerminateSession: true,
				newEphemeralKey: hexToArrayBuffer('3131dd7adb8c2eb01e10d6441ede57e499b929354740cea99f6e79fea0eadf58'),
			}],
		["receiveMessage",
			{
				message: hexToArrayBuffer('330a21056076ed503123ff2662f1c3fce3f0d49084351d0a25fc08d67115a336e8d4be5c1001180122a001f0898aaaaa4f7928793c4c14b16256e5b797e99a55e12b69242ed4086fb5c1f71982b683f2324305ebccb2eaae146ee783b23f8cebb0aa970e209e554b4ae6140ef30f2f0d83b73ca3f74075194574a9c260ad0e1d08df218aa334ead582efa9a8e705ff17a8e22994a4ac91359cadf9b9cf6853eae12a4bd9c5e5bcad4b8ca991005f0699a5960d09244fa2f01e9f0fb50e85f7318556b314358bfd0fbbc8055dc1090c7d214d83'),
				type: 1,
				expectException: true,
			}],
		["receiveMessage",
			{
				message: hexToArrayBuffer('3308ffffffff0f122105018086d77ab095075239bc2e54a24355114985c8c897b1a56d253d3449ba416b1a21053841429a37322af3f786be4df3dd8cea5403a79f258e254d4738970acbbe633422d301330a2105578d8b0420b0b68fe817772d4dd4f5eea2f786da22f33a109b57adb7ad084c6f1000180022a001cb7303e83ac80b6cd251a93107061aa96ad7bd9b2983a597ba500b0d3402e93af6bcc9304f1ca3a37e9e5a26743ec50dea620c474cec8101a5439cb357c1a4479bb50b33061405fbfddae119edead07ff4fd292f5d6666fc94b8d36cd96ef6fd58fc70d478b182f3cf15a8f1be6a51e560671f901e09fa8b2376462a4cc953751ddc027e15cd0a92f86bb40d3b199b2dab1e0c2e208b104a2594220ff6129f0650ca8aff90c6e06228ac3930a0b68d01'),
				type: 3,
				//ourPreKey: hexToArrayBuffer(''),
				//preKeyId: -1,
				ourSignedPreKey: hexToArrayBuffer('b1899b87fa3f6e84894cffded76843ef339f41474ec1ccf1a1c068046c18fb61'),
				signedPreKeyId: 2317088,
				ourIdentityKey: hexToArrayBuffer('18a3c6d4e4522e8f224c0b1efffdc1d91e6aced52f9fa18e14b888eec462394b'),
				newEphemeralKey: hexToArrayBuffer('c9411ca8636f8462308135ae6aff6ec30338ae2c87808b6ee35ef21530971070'),
				expectedSmsText: "F",
			}],
		];

	tests[tests.length] = {name: "No-PreKey fake end-session test as Bob", vectors: axolotlNoPreKeyEndSessionTestVectorsBob};

	return tests;
}();
