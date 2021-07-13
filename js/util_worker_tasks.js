/* global dcodeIO, Internal */
/* eslint-disable no-console */
/* eslint-disable strict */

const functions = {
  arrayBufferToStringBase64,
  fromBase64ToArrayBuffer,
  verifySignature,
  DecryptAESGCM,
  deriveSymmetricKey,
  encryptForPubkey,
  generateEphemeralKeyPair,
};

onmessage = async e => {
  const [jobId, fnName, ...args] = e.data;

  try {
    const fn = functions[fnName];
    if (!fn) {
      throw new Error(`Worker: job ${jobId} did not find function ${fnName}`);
    }
    const result = await fn(...args);
    postMessage([jobId, null, result]);
  } catch (error) {
    const errorForDisplay = prepareErrorForPostMessage(error);
    postMessage([jobId, errorForDisplay]);
  }
};

function prepareErrorForPostMessage(error) {
  if (!error) {
    return null;
  }

  if (error.stack) {
    return error.stack;
  }

  return error.message;
}

function arrayBufferToStringBase64(arrayBuffer) {
  return dcodeIO.ByteBuffer.wrap(arrayBuffer).toString('base64');
}

function fromBase64ToArrayBuffer(base64Str) {
  return dcodeIO.ByteBuffer.wrap(base64Str, 'base64').toArrayBuffer();
}

function fromHexToArray(hexStr) {
  return new Uint8Array(dcodeIO.ByteBuffer.wrap(hexStr, 'hex').toArrayBuffer());
}

function fromHexToArrayBuffer(hexStr) {
  return dcodeIO.ByteBuffer.wrap(hexStr, 'hex').toArrayBuffer();
}

function bytesFromString(string) {
  return dcodeIO.ByteBuffer.wrap(string, 'utf8').toArrayBuffer();
}

// hexString, base64String, base64String
async function verifySignature(senderPubKey, messageBase64, signatureBase64) {
  try {
    if (typeof senderPubKey !== 'string') {
      throw new Error('senderPubKey type not correct');
    }
    if (typeof messageBase64 !== 'string') {
      throw new Error('messageBase64 type not correct');
    }
    if (typeof signatureBase64 !== 'string') {
      throw new Error('signatureBase64 type not correct');
    }
    const messageData = new Uint8Array(fromBase64ToArrayBuffer(messageBase64));
    const signature = new Uint8Array(fromBase64ToArrayBuffer(signatureBase64));

    // verify returns true if the signature is not correct
    const verifyRet = Internal.curve25519.verify(
      fromHexToArray(senderPubKey),
      messageData,
      signature
    );
    if (verifyRet) {
      console.warn('Invalid signature');
      return false;
    }

    return true;
  } catch (e) {
    console.warn('verifySignature got an error:', e);
    return false;
  }
}

const NONCE_LENGTH = 12;

// uint8array, uint8array
async function deriveSymmetricKey(x25519PublicKey, x25519PrivateKey) {
  assertArrayBufferView(x25519PublicKey);
  assertArrayBufferView(x25519PrivateKey);
  const ephemeralSecret = await libsignal.Curve.async.calculateAgreement(
    x25519PublicKey.buffer,
    x25519PrivateKey.buffer
  );

  const salt = bytesFromString('LOKI');

  const key = await crypto.subtle.importKey(
    'raw',
    salt,
    { name: 'HMAC', hash: { name: 'SHA-256' } },
    false,
    ['sign']
  );
  const symmetricKey = await crypto.subtle.sign(
    { name: 'HMAC', hash: 'SHA-256' },
    key,
    ephemeralSecret
  );

  return symmetricKey;
}

async function generateEphemeralKeyPair() {
  const keys = await libsignal.Curve.async.generateKeyPair();
  // Signal protocol prepends with "0x05"
  keys.pubKey = keys.pubKey.slice(1);
  return keys;
}

function assertArrayBufferView(val) {
  if (!ArrayBuffer.isView(val)) {
    throw new Error('val type not correct');
  }
}

// encryptForPubkey: hexString, payloadBytes: Uint8Array
async function encryptForPubkey(pubkeyX25519str, payloadBytes) {
  try {
    if (typeof pubkeyX25519str !== 'string') {
      throw new Error('pubkeyX25519str type not correct');
    }
    assertArrayBufferView(payloadBytes);
    const ephemeral = await generateEphemeralKeyPair();
    const pubkeyX25519Buffer = fromHexToArray(pubkeyX25519str);
    const symmetricKey = await deriveSymmetricKey(
      pubkeyX25519Buffer,
      new Uint8Array(ephemeral.privKey)
    );
    const ciphertext = await EncryptAESGCM(symmetricKey, payloadBytes);

    return { ciphertext, symmetricKey, ephemeralKey: ephemeral.pubKey };
  } catch (e) {
    console.warn('encryptForPubkey got an error:', e);
    return null;
  }
}

async function EncryptAESGCM(symmetricKey, plaintext) {
  const nonce = crypto.getRandomValues(new Uint8Array(NONCE_LENGTH));

  const key = await crypto.subtle.importKey('raw', symmetricKey, { name: 'AES-GCM' }, false, [
    'encrypt',
  ]);

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce, tagLength: 128 },
    key,
    plaintext
  );

  const ivAndCiphertext = new Uint8Array(NONCE_LENGTH + ciphertext.byteLength);

  ivAndCiphertext.set(nonce);
  ivAndCiphertext.set(new Uint8Array(ciphertext), nonce.byteLength);

  return ivAndCiphertext;
}

// uint8array, uint8array
async function DecryptAESGCM(symmetricKey, ivAndCiphertext) {
  assertArrayBufferView(symmetricKey);

  assertArrayBufferView(ivAndCiphertext);

  const nonce = ivAndCiphertext.buffer.slice(0, NONCE_LENGTH);
  const ciphertext = ivAndCiphertext.buffer.slice(NONCE_LENGTH);
  const key = await crypto.subtle.importKey(
    'raw',
    symmetricKey.buffer,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );

  return crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, key, ciphertext);
}
