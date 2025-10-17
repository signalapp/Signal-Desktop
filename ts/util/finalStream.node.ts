// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { Transform } from 'node:stream';

export function finalStream(finalizer: () => Promise<void> | void): Transform {
  return new Transform({
    transform(data, enc, callback) {
      this.push(Buffer.from(data, enc));
      callback();
    },
    async final(callback) {
      try {
        await finalizer();
      } catch (error) {
        callback(error);
        return;
      }
      callback(null);
    },
  });
}
