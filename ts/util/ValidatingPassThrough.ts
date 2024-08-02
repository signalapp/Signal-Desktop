// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { noop } from 'lodash';
import { Transform } from 'node:stream';
import {
  ValidatingWritable,
  type ChunkSizeChoice,
} from '@signalapp/libsignal-client/dist/incremental_mac';

export class ValidatingPassThrough extends Transform {
  private validator: ValidatingWritable;
  private buffer = new Array<Buffer>();

  constructor(key: Buffer, sizeChoice: ChunkSizeChoice, digest: Buffer) {
    super();
    this.validator = new ValidatingWritable(key, sizeChoice, digest);

    // We handle errors coming from write/end
    this.validator.on('error', noop);
  }

  public override _transform(
    data: Buffer,
    enc: BufferEncoding,
    callback: (error?: null | Error) => void
  ): void {
    const start = this.validator.validatedSize();
    this.validator.write(data, enc, err => {
      if (err) {
        return callback(err);
      }

      this.buffer.push(data);

      const end = this.validator.validatedSize();
      const readySize = end - start;

      // Fully buffer
      if (readySize === 0) {
        return callback(null);
      }

      const { buffer } = this;
      this.buffer = [];
      let validated = 0;
      for (const chunk of buffer) {
        validated += chunk.byteLength;

        // Buffered chunk is fully validated - push it without slicing
        if (validated <= readySize) {
          this.push(chunk);
          continue;
        }

        // Validation boundary lies within the chunk, split it
        const notValidated = validated - readySize;
        this.push(chunk.subarray(0, -notValidated));
        this.buffer.push(chunk.subarray(-notValidated));

        // Technically this chunk must be the last chunk so we could break,
        // but for consistency keep looping.
      }
      callback(null);
    });
  }

  public override _final(callback: (error?: null | Error) => void): void {
    const start = this.validator.validatedSize();
    this.validator.end((err?: Error) => {
      if (err) {
        return callback(err);
      }

      const end = this.validator.validatedSize();
      const readySize = end - start;
      const buffer = Buffer.concat(this.buffer);
      this.buffer = [];
      if (buffer.byteLength !== readySize) {
        return callback(new Error('Stream not fully processed'));
      }
      this.push(buffer);

      callback(null);
    });
  }
}
