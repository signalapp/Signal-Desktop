/*
 * vim: ts=4:sw=4:expandtab
 */

;(function(){
    'use strict';

    var encrypt      = libsignal.crypto.encrypt;
    var decrypt      = libsignal.crypto.decrypt;
    var calculateMAC = libsignal.crypto.calculateMAC;
    var verifyMAC    = libsignal.crypto.verifyMAC;

    var PROFILE_IV_LENGTH = 12;   // bytes
    var PROFILE_KEY_LENGTH = 32;  // bytes
    var PROFILE_TAG_LENGTH = 128; // bits

    function verifyDigest(data, theirDigest) {
        return crypto.subtle.digest({name: 'SHA-256'}, data).then(function(ourDigest) {
            var a = new Uint8Array(ourDigest);
            var b = new Uint8Array(theirDigest);
            var result = 0;
            for (var i=0; i < theirDigest.byteLength; ++i) {
                result = result | (a[i] ^ b[i]);
            }
            if (result !== 0) {
              throw new Error('Bad digest');
            }
        });
    }
    function calculateDigest(data) {
        return crypto.subtle.digest({name: 'SHA-256'}, data);
    }

    window.textsecure = window.textsecure || {};
    window.textsecure.crypto = {
        // Decrypts message into a raw string
        decryptWebsocketMessage: function(message, signaling_key) {
            var decodedMessage = message.toArrayBuffer();

            if (signaling_key.byteLength != 52) {
                throw new Error("Got invalid length signaling_key");
            }
            if (decodedMessage.byteLength < 1 + 16 + 10) {
                throw new Error("Got invalid length message");
            }
            if (new Uint8Array(decodedMessage)[0] != 1) {
                throw new Error("Got bad version number: " + decodedMessage[0]);
            }

            var aes_key = signaling_key.slice(0, 32);
            var mac_key = signaling_key.slice(32, 32 + 20);

            var iv = decodedMessage.slice(1, 1 + 16);
            var ciphertext = decodedMessage.slice(1 + 16, decodedMessage.byteLength - 10);
            var ivAndCiphertext = decodedMessage.slice(0, decodedMessage.byteLength - 10);
            var mac = decodedMessage.slice(decodedMessage.byteLength - 10, decodedMessage.byteLength);

            return verifyMAC(ivAndCiphertext, mac_key, mac, 10).then(function() {
                return decrypt(aes_key, ciphertext, iv);
            });
        },

        decryptAttachment: function(encryptedBin, keys, theirDigest) {
            if (keys.byteLength != 64) {
                throw new Error("Got invalid length attachment keys");
            }
            if (encryptedBin.byteLength < 16 + 32) {
                throw new Error("Got invalid length attachment");
            }

            var aes_key = keys.slice(0, 32);
            var mac_key = keys.slice(32, 64);

            var iv = encryptedBin.slice(0, 16);
            var ciphertext = encryptedBin.slice(16, encryptedBin.byteLength - 32);
            var ivAndCiphertext = encryptedBin.slice(0, encryptedBin.byteLength - 32);
            var mac = encryptedBin.slice(encryptedBin.byteLength - 32, encryptedBin.byteLength);

            return verifyMAC(ivAndCiphertext, mac_key, mac, 32).then(function() {
                if (theirDigest !== null) {
                  return verifyDigest(encryptedBin, theirDigest);
                }
            }).then(function() {
                return decrypt(aes_key, ciphertext, iv);
            });
        },

        encryptAttachment: function(plaintext, keys, iv) {
            if (keys.byteLength != 64) {
                throw new Error("Got invalid length attachment keys");
            }
            if (iv.byteLength != 16) {
                throw new Error("Got invalid length attachment iv");
            }
            var aes_key = keys.slice(0, 32);
            var mac_key = keys.slice(32, 64);

            return encrypt(aes_key, plaintext, iv).then(function(ciphertext) {
                var ivAndCiphertext = new Uint8Array(16 + ciphertext.byteLength);
                ivAndCiphertext.set(new Uint8Array(iv));
                ivAndCiphertext.set(new Uint8Array(ciphertext), 16);

                return calculateMAC(mac_key, ivAndCiphertext.buffer).then(function(mac) {
                    var encryptedBin = new Uint8Array(16 + ciphertext.byteLength + 32);
                    encryptedBin.set(ivAndCiphertext);
                    encryptedBin.set(new Uint8Array(mac), 16 + ciphertext.byteLength);
                    return calculateDigest(encryptedBin.buffer).then(function(digest) {
                        return { ciphertext: encryptedBin.buffer, digest: digest };
                    });
                });
            });
        },
        encryptProfile: function(data, key) {
          var iv = libsignal.crypto.getRandomBytes(PROFILE_IV_LENGTH);
          if (key.byteLength != PROFILE_KEY_LENGTH) {
              throw new Error("Got invalid length profile key");
          }
          if (iv.byteLength != PROFILE_IV_LENGTH) {
              throw new Error("Got invalid length profile iv");
          }
          return crypto.subtle.importKey('raw', key, {name: 'AES-GCM'}, false, ['encrypt']).then(function(key) {
            return crypto.subtle.encrypt({name: 'AES-GCM', iv: iv, tagLength: PROFILE_TAG_LENGTH}, key, data).then(function(ciphertext) {
              var ivAndCiphertext = new Uint8Array(PROFILE_IV_LENGTH + ciphertext.byteLength);
              ivAndCiphertext.set(new Uint8Array(iv));
              ivAndCiphertext.set(new Uint8Array(ciphertext), PROFILE_IV_LENGTH);
              return ivAndCiphertext.buffer;
            });
          });
        },
        decryptProfile: function(data, key) {
          if (data.byteLength < 12 + 16 + 1) {
              throw new Error("Got too short input: " + data.byteLength);
          }
          var iv = data.slice(0, PROFILE_IV_LENGTH);
          var ciphertext = data.slice(PROFILE_IV_LENGTH, data.byteLength);
          if (key.byteLength != PROFILE_KEY_LENGTH) {
              throw new Error("Got invalid length profile key");
          }
          if (iv.byteLength != PROFILE_IV_LENGTH) {
              throw new Error("Got invalid length profile iv");
          }
          return crypto.subtle.importKey('raw', key, {name: 'AES-GCM'}, false, ['decrypt']).then(function(key) {
            return crypto.subtle.decrypt({name: 'AES-GCM', iv: iv, tagLength: PROFILE_TAG_LENGTH}, key, ciphertext);
          });
        },


        getRandomBytes: function(size) {
            return libsignal.crypto.getRandomBytes(size);
        }
    };
})();
