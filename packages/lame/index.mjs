// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import initWrapper from './wrapper.mjs';

const {
  HEAPU8,
  _wrapper_init,
  _wrapper_get_num_samples,
  _wrapper_get_in,
  _wrapper_get_out,
  _wrapper_encode,
  _wrapper_get_lametag_frame,
  _wrapper_flush,
} = await initWrapper();

const input = new Float32Array(
  HEAPU8.buffer,
  HEAPU8.byteOffset + _wrapper_get_in(),
  _wrapper_get_num_samples(),
);

const output = HEAPU8.subarray(_wrapper_get_out());

export function init(sampleRate, bitRate) {
  _wrapper_init(sampleRate, bitRate);
}

export function encode(data) {
  if (data.length !== input.length) {
    throw new Error(`Invalid sample count, expected: ${input.length}`);
  }

  input.set(data);
  const size = _wrapper_encode();
  return output.subarray(0, size);
}

export function flush() {
  const size = _wrapper_flush();
  return output.subarray(0, size);
}

export function getLametagFrame() {
  const size = _wrapper_get_lametag_frame();
  return output.subarray(0, size);
}
