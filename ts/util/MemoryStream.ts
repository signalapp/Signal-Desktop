// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { InputStream } from '@signalapp/libsignal-client/dist/io.js';

export class MemoryStream extends InputStream {
  #offset = 0;

  constructor(private readonly buffer: Uint8Array) {
    super();
  }

  public override async read(amount: number): Promise<Uint8Array> {
    const result = this.buffer.subarray(this.#offset, this.#offset + amount);
    this.#offset += amount;
    return result;
  }

  public override async skip(amount: number): Promise<void> {
    this.#offset += amount;
  }
}
