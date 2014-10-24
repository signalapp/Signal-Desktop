/* vim: ts=4:sw=4:expandtab
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

/* Web Crypto polyfill. TODO: replace with web crypto */
// All inputs/outputs are arraybuffers!
window.textsecure.subtle = (function() {
/*    if (window.crypto.subtle !== undefined && window.crypto.subtle !== null) {
            return window.crypto.subtle;
    } else*/ {
        var StaticArrayBufferProto = new ArrayBuffer().__proto__;
        function assertIsArrayBuffer(thing) {
            if (thing !== Object(thing) || thing.__proto__ != StaticArrayBufferProto)
                throw new Error("Needed a ArrayBuffer");
        }

        // private implementation functions
        function HmacSHA256(key, input) {
            assertIsArrayBuffer(key);
            assertIsArrayBuffer(input);
            return CryptoJS.HmacSHA256(
                    CryptoJS.lib.WordArray.create(toArrayBuffer(input)),
                    CryptoJS.enc.Latin1.parse(getString(key))
                ).toString(CryptoJS.enc.Latin1);
        };

        function encryptAESCTR(plaintext, key, counter) {
            assertIsArrayBuffer(plaintext);
            assertIsArrayBuffer(key);
            assertIsArrayBuffer(counter);
                return CryptoJS.AES.encrypt(CryptoJS.enc.Latin1.parse(getString(plaintext)),
                        CryptoJS.enc.Latin1.parse(getString(key)),
                        {mode: CryptoJS.mode.CTR, iv: CryptoJS.enc.Latin1.parse(getString(counter)),
                            padding: CryptoJS.pad.NoPadding})
                    .ciphertext.toString(CryptoJS.enc.Latin1);
        };

        function decryptAESCTR(ciphertext, key, counter) {
            assertIsArrayBuffer(ciphertext);
            assertIsArrayBuffer(key);
            assertIsArrayBuffer(counter);
                return CryptoJS.AES.decrypt(btoa(getString(ciphertext)),
                        CryptoJS.enc.Latin1.parse(getString(key)),
                        {mode: CryptoJS.mode.CTR, iv: CryptoJS.enc.Latin1.parse(getString(counter)),
                            padding: CryptoJS.pad.NoPadding})
                    .toString(CryptoJS.enc.Latin1);
        };

        function decryptAESCBC(ciphertext, key, iv) {
            assertIsArrayBuffer(ciphertext);
            assertIsArrayBuffer(key);
            assertIsArrayBuffer(iv);
            return CryptoJS.AES.decrypt(btoa(getString(ciphertext)),
                    CryptoJS.enc.Latin1.parse(getString(key)),
                    {iv: CryptoJS.enc.Latin1.parse(getString(iv))})
                .toString(CryptoJS.enc.Latin1);
        };

        // utility function for connecting front and back ends via promises
        // Takes an implementation function and 0 or more arguments
        function promise(implementation) {
            var args = Array.prototype.slice.call(arguments);
            args.shift();
            return Promise.resolve(toArrayBuffer(implementation.apply(this, args)));
        }

        // public interface functions
        function encrypt(algorithm, key, data) {
            if (algorithm.name === "AES-CTR")
                return promise(encryptAESCTR, data, key, algorithm.counter);
        };
        function decrypt(algorithm, key, data) {
            if (algorithm.name === "AES-CTR")
                return promise(decryptAESCTR, data, key, algorithm.counter);
            if (algorithm.name === "AES-CBC")
                return promise(decryptAESCBC, data, key, algorithm.iv);
        };
        function sign(algorithm, key, data) {
            if (algorithm.name === "HMAC" && algorithm.hash === "SHA-256")
                return promise(HmacSHA256, key, data);
        };

        return {
            encrypt     : encrypt,
            decrypt     : decrypt,
            sign        : sign,
        }
    }
})();
