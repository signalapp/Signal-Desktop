// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { type FileHandle, open } from 'node:fs/promises';
import { Buffer } from 'node:buffer';
import { InputStream } from '@signalapp/libsignal-client/dist/io';

export class FileStream extends InputStream {
  private file: FileHandle | undefined;
  private position = 0;
  private buffer = Buffer.alloc(16 * 1024);
  private initPromise: Promise<unknown> | undefined;

  constructor(private readonly filePath: string) {
    super();
  }

  public async close(): Promise<void> {
    await this.initPromise;
    await this.file?.close();
  }

  // Only for comparator tests
  public async size(): Promise<number> {
    const file = await this.lazyOpen();
    const { size } = await file.stat();
    return size;
  }

  async read(amount: number): Promise<Buffer> {
    const file = await this.lazyOpen();
    if (this.buffer.length < amount) {
      this.buffer = Buffer.alloc(amount);
    }
    const { bytesRead } = await file.read(
      this.buffer,
      0,
      amount,
      this.position
    );
    this.position += bytesRead;
    return this.buffer.slice(0, bytesRead);
  }

  async skip(amount: number): Promise<void> {
    this.position += amount;
  }

  private async lazyOpen(): Promise<FileHandle> {
    await this.initPromise;

    if (this.file) {
      return this.file;
    }

    const filePromise = open(this.filePath);
    this.initPromise = filePromise;
    this.file = await filePromise;
    return this.file;
  }
}
