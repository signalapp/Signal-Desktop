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

'use strict';
window.assert = chai.assert;

describe("Crypto", function() {
    describe("Encrypt AES-CBC", function() {
        it('works', function(done) {
            var key = hexToArrayBuffer('603deb1015ca71be2b73aef0857d77811f352c073b6108d72d9810a30914dff4');
            var iv = hexToArrayBuffer('000102030405060708090a0b0c0d0e0f');
            var plaintext  = hexToArrayBuffer('6bc1bee22e409f96e93d7e117393172aae2d8a571e03ac9c9eb76fac45af8e5130c81c46a35ce411e5fbc1191a0a52eff69f2445df4f9b17ad2b417be66c3710');
            var ciphertext = hexToArrayBuffer('f58c4c04d6e5f1ba779eabfb5f7bfbd69cfc4e967edb808d679f777bc6702c7d39f23369a9d9bacfa530e26304231461b2eb05e2c39be9fcda6c19078c6a9d1b3f461796d6b0d6b2e0c2a72b4d80e644');
            window.axolotl.crypto.encrypt(key, plaintext, iv).then(function(result) {
                assertEqualArrayBuffers(result, ciphertext);
            }).then(done).catch(done);
        });
    });

    describe("Decrypt AES-CBC", function() {
        it('works', function(done) {
            var key = hexToArrayBuffer('603deb1015ca71be2b73aef0857d77811f352c073b6108d72d9810a30914dff4');
            var iv = hexToArrayBuffer('000102030405060708090a0b0c0d0e0f');
            var plaintext  = hexToArrayBuffer('6bc1bee22e409f96e93d7e117393172aae2d8a571e03ac9c9eb76fac45af8e5130c81c46a35ce411e5fbc1191a0a52eff69f2445df4f9b17ad2b417be66c3710');
            var ciphertext = hexToArrayBuffer('f58c4c04d6e5f1ba779eabfb5f7bfbd69cfc4e967edb808d679f777bc6702c7d39f23369a9d9bacfa530e26304231461b2eb05e2c39be9fcda6c19078c6a9d1b3f461796d6b0d6b2e0c2a72b4d80e644');
            window.axolotl.crypto.decrypt(key, ciphertext, iv).then(function(result) {
                assertEqualArrayBuffers(result, plaintext);
            }).then(done).catch(done);
        });
    });

    describe("HMAC SHA-256", function() {
        it("works", function(done) {
            var key = hexToArrayBuffer('6f35628d65813435534b5d67fbdb54cb33403d04e843103e6399f806cb5df95febbdd61236f33245');
            var input = hexToArrayBuffer('752cff52e4b90768558e5369e75d97c69643509a5e5904e0a386cbe4d0970ef73f918f675945a9aefe26daea27587e8dc909dd56fd0468805f834039b345f855cfe19c44b55af241fff3ffcd8045cd5c288e6c4e284c3720570b58e4d47b8feeedc52fd1401f698a209fccfa3b4c0d9a797b046a2759f82a54c41ccd7b5f592b');
            var mac = hexToArrayBuffer('05d1243e6465ed9620c9aec1c351a186');
            window.axolotl.crypto.sign(key, input).then(function(result) {
                assertEqualArrayBuffers(result.slice(0, mac.byteLength), mac);
            }).then(done).catch(done);
        });
    });


    describe("HKDF", function() {
        it('works', function(done) {
            // HMAC RFC5869 Test vectors
            var T1 = hexToArrayBuffer("3cb25f25faacd57a90434f64d0362f2a2d2d0a90cf1a5a4c5db02d56ecc4c5bf");
            var T2 = hexToArrayBuffer("34007208d5b887185865");
            var IKM = new Uint8Array(new ArrayBuffer(22));
            for (var i = 0; i < 22; i++)
                IKM[i] = 11;

            var salt = new Uint8Array(new ArrayBuffer(13));
            for (var i = 0; i < 13; i++)
                salt[i] = i;

            var info = new Uint8Array(new ArrayBuffer(10));
            for (var i = 0; i < 10; i++)
                info[i] = 240 + i;

            return axolotl.crypto.HKDF(IKM.buffer, salt.buffer, info.buffer).then(function(OKM){
                assertEqualArrayBuffers(OKM[0], T1);
                assertEqualArrayBuffers(OKM[1].slice(0, 10), T2);
            }).then(done).catch(done);
        });
    });

    var alice_bytes = hexToArrayBuffer("77076d0a7318a57d3c16c17251b26645df4c2f87ebc0992ab177fba51db92c2a");
    var alice_priv  = hexToArrayBuffer("70076d0a7318a57d3c16c17251b26645df4c2f87ebc0992ab177fba51db92c6a");
    var alice_pub   = hexToArrayBuffer("058520f0098930a754748b7ddcb43ef75a0dbf3a0d26381af4eba4a98eaa9b4e6a");
    var bob_bytes   = hexToArrayBuffer("5dab087e624a8a4b79e17f8b83800ee66f3bb1292618b6fd1c2f8b27ff88e0eb");
    var bob_priv    = hexToArrayBuffer("58ab087e624a8a4b79e17f8b83800ee66f3bb1292618b6fd1c2f8b27ff88e06b");
    var bob_pub     = hexToArrayBuffer("05de9edb7d7b7dc1b4d35b61c2ece435373f8343c85b78674dadfc7e146f882b4f");
    var shared_sec  = hexToArrayBuffer("4a5d9d5ba4ce2de1728e3bf480350f25e07e21c947d19e3376f09b3c1e161742");

    describe("createKeyPair", function() {
        it ('converts alice private keys to a keypair', function(done) {
            axolotl.crypto.createKeyPair(alice_bytes).then(function(keypair) {
                assertEqualArrayBuffers(keypair.privKey, alice_priv);
                assertEqualArrayBuffers(keypair.pubKey, alice_pub);
                done();
            }).catch(done);
        });
        it ('converts bob private keys to a keypair', function(done) {
            axolotl.crypto.createKeyPair(bob_bytes).then(function(keypair) {
                assertEqualArrayBuffers(keypair.privKey, bob_priv);
                assertEqualArrayBuffers(keypair.pubKey, bob_pub);
                done();
            }).catch(done);
        });
        it ('generates a key if one is not provided', function(done) {
            axolotl.crypto.createKeyPair().then(function(keypair) {
                assert.strictEqual(keypair.privKey.byteLength, 32);
                assert.strictEqual(keypair.pubKey.byteLength, 33);
                assert.strictEqual(new Uint8Array(keypair.pubKey)[0], 5);
                done();
            }).catch(done);
        });
    });

    describe("ECDHE", function() {
        it("computes the shared secret for alice", function(done) {
            axolotl.crypto.ECDHE(bob_pub, alice_priv).then(function(secret) {
                assertEqualArrayBuffers(shared_sec, secret);
                done();
            }).catch(done);
        });
        it("computes the shared secret for bob", function(done) {
            axolotl.crypto.ECDHE(alice_pub, bob_priv).then(function(secret) {
                assertEqualArrayBuffers(shared_sec, secret);
                done();
            }).catch(done);
        });
    });

    var priv = hexToArrayBuffer("48a8892cc4e49124b7b57d94fa15becfce071830d6449004685e387c62409973");
    var pub  = hexToArrayBuffer("0555f1bfede27b6a03e0dd389478ffb01462e5c52dbbac32cf870f00af1ed9af3a");
    var msg  = hexToArrayBuffer("617364666173646661736466");
    var sig  = hexToArrayBuffer("2bc06c745acb8bae10fbc607ee306084d0c28e2b3bb819133392473431291fd0dfa9c7f11479996cf520730d2901267387e08d85bbf2af941590e3035a545285");
    describe("Ed25519Sign", function() {
        // Some self-generated test vectors
        it('works', function(done) {
            return axolotl.crypto.Ed25519Sign(priv, msg).then(function(sigCalc) {
                assertEqualArrayBuffers(sig, sigCalc);
            }).then(done).catch(done);
        });
    });

    describe("Ed25519Verify", function() {
        it("throws on bad signature", function(done) {
            var badsig = sig.slice(0);
            new Uint8Array(badsig).set([0], 0);

            axolotl.crypto.Ed25519Verify(pub, msg, badsig).catch(function(e) {
                if (e.message === 'Invalid signature') {
                done();
                } else { throw e; }
            }).catch(done);
        });

        it("does not throw on good signature", function(done) {
            return axolotl.crypto.Ed25519Verify(pub, msg, sig).then(done).catch(done);
        });
    });
});
