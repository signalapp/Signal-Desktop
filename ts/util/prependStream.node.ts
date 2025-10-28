// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { Transform } from 'node:stream';
import type { Duplex } from 'node:stream';

export function prependStream(data: Uint8Array): Duplex {
  return new Transform({
    construct(callback) {
      this.push(data);
      callback();
    },
    transform(chunk, _encoding, callback) {
      callback(null, chunk);
    },
  });
}
