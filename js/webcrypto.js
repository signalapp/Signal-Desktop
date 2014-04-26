/* Web Crypto polyfill. TODO: replace with web crypto */

window.crypto.subtle = (function() {
	if (window.crypto.subtle !== undefined && window.crypto.subtle !== null) {
			return window.crypto.subtle;
	} else {
		// private implementation functions
		function HmacSHA256(input, key) {
			return CryptoJS.HmacSHA256(
					CryptoJS.lib.WordArray.create(toArrayBuffer(input)),
					CryptoJS.enc.Latin1.parse(getString(key))
				).toString(CryptoJS.enc.Latin1);
		};

		function encryptAESCTR(plaintext, key, counter) {
				return CryptoJS.AES.encrypt(CryptoJS.enc.Latin1.parse(getString(plaintext)),
						CryptoJS.enc.Latin1.parse(getString(key)),
						{mode: CryptoJS.mode.CTR, iv: CryptoJS.enc.Latin1.parse(""),
							padding: CryptoJS.pad.NoPadding})
					.ciphertext.toString(CryptoJS.enc.Latin1);
		};

		function decryptAESCTR(ciphertext, key, counter) {
				return CryptoJS.AES.decrypt(btoa(getString(ciphertext)),
						CryptoJS.enc.Latin1.parse(getString(key)),
						{mode: CryptoJS.mode.CTR, iv: CryptoJS.enc.Latin1.parse(""),
							padding: CryptoJS.pad.NoPadding})
					.toString(CryptoJS.enc.Latin1);
		};

		function decryptAESCBC(ciphertext, key, iv) {
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
			return new Promise(function(resolve) {
				resolve(implementation.apply(this, args));
			});
		}

		// public interface functions
		function encrypt(algorithm, key, data) {
			if (algorithm.name === "AES-CTR") {
					return promise(encryptAESCTR, data, key, algorithm.counter);
			}
		};
		function decrypt(algorithm, key, data) {
			if (algorithm.name === "AES-CTR") {
					return promise(decryptAESCTR, data, key, algorithm.counter);
			}
			if (algorithm.name === "AES-CBC") {
					return promise(decryptAESCBC, data, key, algorithm.iv);
			}
		};
		function sign(algorithm, key, data) {
			if (algorithm.name === "HMAC" && algorithm.hash === "SHA-256") {
				return promise(HmacSHA256, data, key);
			}
		};
		function verify(algorithm, key, signature, data) {
		};
		function digest(algorithm, data) {
		};
		function generateKey(algorithm, extractable, keyUsages) {
		};
		function deriveKey(algorithm, baseKey, derivedKeyType) {
		};
		function deriveBits(algorithm, baseKey, length) {
		};
		function importKey(format, keyData, algorithm, extractable, keyUsages) {
		};
		function exportKey(format, key) {
		};
		function wrapKey(format, key, wrappingKey, wrapAlgorithm) {
		};
		function unwrapKey(format, wrappedKey, unwrappingKey, unwrapAlgorithm,
				unwrappedKeyAlgorithm, extractable, keyUsages) {
		};

		return {
			encrypt     : encrypt,
			decrypt     : decrypt,
			sign        : sign,
			verify      : verify,
			digest      : digest,
			generateKey : generateKey,
			deriveKey   : deriveKey,
			deriveBits  : deriveBits,
			importKey   : importKey,
			exportKey   : exportKey,
			wrapKey     : wrapKey,
			unwrapKey   : unwrapKey
		}
	}
})();
