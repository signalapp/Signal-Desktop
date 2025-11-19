// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

declare module 'better-blockmap' {
  import { Writable } from 'node:stream';

  type BlockMapOptions = {
    detectZipBoundary?: boolean;
  };

  export class BlockMap extends Writable {
    constructor(options?: BlockMapOptions);
    compress(compression?: 'gzip' | 'deflate'): Buffer;
  }
}
