// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { InputStream } from '@signalapp/libsignal-client/dist/io.js';

export class MemoryStream extends InputStream {
  readonly #buffer: Uint8Array<ArrayBuffer>;
  #offset = 0;

  constructor(buffer: Uint8Array<ArrayBuffer>) {
    super();
    this.#buffer = buffer;
  }

  public override async read(amount: number): Promise<Uint8Array<ArrayBuffer>> {
    const result = this.#buffer.subarray(this.#offset, this.#offset + amount);
    this.#offset += amount;
    return result;
  }

  public override async skip(amount: number): Promise<void> {
    this.#offset += amount;
  }
}
