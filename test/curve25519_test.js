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

/*
 * We don't run any tests here, just define an abstract test function
 * that excercises our requirements for curve25519 interface, which are
 *
 * keyPair(privateKey)
 *   takes a 32-byte private key array buffer and outputs the corresponding
 *   public key as an array buffer
 *
 * sharedSecret(publicKey, privateKey)
 *  computes a shared secret from two curve25519 keys using the given keys
 *
 * sign(privateKey, message)
 *  computes a signature for the given message using a private key
 *
 * verify(publicKey, message, signature)
 *  verifies a signature for the given message using a public key
 *
 */

var test_curve25519_implementation = function(implementation) {
  describe("Curve25519", function() {
    var alice_bytes = hexToArrayBuffer("77076d0a7318a57d3c16c17251b26645df4c2f87ebc0992ab177fba51db92c2a");
    var alice_priv  = hexToArrayBuffer("70076d0a7318a57d3c16c17251b26645df4c2f87ebc0992ab177fba51db92c6a");
    var alice_pub   = hexToArrayBuffer("8520f0098930a754748b7ddcb43ef75a0dbf3a0d26381af4eba4a98eaa9b4e6a");
    var bob_bytes   = hexToArrayBuffer("5dab087e624a8a4b79e17f8b83800ee66f3bb1292618b6fd1c2f8b27ff88e0eb");
    var bob_priv    = hexToArrayBuffer("58ab087e624a8a4b79e17f8b83800ee66f3bb1292618b6fd1c2f8b27ff88e06b");
    var bob_pub     = hexToArrayBuffer("de9edb7d7b7dc1b4d35b61c2ece435373f8343c85b78674dadfc7e146f882b4f");
    var shared_sec  = hexToArrayBuffer("4a5d9d5ba4ce2de1728e3bf480350f25e07e21c947d19e3376f09b3c1e161742");

    describe("keyPair", function() {
        it ('converts alice private keys to a keypair', function(done) {
            implementation.keyPair(alice_bytes).then(function(keypair) {
              assertEqualArrayBuffers(keypair.privKey, alice_priv);
              assertEqualArrayBuffers(keypair.pubKey, alice_pub);
              done();
            }).catch(done);
        });
        it ('converts bob private keys to a keypair', function(done) {
            implementation.keyPair(bob_bytes).then(function(keypair) {
              assertEqualArrayBuffers(keypair.privKey, bob_priv);
              assertEqualArrayBuffers(keypair.pubKey, bob_pub);
              done();
            }).catch(done);
        });
    });

    describe("sharedSecret", function() {
      it("computes the shared secret for alice", function(done) {
          implementation.sharedSecret(bob_pub, alice_priv).then(function(secret) {
              assertEqualArrayBuffers(shared_sec, secret);
              done();
          }).catch(done);
      });
      it("computes the shared secret for bob", function(done) {
          implementation.sharedSecret(alice_pub, bob_priv).then(function(secret) {
              assertEqualArrayBuffers(shared_sec, secret);
              done();
          }).catch(done);
      });
    });

    var priv = hexToArrayBuffer("48a8892cc4e49124b7b57d94fa15becfce071830d6449004685e387c62409973");
    var pub  = hexToArrayBuffer("55f1bfede27b6a03e0dd389478ffb01462e5c52dbbac32cf870f00af1ed9af3a");
    var msg  = hexToArrayBuffer("617364666173646661736466");
    var sig  = hexToArrayBuffer("2bc06c745acb8bae10fbc607ee306084d0c28e2b3bb819133392473431291fd0dfa9c7f11479996cf520730d2901267387e08d85bbf2af941590e3035a545285");
    describe("sign", function() {
      it("computes the signature", function(done) {
        implementation.sign(priv, msg).then(function(signature) {
            assertEqualArrayBuffers(sig, signature);
            done();
        }).catch(done);
      });
    });

    describe("verify", function() {
      it("throws on bad signature", function(done) {
        var badsig = sig.slice(0);
        new Uint8Array(badsig).set([0], 0);

          implementation.verify(pub, msg, badsig).catch(function(e) {
            if (e.message === 'Invalid signature') {
              done();
            } else { throw e; }
          }).catch(done);
      });

      it("does not throw on good signature", function(done) {
        implementation.verify(pub, msg, sig).then(done).catch(done);
      });
    });
  });
};

