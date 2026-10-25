// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { Buffer } from 'node:buffer';
import type { Readable } from 'node:stream';
import { InputStream } from '@signalapp/libsignal-client/dist/io.js';

const SKIP_CHUNK_SIZE = 64 * 1024;

export class NodeInputStream extends InputStream {
  readonly #stream: Readable;
  #buffer = new Uint8Array(0);
  #error: Error | undefined;

  constructor(stream: Readable) {
    super();
    this.#stream = stream;
    this.#stream.once('error', error => {
      this.#error = error;
    });
  }

  public override async read(amount: number): Promise<Uint8Array<ArrayBuffer>> {
    // oxlint-disable-next-line no-constant-condition
    while (true) {
      if (this.#error != null) {
        throw this.#error;
      }

      const remaining = amount - this.#buffer.length;
      if (remaining <= 0) {
        const result = this.#buffer.subarray(0, amount);
        this.#buffer = this.#buffer.subarray(amount);
        return result;
      }

      if (this.#stream.readableEnded) {
        return this.#buffer;
      }

      const chunk = this.#stream.read();
      if (chunk == null) {
        // oxlint-disable-next-line no-await-in-loop
        await new Promise<void>((resolve, reject) => {
          const onReadable = () => {
            cleanup();
            resolve();
          };
          const onEnd = () => {
            cleanup();
            resolve();
          };
          const onError = (error: unknown) => {
            cleanup();
            reject(error);
          };
          const cleanup = () => {
            this.#stream.removeListener('readable', onReadable);
            this.#stream.removeListener('end', onEnd);
            this.#stream.removeListener('error', onError);
          };

          this.#stream.once('readable', onReadable);
          this.#stream.once('end', onEnd);
          this.#stream.once('error', onError);
        });
      } else {
        this.#buffer = Buffer.concat([this.#buffer, chunk]);
      }
    }
  }

  public override async skip(amount: number): Promise<void> {
    if (this.#error != null) {
      throw this.#error;
    }

    for (let read = 0; read < amount; read += SKIP_CHUNK_SIZE) {
      // Read, but discard the result
      // oxlint-disable-next-line no-await-in-loop
      await this.read(Math.min(SKIP_CHUNK_SIZE, amount - read));
    }
  }

  public override async close(): Promise<void> {
    await super.close();

    this.#stream.destroy();
    if (this.#error != null) {
      throw this.#error;
    }
  }
}
