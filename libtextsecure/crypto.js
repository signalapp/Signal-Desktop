/*
 * vim: ts=4:sw=4:expandtab
 */

;(function(){
    'use strict';

    var encrypt      = libsignal.crypto.encrypt;
    var decrypt      = libsignal.crypto.decrypt;
    var calculateMAC = libsignal.crypto.calculateMAC;
    var verifyMAC    = libsignal.crypto.verifyMAC;

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

        decryptAttachment: function(encryptedBin, keys) {
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
                    return encryptedBin.buffer;
                });
            });
        },

        getRandomBytes: function(size) {
            return libsignal.crypto.getRandomBytes(size);
        }
    };
})();
