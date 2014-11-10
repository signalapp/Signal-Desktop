/*
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

;(function() {
    'use strict';
    // Test for webcrypto support, polyfill if needed.
    if (window.crypto.subtle === undefined || window.crypto.subtle === null) {
        window.crypto.subtle = (function () {
            var StaticArrayBufferProto = new ArrayBuffer().__proto__;
            function assertIsArrayBuffer(thing) {
                if (thing !== Object(thing) || thing.__proto__ != StaticArrayBufferProto)
                    throw new Error("Needed a ArrayBuffer");
            }

            // Synchronous implementation functions for polyfilling webcrypto
            // All inputs/outputs are arraybuffers!
            function HmacSHA256(key, input) {
                assertIsArrayBuffer(key);
                assertIsArrayBuffer(input);
                return CryptoJS.HmacSHA256(
                    CryptoJS.enc.Latin1.parse(getString(input)),
                    CryptoJS.enc.Latin1.parse(getString(key))
                );
            };

            function encryptAESCBC(plaintext, key, iv) {
                assertIsArrayBuffer(plaintext);
                assertIsArrayBuffer(key);
                assertIsArrayBuffer(iv);
                return CryptoJS.AES.encrypt(
                        CryptoJS.enc.Latin1.parse(getString(plaintext)),
                        CryptoJS.enc.Latin1.parse(getString(key)),
                        { iv: CryptoJS.enc.Latin1.parse(getString(iv)) }
                ).ciphertext;
            };

            function decryptAESCBC(ciphertext, key, iv) {
                assertIsArrayBuffer(ciphertext);
                assertIsArrayBuffer(key);
                assertIsArrayBuffer(iv);
                return CryptoJS.AES.decrypt(
                        btoa(getString(ciphertext)),
                        CryptoJS.enc.Latin1.parse(getString(key)),
                        { iv: CryptoJS.enc.Latin1.parse(getString(iv)) }
                );
            };

            // utility function for connecting front and back ends via promises
            // Takes an implementation function and 0 or more arguments
            function promise(implementation) {
                var args = Array.prototype.slice.call(arguments);
                args.shift();
                return new Promise(function(resolve) {
                    var wordArray = implementation.apply(this, args);
                    // convert 32bit WordArray to array buffer
                    var buffer = new ArrayBuffer(wordArray.sigBytes);
                    var view =  new DataView(buffer);
                    for(var i = 0; i*4 < buffer.byteLength; i++) {
                      view.setInt32(i*4, wordArray.words[i]);
                    }
                    resolve(buffer);
                });
            };

            return {
                encrypt: function(algorithm, key, data) {
                    if (algorithm.name === "AES-CBC")
                        return promise(encryptAESCBC, data, key, algorithm.iv.buffer || algorithm.iv);
                },

                decrypt: function(algorithm, key, data) {
                    if (algorithm.name === "AES-CBC")
                        return promise(decryptAESCBC, data, key, algorithm.iv.buffer || algorithm.iv);
                },

                sign: function(algorithm, key, data) {
                    if (algorithm.name === "HMAC" && algorithm.hash === "SHA-256")
                        return promise(HmacSHA256, key, data);
                },

                importKey: function(format, key, algorithm, extractable, usages) {
                    return new Promise(function(resolve,reject){ resolve(key); });
                }
            };
        })();
    } // if !window.crypto.subtle
})();
