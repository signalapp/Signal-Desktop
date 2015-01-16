// Copyright (c) 2014 Matt Corallo
// Distributed under the X11 software license, see the accompanying
// file MIT

axolotlTestVectors = function() {
    // We're gonna throw the finalized tests in here:
    var tests = [];

    // The common-case ALICE test vectors themselves...
    var axolotlTwoPartyTestVectorsAlice = [
        ["sendMessage",
            {
                smsText: "A",
                ourBaseKey: hexToArrayBuffer('08474c43256fb3bde899d899c3e997b24b94839c9f55a1f55ea671e7cdc55f5c'),
                ourEphemeralKey: hexToArrayBuffer('e0a18f35a04b7cfd246f72f3c7fe0fc3b000f5d11fe548e818775b7e9d93a94c'),
                ourIdentityKey: hexToArrayBuffer('a0f1dcf3d76ce4b538684b3360039bfde3ce59bca74449a01276e3ec395f4060'),
                registrationId: 9784,
                getKeys: {identityKey: hexToArrayBuffer('05c7214f5c39c83ddf81c4d56e88a33285c95db5eb87eac67536003530f5d62628'),
                        devices: [{
                            deviceId: 1,
                            preKey: {keyId: 2803392, publicKey: hexToArrayBuffer('05a189dc5be02a35e32fafa5e8e4296ef74132e29d0033de26685f471301c80738')},
                            signedPreKey: {keyId: 15452175, publicKey: hexToArrayBuffer('05e59ff855c698d58a3ff0dd04a925ebe1deffe276df623ddd873fb934b7314413')},
                            registrationId: 42
                        }]
                    },
                expectedCiphertext: hexToArrayBuffer('3308c08dab01122105d51a5f0d744180bf49d1b71b5d77a66db9664a4806d8470b99bed6311b7ed1681a210596857fd3566a584bb7ff0664df4d11cfdba8e1a445e0930a527b7b139c6a897322d301330a210577874cb60271862f343d52984224e2558f828f336d68bd14fa4aaf5a1692be7d1000180022a001fa2af5c8688440c0bc45121ae2f6b9c6d5b8cf00acfee0d1a45f9e7b245636e1fa63b3062e2a6a9cd8be9096c375b413f71c2bb18054738c8440d1aa52997899d8bcedee6a93f6a295bdaf488e81188a9c88c4e841eb772b3194576c52bd8ef8fcbc5c29545fa38d2213c84d088f9843307f45c3254927f97c6f0afca9737a00d09146284f8948bbe69c755e47e6e571887bf57959b228ba9c2418f7bfc780b7bf1adbffd96276f328b84c308f90af07'),
            }],
        ["sendMessage",
            {
                smsText: "B",
                expectedCiphertext: hexToArrayBuffer('3308c08dab01122105d51a5f0d744180bf49d1b71b5d77a66db9664a4806d8470b99bed6311b7ed1681a210596857fd3566a584bb7ff0664df4d11cfdba8e1a445e0930a527b7b139c6a897322d301330a210577874cb60271862f343d52984224e2558f828f336d68bd14fa4aaf5a1692be7d1001180022a00138b6a0e9b02bd7347e7428cc443df228b7a58a28456812d0f100985937ac08cf729f8be6a38596d3611c035352845f9732901a42e3dd4761be43d231edba5a56bcd60f3534e8872816a1c9eed4383ec0cb958ce2e66f00f8e5c90c13ebe44af5516df5cb41dfb74818795881633e19fefe562d3e89013aafba0aa672dab3e418b02f3a5c4c28d1be1a47bf3a79a95cccf071debe38a093dab22027296bfb0caa892317d15c715b8c28b84c308f90af07'),
            }],
        ["receiveMessage",
            {
                message: hexToArrayBuffer('330a210519549798b47a051f48291f03140179329c03de0243459c5283d7b31d65b3ec661000180022a001dce182f136cc10858ecb48cd3299882de15006b179626f13d85f9353f64782df6afafefee527bab4ad7aedeb5863fdd0641d3db8bed305b4b64df6d1d39fa262058066430ea1fdd019b76cfcef4ae412214dd37f5a3e4270d48e278455fe94e2bd99940ec562703e45bbeab9a0a147e6e66af6b8188cb8bf7eaf18d601eb7637055e5528afce2e4a48ac49915a15aa23750f24644777a4c609f0f2fb4cbe93934dc8144f2ea3c888'),
                type: 1,
                newEphemeralKey: hexToArrayBuffer('d872c0de95e128656ddb3a2ac422ab9c5273415f6e55996a5dd395f915472052'),
                expectedSmsText: "C",
            }],
        ["receiveMessage",
            {
                message: hexToArrayBuffer('330a210519549798b47a051f48291f03140179329c03de0243459c5283d7b31d65b3ec661001180022a0014428b3743a7be1682237400d3997a6ccccc7aecbed3192d819e05b5dad8bd91d3ca1fcb39a6187a8c9fe1e0216f37aecb0178cf0f2998a1177e611f0f0ab18a1d528541eda02137a45b388377a13387e65c4bbdd468fa2da77e4de567828914225de8d27ed62e05d2da32b9ae19ac37cf903990973eef8616d58ab2b67848526244980f3827aee4e56d715500adac8f6d93fd8dd24d00a3a3e001a1f4b86049195f2d93815efd3f3'),
                type: 1,
                expectedSmsText: "D",
            }],
        ["sendMessage",
            {
                smsText: "E",
                expectedCiphertext: hexToArrayBuffer('330a21052f7f7ab6e0d172b8fcab6f7e4b7adef1dc25205d3642e665f11f5681798d99451000180122a001e492d8b25eaec22f39ff1c8cac2e8ac164d0ebb5894c20330e20ebce6dc58ea0469b3e0075657eebc6e04c1da3aed6d8ab7631412a017cc20bf18b433d2ead4fd40320e9093b8be5565d581fd679a3c296edeb463638353422ead082239f7047537c79a749d4949e3a21d98ec873506d27c5f1abea28d2faddd1f5d4e26c1633eaa213af5372daf8d76308097d54a97cee1164f2302784f21f6808d031a5650f8598069de06473b1'),
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
                message: hexToArrayBuffer('3308c08dab01122105d51a5f0d744180bf49d1b71b5d77a66db9664a4806d8470b99bed6311b7ed1681a210596857fd3566a584bb7ff0664df4d11cfdba8e1a445e0930a527b7b139c6a897322d301330a210577874cb60271862f343d52984224e2558f828f336d68bd14fa4aaf5a1692be7d1000180022a001fa2af5c8688440c0bc45121ae2f6b9c6d5b8cf00acfee0d1a45f9e7b245636e1fa63b3062e2a6a9cd8be9096c375b413f71c2bb18054738c8440d1aa52997899d8bcedee6a93f6a295bdaf488e81188a9c88c4e841eb772b3194576c52bd8ef8fcbc5c29545fa38d2213c84d088f9843307f45c3254927f97c6f0afca9737a00d09146284f8948bbe69c755e47e6e571887bf57959b228ba9c2418f7bfc780b7bf1adbffd96276f328b84c308f90af07'),
                type: 3,
                ourPreKey: hexToArrayBuffer('40a5ce4c6e21c2e686bed765c854b010117ea26fb08438994d84ffa516c7d84e'),
                preKeyId: 2803392,
                ourSignedPreKey: hexToArrayBuffer('280d9e0067b68c877c48120d400f5a16c0b3e74374149751777d1f3c49b2b355'),
                signedPreKeyId: 15452175,
                ourIdentityKey: hexToArrayBuffer('b8ee332fd87c5544ccd52afa8ce55140b25fd4ca4441a232799fe474ff4cae79'),
                newEphemeralKey: hexToArrayBuffer('400146d280077821aacaed96ad75b99ab665d2530ef5c061fad0e24bac285640'),
                expectedSmsText: "A",
            }],
        ["receiveMessage",
            {
                message: hexToArrayBuffer('3308c08dab01122105d51a5f0d744180bf49d1b71b5d77a66db9664a4806d8470b99bed6311b7ed1681a210596857fd3566a584bb7ff0664df4d11cfdba8e1a445e0930a527b7b139c6a897322d301330a210577874cb60271862f343d52984224e2558f828f336d68bd14fa4aaf5a1692be7d1001180022a00138b6a0e9b02bd7347e7428cc443df228b7a58a28456812d0f100985937ac08cf729f8be6a38596d3611c035352845f9732901a42e3dd4761be43d231edba5a56bcd60f3534e8872816a1c9eed4383ec0cb958ce2e66f00f8e5c90c13ebe44af5516df5cb41dfb74818795881633e19fefe562d3e89013aafba0aa672dab3e418b02f3a5c4c28d1be1a47bf3a79a95cccf071debe38a093dab22027296bfb0caa892317d15c715b8c28b84c308f90af07'),
                type: 3,
                expectedSmsText: "B",
            }],
        ["sendMessage",
            {
                smsText: "C",
                expectedCiphertext: hexToArrayBuffer('330a210519549798b47a051f48291f03140179329c03de0243459c5283d7b31d65b3ec661000180022a001dce182f136cc10858ecb48cd3299882de15006b179626f13d85f9353f64782df6afafefee527bab4ad7aedeb5863fdd0641d3db8bed305b4b64df6d1d39fa262058066430ea1fdd019b76cfcef4ae412214dd37f5a3e4270d48e278455fe94e2bd99940ec562703e45bbeab9a0a147e6e66af6b8188cb8bf7eaf18d601eb7637055e5528afce2e4a48ac49915a15aa23750f24644777a4c609f0f2fb4cbe93934dc8144f2ea3c888'),
            }],
        ["sendMessage",
            {
                smsText: "D",
                expectedCiphertext: hexToArrayBuffer('330a210519549798b47a051f48291f03140179329c03de0243459c5283d7b31d65b3ec661001180022a0014428b3743a7be1682237400d3997a6ccccc7aecbed3192d819e05b5dad8bd91d3ca1fcb39a6187a8c9fe1e0216f37aecb0178cf0f2998a1177e611f0f0ab18a1d528541eda02137a45b388377a13387e65c4bbdd468fa2da77e4de567828914225de8d27ed62e05d2da32b9ae19ac37cf903990973eef8616d58ab2b67848526244980f3827aee4e56d715500adac8f6d93fd8dd24d00a3a3e001a1f4b86049195f2d93815efd3f3'),
            }],
        ["receiveMessage",
            {
                message: hexToArrayBuffer('330a21052f7f7ab6e0d172b8fcab6f7e4b7adef1dc25205d3642e665f11f5681798d99451000180122a001e492d8b25eaec22f39ff1c8cac2e8ac164d0ebb5894c20330e20ebce6dc58ea0469b3e0075657eebc6e04c1da3aed6d8ab7631412a017cc20bf18b433d2ead4fd40320e9093b8be5565d581fd679a3c296edeb463638353422ead082239f7047537c79a749d4949e3a21d98ec873506d27c5f1abea28d2faddd1f5d4e26c1633eaa213af5372daf8d76308097d54a97cee1164f2302784f21f6808d031a5650f8598069de06473b1'),
                type: 1,
                newEphemeralKey: hexToArrayBuffer('b89a87781558e4e9d19ebefa103c1ccdb20b573678f0753500376decfa975e71'),
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
    /*var axolotlEndSessionTestVectorsBob = [
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
*/

    //TODO: GROUPS

    return tests;
}();
