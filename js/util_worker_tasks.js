/* global dcodeIO, libsignal */
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

async function verifySignature(senderPubKey, messageData, signature) {
  try {
    const result = sodium.crypto_sign_verify_detached(signature, messageData, senderPubKey);
    console.warn('sodium result', result);
    return result;
    // libsignal.Curve.async.verifySignature(senderPubKey, messageData, signature);
  } catch (e) {
    console.warn('verifySignature:', e);
    return false;
  }
}
