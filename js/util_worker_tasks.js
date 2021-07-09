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
    console.warn('sodium', sodium);
    console.warn('senderPubKey', senderPubKey);
    console.warn('messageData', messageData);
    console.warn('signature', signature);

    let res = sodium.cr(key);
    let [state_out, header] = [res.state, res.header];
    let c1 = sodium.crypto_secretstream_xchacha20poly1305_push(
      state_out,
      sodium.from_string('message 1'),
      null,
      sodium.crypto_secretstream_xchacha20poly1305_TAG_MESSAGE
    );
    let c2 = sodium.crypto_secretstream_xchacha20poly1305_push(
      state_out,
      sodium.from_string('message 2'),
      null,
      sodium.crypto_secretstream_xchacha20poly1305_TAG_FINAL
    );

    const result = sodium.crypto_sign_verify_detached(signature, messageData, senderPubKey);
    console.warn('sodium result', result);

    // libsignal.Curve.async.verifySignature(senderPubKey, messageData, signature);
  } catch (e) {
    console.warn('verifySignature:', e);
    return false;
  }
}
