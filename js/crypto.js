function HmacSHA256(key, input) {
	input = assertIsArrayBuffer(input);
	key = assertIsArrayBuffer(key);
	return window.crypto.subtle.sign({name: "HMAC", hash: "SHA-256"}, key, input);
}

function encryptAESCTR(input, key, counter) {
	input = assertIsArrayBuffer(input);
	key = assertIsArrayBuffer(key);
	counter = assertIsArrayBuffer(counter);
	return window.crypto.subtle.encrypt({name: "AES-CTR", counter: counter}, key, input);
}

function decryptAESCTR(input, key, counter) {
	input = assertIsArrayBuffer(input);
	key = assertIsArrayBuffer(key);
	counter = assertIsArrayBuffer(counter);
	return window.crypto.subtle.decrypt({name: "AES-CTR", counter: counter}, key, input);
}

function decryptAESCBC(input, key, iv) {
	input = assertIsArrayBuffer(input);
	key = assertIsArrayBuffer(key);
	iv = assertIsArrayBuffer(iv);
	return window.crypto.subtle.decrypt({name: "AES-CBC", iv: iv}, key, input);
}
