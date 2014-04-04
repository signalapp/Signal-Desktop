window.crypto.subtle = (function() {
	if (window.crypto.subtle !== undefined && window.crypto.subtle !== null) {
			return window.crypto.subtle;
	} else {
		function encrypt(algorithm, key, data) {
		};
		function decrypt(algorithm, key, data) {
		};
		function sign(algorithm, key, data) {
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
		function unwrapKey(format, wrappedKey, unwrappingKey, unwrapAlgorithm, unwrappedKeyAlgorithm, extractable, keyUsages) {
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
