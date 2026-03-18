// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { Transform } from 'node:stream';

import { missingCaseError } from './missingCaseError.std.js';

type State =
  | {
      kind: 'prefix';
      size: number;
      value: number;
    }
  | {
      kind: 'frame';
      remaining: number;
      parts: Array<Buffer>;
    }
  | {
      kind: 'trailer';
      frame: Buffer;
      remaining: number;
      parts: Array<Buffer>;
    };

const EMPTY_TRAILER = Buffer.alloc(0);

export class DelimitedStream extends Transform {
  #state: State = { kind: 'prefix', size: 0, value: 0 };

  constructor() {
    super({ readableObjectMode: true });
  }

  override async _transform(
    chunk: Buffer,
    _encoding: BufferEncoding,
    done: (error?: Error) => void
  ): Promise<void> {
    let offset = 0;
    while (offset < chunk.length) {
      if (this.#state.kind === 'prefix') {
        const b = chunk[offset];
        offset += 1;

        // See: https://protobuf.dev/programming-guides/encoding/
        // eslint-disable-next-line no-bitwise
        const isLast = (b & 0x80) === 0;
        // eslint-disable-next-line no-bitwise
        const value = b & 0x7f;

        // eslint-disable-next-line no-bitwise
        this.#state.value |= value << (7 * this.#state.size);
        this.#state.size += 1;

        // Check that we didn't go over 32bits. Node.js buffers can never
        // be larger than 2gb anyway!
        if (this.#state.size > 4) {
          done(new Error('Delimiter encoding overflow'));
          return;
        }

        if (isLast) {
          this.#state = {
            kind: 'frame',
            remaining: this.#state.value,
            parts: [],
          };
        }
      } else if (
        this.#state.kind === 'frame' ||
        this.#state.kind === 'trailer'
      ) {
        const toTake = Math.min(this.#state.remaining, chunk.length - offset);
        const part = chunk.slice(offset, offset + toTake);
        offset += toTake;
        this.#state.remaining -= toTake;

        this.#state.parts.push(part);

        if (this.#state.remaining > 0) {
          continue;
        }

        if (this.#state.kind === 'frame') {
          const frame = Buffer.concat(this.#state.parts);
          const trailerSize = this.getTrailerSize(frame);

          if (trailerSize === 0) {
            this.#state = {
              kind: 'prefix',
              size: 0,
              value: 0,
            };

            // eslint-disable-next-line no-await-in-loop
            await this.pushFrame(frame, EMPTY_TRAILER);
          } else {
            this.#state = {
              kind: 'trailer',
              frame,
              remaining: trailerSize,
              parts: [],
            };
          }
        } else if (this.#state.kind === 'trailer') {
          const oldState = this.#state;
          const trailer = Buffer.concat(this.#state.parts);

          this.#state = {
            kind: 'prefix',
            size: 0,
            value: 0,
          };

          // eslint-disable-next-line no-await-in-loop
          await this.pushFrame(oldState.frame, trailer);
        } else {
          throw missingCaseError(this.#state);
        }
      } else {
        throw missingCaseError(this.#state);
      }
    }
    done();
  }

  override _flush(done: (error?: Error) => void): void {
    if (this.#state.kind === 'frame') {
      done(new Error('Unfinished frame'));
      return;
    }
    if (this.#state.kind === 'trailer') {
      done(new Error('Unfinished trailer'));
      return;
    }
    if (this.#state.kind !== 'prefix') {
      throw missingCaseError(this.#state);
    }

    if (this.#state.size !== 0) {
      done(new Error('Unfinished prefix'));
      return;
    }

    done();
  }

  protected getTrailerSize(_frame: Buffer): number {
    return 0;
  }

  protected async pushFrame(frame: Buffer, _trailer: Buffer): Promise<void> {
    this.push(frame);
  }
}
