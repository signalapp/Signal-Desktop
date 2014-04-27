function HmacSHA256(key, input) {
	return window.crypto.subtle.sign({name: "HMAC", hash: "SHA-256"}, key, input);
}

function encryptAESCTR(input, key, counter) {
	return window.crypto.subtle.encrypt({name: "AES-CTR", counter: counter}, key, input);
}

function decryptAESCTR(input, key, counter) {
	return window.crypto.subtle.decrypt({name: "AES-CTR", counter: counter}, key, input);
}

function decryptAESCBC(input, key, iv) {
	return window.crypto.subtle.decrypt({name: "AES-CBC", iv: iv}, key, input);
}
