import ByteBuffer from 'bytebuffer';
import { generateKeyPair, sharedKey, verify } from 'curve25519-js';
// eslint-disable-next-line import/no-named-default
import { default as sodiumWrappers } from 'libsodium-wrappers-sumo';
import _ from 'lodash';
import {
  decryptAttachmentBufferNode as realDecryptAttachmentBufferNode,
  encryptAttachmentBufferNode as realEncryptAttachmentBufferNode,
} from '../../../../node/encrypt_attachment_buffer';

/* eslint-disable no-console */
/* eslint-disable strict */

async function getSodiumWorker() {
  await sodiumWrappers.ready;

  return sodiumWrappers;
}

const functions = {
  arrayBufferToStringBase64,
  fromBase64ToArrayBuffer,
  fromHexToArrayBuffer,
  verifyAllSignatures,
  DecryptAESGCM,
  deriveSymmetricKey,
  encryptForPubkey,
  decryptAttachmentBufferNode,
  encryptAttachmentBufferNode,
  bytesFromString,
};

onmessage = async (e: any) => {
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

async function encryptAttachmentBufferNode(encryptingKey: Uint8Array, bufferIn: ArrayBuffer) {
  return realEncryptAttachmentBufferNode(encryptingKey, bufferIn, getSodiumWorker);
}

async function decryptAttachmentBufferNode(encryptingKey: Uint8Array, bufferIn: ArrayBuffer) {
  return realDecryptAttachmentBufferNode(encryptingKey, bufferIn, getSodiumWorker);
}

function fromBase64ToArrayBuffer(base64Str: string) {
  return ByteBuffer.wrap(base64Str, 'base64').toArrayBuffer();
}

function fromBase64ToUint8Array(base64Str: string) {
  return new Uint8Array(ByteBuffer.wrap(base64Str, 'base64').toArrayBuffer());
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
async function verifyAllSignatures(
  uncheckedSignatureMessages: Array<{
    base64EncodedData: string;
    base64EncodedSignature: string;
    sender: string;
  }>
) {
  const checked = [];
  // keep this out of a racing (i.e. no Promise.all) for easier debugging for now
  // eslint-disable-next-line: prefer-for-of
  for (let index = 0; index < uncheckedSignatureMessages.length; index++) {
    const unchecked = uncheckedSignatureMessages[index];
    try {
      // eslint-disable-next-line no-await-in-loop
      const valid = await verifySignature(
        unchecked.sender,
        unchecked.base64EncodedData,
        unchecked.base64EncodedSignature
      );
      if (valid) {
        checked.push(unchecked.base64EncodedData);
        continue;
      }
      // eslint:disable: no-console
      console.info('got an opengroup message with an invalid signature');
    } catch (e) {
      console.error(e);
    }
  }

  return _.compact(checked) || [];
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
    const messageData = fromBase64ToUint8Array(messageBase64);
    const signature = fromBase64ToUint8Array(signatureBase64);
    // blinded15 or blinded25 are the same for the verifySignature logic
    const isBlindedSender = senderPubKey.startsWith('15') || senderPubKey.startsWith('25');

    const pubkeyWithoutPrefix = senderPubKey.slice(2);
    const pubkeyBytes = fromHexToArray(pubkeyWithoutPrefix);

    if (isBlindedSender) {
      const sodium = await getSodiumWorker();
      const blindedVerifySig = sodium.crypto_sign_verify_detached(
        signature,
        messageData,
        pubkeyBytes
      );
      if (!blindedVerifySig) {
        console.info('Invalid signature blinded');
        return false;
      }

      return true;
    }
    // verify returns true if the signature is not correct

    const verifyRet = verify(pubkeyBytes, messageData, signature);

    if (!verifyRet) {
      console.error('Invalid signature not blinded');
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
    const ran = (await getSodiumWorker()).randombytes_buf(32);
    const ephemeral = generateKeyPair(ran);
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
