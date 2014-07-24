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
				message: hexToArrayBuffer('3308b8896f1221050b71f7b43cf24b70b80fcd0f3c2724a3efcbd194a7d9b46b04757c73ba4a58181a2105eeef4cd089a1b01cbd27ae8c5c4fc46c949c40db889ac1bd5363c3767167bf5122d301330a2105b19f1f4d00684eaf0271b7645356e3313d3d1a55848ca3858fec00e3c34bf60c1000180022a00154c90de4cd2531713f43aba32ee43d40aea071c9a19bdfa9ca04e66972208b31f2f6a97c73105ae192f8b7990113ef33b1c6e7a8fc7481b0b22b2279995e819a295aa076ae6d9670c96376260663f728ecd24ee71e9a5cced7e79dd01efa30bfd4e087ca3be65af8bdaf28dd097cc042b675cc80e66c9f8e8dfc82542b898fb9725acef0619522056f4bd18f8dfed859b2979d45ea64095bb0dd19ab5ab5f0bf1ecd73a516502f7d28823730dffc623a08aa53b8af6e52a86f'),
				type: 3,
				ourPreKey: hexToArrayBuffer('e1354a0f1c965b455a581bd1c38535810566bd2ff1b76248df9a05a382d44862'),
				preKeyId: 1819832,
				ourSignedPreKey: hexToArrayBuffer('11986d91051e87552a095fbf588cad3e0813f82e7e297aee866c0d433502c974'),
				signedPreKeyId: 1621599,
				ourIdentityKey: hexToArrayBuffer('c063b14b5d3282293acb065e73a45c0b02db15ff775d66469c01de023fd9c340'),
				newEphemeralKey: hexToArrayBuffer('e130fe7596d6e1b886d5e9be954b43c01a8c2b672989935c95e50bb7b3e54476'),
				expectedSmsText: "A",
			}],
		["receiveMessage",
			{
				message: hexToArrayBuffer('3308b8896f1221050b71f7b43cf24b70b80fcd0f3c2724a3efcbd194a7d9b46b04757c73ba4a58181a2105eeef4cd089a1b01cbd27ae8c5c4fc46c949c40db889ac1bd5363c3767167bf5122d301330a2105b19f1f4d00684eaf0271b7645356e3313d3d1a55848ca3858fec00e3c34bf60c1001180022a00192e2da45b87829811e1491f3383f269f6d5b20b76ca1783dfc64e1a360a4c417bdc7d4955699657716a4d700648c5d301c97ad189568a6b4ccb12e8d9a4537551a6aca14871756cd551e0da703c153ac9fb3c58fd008648c30c588c79324f58cfe4acc2b4444c623300bf0bd1619bbd75333f2c5afd298c90f6d3a506c97e64512df66b0e0d2a19de863311876b5b009f746fb2e49b8db38202d57cf1dff2f021aea0d9fbc3520bc28823730dffc623a08aa53b8af6e52a86f'),
				type: 3,
				expectedSmsText: "B",
			}],
		["sendMessage",
			{
				smsText: "C",
				expectedCiphertext: hexToArrayBuffer('330a2105bfaa1c2c963b89a1246a8740faae44089392416f20355d7d036e6a610423537c100018ffffffff0f22a00191f5a898f23b227e04436446956fc587425011118aec789bc0402010716b8a98071f4f52431b4b98db5515d8e89bf35fc83f3f220e173eb121d46a6645dde12a7970ec614a1eb379989a79965e668a90ba3357909a9ca5b76ea1793f47dcfc1cffd343cf0dfdeed0a1a4ea33f42c4effb87923ac3c240ea1134647075525cfc709165a707578bd7bbf13047f992782cd1201df7fcf01df6f8ef44585d4868b5c73e605b6e15612bf'),
			}],
		["sendMessage",
			{
				smsText: "D",
				expectedCiphertext: hexToArrayBuffer('330a2105bfaa1c2c963b89a1246a8740faae44089392416f20355d7d036e6a610423537c100118ffffffff0f22a00110ce40b78a14f999286ebd455ab1939d9dc16c346cd1d2d24e77156a802f5535a6c1c33d66da1493a0e5f296444a8208e6d88d831fa61c0a70ba52a25f817517010226ab72b4192ee394a3c957104ef6034de142f1033ae76a35530284575d7be404395d34b0de7eeee34f299d14ea811f8042bfb4d34aae565d212e2c7f246bb9bc1127edfcece449f1d0d1334cbc15b97dddb76068c2ff8dfd9e7f630bb08a0dceb58a4a231072'),
			}],
		["receiveMessage",
			{
				message: hexToArrayBuffer('330a2105d5f827f3214d70183a169bd32de9afd8dcdd05d3e96c7a105fb71f9ce18ff7621000180122a001ff2755491df88bab3be92f48a5846fa382d6a4a92dc24d036bb6dfd87be5fa3ee0be4ef60e78ff44baf1e9f78fa698b8db597d0717a0b6c396a3b776c3f2a21244462105ddda15389f116777fa63419ce5a16575fe118a2f46c8bc857daad0352ee3cb4f2940933c7309533f2e856d34747cc6d1237b7529e45bdbc003df1d744c03da07d77e2692295acdb667b403c7c55088f43451bdec48c5f96e5bd2389a87edc2fb44a1a3e8'),
				type: 1,
				newEphemeralKey: hexToArrayBuffer('214e876235741e8f496142594055dc9d9a6d217dddf62391af6745a925a11164'),
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
