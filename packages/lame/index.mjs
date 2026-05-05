// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import initWrapper from './wrapper.mjs';

const {
  HEAPU8,
  _wrapper_init,
  _wrapper_get_max_input_size,
  _wrapper_get_in,
  _wrapper_get_out,
  _wrapper_encode,
  _wrapper_get_lametag_frame,
  _wrapper_flush,
  _wrapper_close,
} = initWrapper();

const input = new Float32Array(
  HEAPU8.buffer,
  HEAPU8.byteOffset + _wrapper_get_in(),
  _wrapper_get_max_input_size(),
);

const output = HEAPU8.subarray(_wrapper_get_out());

export class Encoder {
  #gf;

  constructor({ q, sampleRate, bitRate }) {
    this.#gf = _wrapper_init(q, sampleRate, bitRate);
  }

  encode(data) {
    if (data.length > input.length) {
      throw new Error(`Invalid sample count, expected: ${input.length}`);
    }

    input.set(data);
    const size = _wrapper_encode(this.#gf, data.length);
    if (size < 0) {
      throw new Error(`Failed to encode: ${size}`);
    }
    return output.subarray(0, size);
  }

  flush() {
    const size = _wrapper_flush(this.#gf);
    if (size < 0) {
      throw new Error(`Failed to flush: ${size}`);
    }
    return output.subarray(0, size);
  }

  getLametagFrame() {
    const size = _wrapper_get_lametag_frame(this.#gf);
    if (size < 0) {
      throw new Error(`Failed to get lametag: ${size}`);
    }
    _wrapper_close(this.#gf);
    this.#gf = null;
    return output.subarray(0, size);
  }
}
