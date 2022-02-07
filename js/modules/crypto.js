/* eslint-env browser */
/* global dcodeIO */

/* eslint-disable camelcase, no-bitwise */

module.exports = {
  bytesFromString,
  getRandomBytes,
};

// Utility

function bytesFromString(string) {
  return dcodeIO.ByteBuffer.wrap(string, 'utf8').toArrayBuffer();
}

function getRandomBytes(n) {
  const bytes = new Uint8Array(n);
  window.crypto.getRandomValues(bytes);
  return bytes;
}
