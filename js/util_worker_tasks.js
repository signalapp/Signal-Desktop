/* global dcodeIO, pow */
/* eslint-disable strict */

const functions = {
  stringToArrayBufferBase64,
  arrayBufferToStringBase64,
  calcPoW,
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

function stringToArrayBufferBase64(string) {
  return dcodeIO.ByteBuffer.wrap(string, 'base64').toArrayBuffer();
}
function arrayBufferToStringBase64(arrayBuffer) {
  return dcodeIO.ByteBuffer.wrap(arrayBuffer).toString('base64');
}
function calcPoW(
  timestamp,
  ttl,
  pubKey,
  data,
  difficulty = undefined,
  increment = 1,
  startNonce = 0
) {
  return pow.calcPoW(
    timestamp,
    ttl,
    pubKey,
    data,
    difficulty,
    increment,
    startNonce
  );
}
