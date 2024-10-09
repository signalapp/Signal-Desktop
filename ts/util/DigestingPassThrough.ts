// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { Transform } from 'stream';

import { DigestingWritable } from '@signalapp/libsignal-client/dist/incremental_mac';

import type { ChunkSizeChoice } from '@signalapp/libsignal-client/dist/incremental_mac';

type CallbackType = (error?: Error | null) => void;

export class DigestingPassThrough extends Transform {
  private digester: DigestingWritable;

  constructor(key: Buffer, sizeChoice: ChunkSizeChoice) {
    super();
    this.digester = new DigestingWritable(key, sizeChoice);

    // We handle errors coming from write/end
    this.digester.on('error', () => {
      /* noop */
    });
  }

  getFinalDigest(): Buffer {
    return this.digester.getFinalDigest();
  }

  public override _transform(
    data: Buffer,
    enc: BufferEncoding,
    callback: CallbackType
  ): void {
    this.push(data);
    this.digester.write(data, enc, err => {
      if (err) {
        return callback(err);
      }
      callback();
    });
  }

  public override _final(callback: CallbackType): void {
    this.digester.end((err?: Error) => {
      if (err) {
        return callback(err);
      }

      callback();
    });
  }
}
