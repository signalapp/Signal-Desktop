/* global dcodeIO */
/* eslint-disable strict */

const functions = {
  arrayBufferToStringBase64,
  fromBase64ToArrayBuffer,
  verifySignature,
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

function fromBase64ToArrayBuffer(value) {
  return dcodeIO.ByteBuffer.wrap(value, 'base64').toArrayBuffer();
}

async function verifySignature(senderPubKey, messageBase64, signatureBase64) {
  try {
    const messageData = new Uint8Array(fromBase64ToArrayBuffer(messageBase64));
    const signature = new Uint8Array(fromBase64ToArrayBuffer(signatureBase64));

    // verify returns true if the signature is not correct
    const verifyRet = Internal.curve25519.verify(senderPubKey, messageData, signature);
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
