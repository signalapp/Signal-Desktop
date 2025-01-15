// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { Transform } from 'stream';

import { missingCaseError } from './missingCaseError';

enum State {
  Prefix = 'Prefix',
  Data = 'Data',
}

export class DelimitedStream extends Transform {
  #state = State.Prefix;
  #prefixValue = 0;
  #prefixSize = 0;
  #parts = new Array<Buffer>();

  constructor() {
    super({ readableObjectMode: true });
  }

  override _transform(
    chunk: Buffer,
    _encoding: BufferEncoding,
    done: (error?: Error) => void
  ): void {
    let offset = 0;
    while (offset < chunk.length) {
      if (this.#state === State.Prefix) {
        const b = chunk[offset];
        offset += 1;

        // See: https://protobuf.dev/programming-guides/encoding/
        // eslint-disable-next-line no-bitwise
        const isLast = (b & 0x80) === 0;
        // eslint-disable-next-line no-bitwise
        const value = b & 0x7f;

        // eslint-disable-next-line no-bitwise
        this.#prefixValue |= value << (7 * this.#prefixSize);
        this.#prefixSize += 1;

        // Check that we didn't go over 32bits. Node.js buffers can never
        // be larger than 2gb anyway!
        if (this.#prefixSize > 4) {
          done(new Error('Delimiter encoding overflow'));
          return;
        }

        if (isLast) {
          this.#state = State.Data;
        }
      } else if (this.#state === State.Data) {
        const toTake = Math.min(this.#prefixValue, chunk.length - offset);
        const part = chunk.slice(offset, offset + toTake);
        offset += toTake;
        this.#prefixValue -= toTake;

        this.#parts.push(part);

        if (this.#prefixValue <= 0) {
          this.#state = State.Prefix;
          this.#prefixSize = 0;
          this.#prefixValue = 0;

          const whole = Buffer.concat(this.#parts);
          this.#parts = [];
          this.push(whole);
        }
      } else {
        throw missingCaseError(this.#state);
      }
    }
    done();
  }

  override _flush(done: (error?: Error) => void): void {
    if (this.#state !== State.Prefix) {
      done(new Error('Unfinished data'));
      return;
    }

    if (this.#prefixSize !== 0) {
      done(new Error('Unfinished prefix'));
      return;
    }

    done();
  }
}
