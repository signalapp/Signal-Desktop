/*
 * vim: ts=4:sw=4:expandtab
 */

;(function(){
    'use strict';

    // Various wrappers around low-level crypto operation for specific functions

    var encrypt = function(key, data, iv) {
        return window.crypto.subtle.importKey('raw', key, {name: 'AES-CBC'}, false, ['encrypt']).then(function(key) {
            return window.crypto.subtle.encrypt({name: 'AES-CBC', iv: new Uint8Array(iv)}, key, data);
        });
    };

    var decrypt = function(key, data, iv) {
        return window.crypto.subtle.importKey('raw', key, {name: 'AES-CBC'}, false, ['decrypt']).then(function(key) {
            return window.crypto.subtle.decrypt({name: 'AES-CBC', iv: new Uint8Array(iv)}, key, data);
        });
    };

    var calculateMAC = function(key, data) {
        return window.crypto.subtle.importKey('raw', key, {name: 'HMAC', hash: {name: 'SHA-256'}}, false, ['sign']).then(function(key) {
            return window.crypto.subtle.sign( {name: 'HMAC', hash: 'SHA-256'}, key, data);
        });
    };

    var verifyMAC = function(data, key, mac) {
        return calculateMAC(key, data).then(function(calculated_mac) {
            if (!isEqual(calculated_mac, mac, true))
                throw new Error("Bad MAC");
        });
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

            return verifyMAC(ivAndCiphertext, mac_key, mac).then(function() {
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

            return verifyMAC(ivAndCiphertext, mac_key, mac).then(function() {
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
            var array = new Uint8Array(size);
            window.crypto.getRandomValues(array);
            return array.buffer;
        }
    };
})();
