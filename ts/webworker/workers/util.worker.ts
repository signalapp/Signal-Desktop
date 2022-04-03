import ByteBuffer from 'bytebuffer';
import { generateKeyPair, sharedKey, verify } from 'curve25519-js';
import { default as sodiumWrappers } from 'libsodium-wrappers-sumo';

async function getSodium() {
  await sodiumWrappers.ready;
  return sodiumWrappers;
}

export async function decryptAttachmentBuffer(encryptingKey: Uint8Array, bufferIn: ArrayBuffer) {
  const sodium = await getSodium();

  const header = new Uint8Array(
    bufferIn.slice(0, sodium.crypto_secretstream_xchacha20poly1305_HEADERBYTES)
  );

  const encryptedBuffer = new Uint8Array(
    bufferIn.slice(sodium.crypto_secretstream_xchacha20poly1305_HEADERBYTES)
  );
  try {
    /* Decrypt the stream: initializes the state, using the key and a header */
    const state = sodium.crypto_secretstream_xchacha20poly1305_init_pull(header, encryptingKey);
    // what if ^ this call fail (? try to load as a unencrypted attachment?)

    const messageTag = sodium.crypto_secretstream_xchacha20poly1305_pull(state, encryptedBuffer);
    // we expect the final tag to be there. If not, we might have an issue with this file
    // maybe not encrypted locally?
    if (messageTag.tag === sodium.crypto_secretstream_xchacha20poly1305_TAG_FINAL) {
      return messageTag.message;
    }
  } catch (e) {
    // tslint:disable: no-console
    console.error('Failed to load the file as an encrypted one', e);
  }
  return new Uint8Array();
}

export async function encryptAttachmentBuffer(encryptingKey: Uint8Array, bufferIn: ArrayBuffer) {
  const sodium = await getSodium();

  try {
    const uintArrayIn = new Uint8Array(bufferIn);

    /* Set up a new stream: initialize the state and create the header */
    const { state, header } = sodium.crypto_secretstream_xchacha20poly1305_init_push(encryptingKey);
    /* Now, encrypt the buffer. */
    const bufferOut = sodium.crypto_secretstream_xchacha20poly1305_push(
      state,
      uintArrayIn,
      null,
      sodium.crypto_secretstream_xchacha20poly1305_TAG_FINAL
    );

    const encryptedBufferWithHeader = new Uint8Array(bufferOut.length + header.length);
    encryptedBufferWithHeader.set(header);
    encryptedBufferWithHeader.set(bufferOut, header.length);

    return { encryptedBufferWithHeader, header };
  } catch (e) {
    console.error('encryptAttachmentBuffer error: ', e);

    return null;
  }
}

/* global dcodeIO, Internal, libsignal */
/* eslint-disable no-console */
/* eslint-disable strict */

const functions = {
  arrayBufferToStringBase64,
  fromBase64ToArrayBuffer,
  fromHexToArrayBuffer,
  verifySignature,
  DecryptAESGCM,
  deriveSymmetricKey,
  encryptForPubkey,
  decryptAttachmentBuffer,
  encryptAttachmentBuffer,
  bytesFromString,
};
// tslint:disable: function-name

onmessage = async e => {
  const [jobId, fnName, ...args] = e.data;

  try {
    const fn = (functions as any)[fnName];
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

function prepareErrorForPostMessage(error: any) {
  if (!error) {
    return null;
  }

  if (error.stack) {
    return error.stack;
  }

  return error.message;
}

function arrayBufferToStringBase64(arrayBuffer: ArrayBuffer) {
  return ByteBuffer.wrap(arrayBuffer).toString('base64');
}

function fromBase64ToArrayBuffer(base64Str: string) {
  return ByteBuffer.wrap(base64Str, 'base64').toArrayBuffer();
}

function fromHexToArray(hexStr: string) {
  return new Uint8Array(ByteBuffer.wrap(hexStr, 'hex').toArrayBuffer());
}

function fromHexToArrayBuffer(hexStr: string) {
  return ByteBuffer.wrap(hexStr, 'hex').toArrayBuffer();
}

function bytesFromString(str: string) {
  return ByteBuffer.wrap(str, 'utf8').toArrayBuffer();
}

// hexString, base64String, base64String
async function verifySignature(
  senderPubKey: string,
  messageBase64: string,
  signatureBase64: string
) {
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

    const verifyRet = verify(fromHexToArray(senderPubKey), messageData, signature);

    if (!verifyRet) {
      console.error('Invalid signature');
      return false;
    }

    return true;
  } catch (e) {
    console.error('verifySignature got an error:', e);
    return false;
  }
}

const NONCE_LENGTH = 12;

async function deriveSymmetricKey(x25519PublicKey: Uint8Array, x25519PrivateKey: Uint8Array) {
  assertArrayBufferView(x25519PublicKey);
  assertArrayBufferView(x25519PrivateKey);
  const ephemeralSecret = sharedKey(x25519PrivateKey, x25519PublicKey);

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
  const ran = (await getSodium()).randombytes_buf(32);
  const keys = generateKeyPair(ran);
  return keys;
  // Signal protocol prepends with "0x05"
  // keys.pubKey = keys.pubKey.slice(1);
  // return { pubKey: keys.public, privKey: keys.private };
}

function assertArrayBufferView(val: any) {
  if (!ArrayBuffer.isView(val)) {
    throw new Error('val type not correct');
  }
}

// encryptForPubkey: hexString, payloadBytes: Uint8Array
async function encryptForPubkey(pubkeyX25519str: string, payloadBytes: Uint8Array) {
  try {
    if (typeof pubkeyX25519str !== 'string') {
      throw new Error('pubkeyX25519str type not correct');
    }
    assertArrayBufferView(payloadBytes);
    const ephemeral = await generateEphemeralKeyPair();
    const pubkeyX25519Buffer = fromHexToArray(pubkeyX25519str);
    const symmetricKey = await deriveSymmetricKey(
      pubkeyX25519Buffer,
      new Uint8Array(ephemeral.private)
    );
    const ciphertext = await EncryptAESGCM(symmetricKey, payloadBytes);

    return { ciphertext, symmetricKey, ephemeralKey: ephemeral.public };
  } catch (e) {
    console.error('encryptForPubkey got an error:', e);
    return null;
  }
}

async function EncryptAESGCM(symmetricKey: ArrayBuffer, plaintext: ArrayBuffer) {
  const nonce = crypto.getRandomValues(new Uint8Array(NONCE_LENGTH));

  const key = await crypto.subtle.importKey('raw', symmetricKey, { name: 'AES-GCM' }, false, [
    'encrypt',
  ]);

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce, tagLength: 128 },
    key,
    plaintext
  );

  // tslint:disable-next-line: restrict-plus-operands
  const ivAndCiphertext = new Uint8Array(NONCE_LENGTH + ciphertext.byteLength);

  ivAndCiphertext.set(nonce);
  ivAndCiphertext.set(new Uint8Array(ciphertext), nonce.byteLength);

  return ivAndCiphertext;
}

// uint8array, uint8array
async function DecryptAESGCM(symmetricKey: Uint8Array, ivAndCiphertext: Uint8Array) {
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
