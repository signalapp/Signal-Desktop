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
;(function() {
    window.axolotl = window.axolotl || {};

    /*
     *  axolotl.crypto
     *    glues together various implementations into a single interface
     *    for all low-level crypto operations,
     */

    window.axolotl.crypto = {
        getRandomBytes: function(size) {
            // At some point we might consider XORing in hashes of random
            // UI events to strengthen ourselves against RNG flaws in crypto.getRandomValues
            // ie maybe take a look at how Gibson does it at https://www.grc.com/r&d/js.htm
            var array = new Uint8Array(size);
            window.crypto.getRandomValues(array);
            return array.buffer;
        },
        encrypt: function(key, data, iv) {
            return window.crypto.subtle.importKey('raw', key, {name: 'AES-CBC'}, false, ['encrypt']).then(function(key) {
                return window.crypto.subtle.encrypt({name: 'AES-CBC', iv: new Uint8Array(iv)}, key, data);
            });
        },
        decrypt: function(key, data, iv) {
            return window.crypto.subtle.importKey('raw', key, {name: 'AES-CBC'}, false, ['decrypt']).then(function(key) {
                return window.crypto.subtle.decrypt({name: 'AES-CBC', iv: new Uint8Array(iv)}, key, data);
            });
        },
        sign: function(key, data) {
            return window.crypto.subtle.importKey('raw', key, {name: 'HMAC', hash: {name: 'SHA-256'}}, false, ['sign']).then(function(key) {
                return window.crypto.subtle.sign( {name: 'HMAC', hash: 'SHA-256'}, key, data);
            });
        },

        HKDF: function(input, salt, info) {
            // Specific implementation of RFC 5869 that only returns the first 3 32-byte chunks
            // TODO: We dont always need the third chunk, we might skip it
            return window.axolotl.crypto.sign(salt, input).then(function(PRK) {
                var infoBuffer = new ArrayBuffer(info.byteLength + 1 + 32);
                var infoArray = new Uint8Array(infoBuffer);
                infoArray.set(new Uint8Array(info), 32);
                infoArray[infoArray.length - 1] = 1;
                return window.axolotl.crypto.sign(PRK, infoBuffer.slice(32)).then(function(T1) {
                    infoArray.set(new Uint8Array(T1));
                    infoArray[infoArray.length - 1] = 2;
                    return window.axolotl.crypto.sign(PRK, infoBuffer).then(function(T2) {
                        infoArray.set(new Uint8Array(T2));
                        infoArray[infoArray.length - 1] = 3;
                        return window.axolotl.crypto.sign(PRK, infoBuffer).then(function(T3) {
                            return [ T1, T2, T3 ];
                        });
                    });
                });
            });
        },

        // Curve 25519 crypto
        createKeyPair: function(privKey) {
            if (privKey === undefined) {
                privKey = axolotl.crypto.getRandomBytes(32);
            }
            if (privKey.byteLength != 32) {
                throw new Error("Invalid private key");
            }

            return window.curve25519.keyPair(privKey).then(function(raw_keys) {
                // prepend version byte
                var origPub = new Uint8Array(raw_keys.pubKey);
                var pub = new Uint8Array(33);
                pub.set(origPub, 1);
                pub[0] = 5;

                return { pubKey: pub.buffer, privKey: raw_keys.privKey };
            });
        },
        ECDHE: function(pubKey, privKey) {
            pubKey = validatePubKeyFormat(pubKey);
            if (privKey === undefined || privKey.byteLength != 32)
                throw new Error("Invalid private key");

            if (pubKey === undefined || pubKey.byteLength != 32)
                throw new Error("Invalid public key");

            return window.curve25519.sharedSecret(pubKey, privKey);
        },
        Ed25519Sign: function(privKey, message) {
            if (privKey === undefined || privKey.byteLength != 32)
                throw new Error("Invalid private key");

            if (message === undefined)
                throw new Error("Invalid message");

            return window.curve25519.sign(privKey, message);
        },
        Ed25519Verify: function(pubKey, msg, sig) {
            pubKey = validatePubKeyFormat(pubKey);

            if (pubKey === undefined || pubKey.byteLength != 32)
                throw new Error("Invalid public key");

            if (msg === undefined)
                throw new Error("Invalid message");

            if (sig === undefined || sig.byteLength != 64)
                throw new Error("Invalid signature");

            return window.curve25519.verify(pubKey, msg, sig);
        }
    };

    var validatePubKeyFormat = function(pubKey) {
        if (pubKey === undefined || ((pubKey.byteLength != 33 || new Uint8Array(pubKey)[0] != 5) && pubKey.byteLength != 32))
            throw new Error("Invalid public key");
        if (pubKey.byteLength == 33) {
            return pubKey.slice(1);
        } else {
            console.error("WARNING: Expected pubkey of length 33, please report the ST and client that generated the pubkey");
            return pubKey;
        }
    };

})();
