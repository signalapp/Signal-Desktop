// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { type Readable, finished } from 'node:stream';
import { once } from 'node:events';

// Note: can be removed once https://github.com/nodejs/node/issues/54205 is
// resolved and ported to Electron.
export function toWebStream(readable: Readable): ReadableStream<Buffer> {
  let controller: ReadableStreamDefaultController<Buffer>;

  const cleanup = finished(readable, err => {
    cleanup();

    if (err != null) {
      return controller.error(err);
    }

    controller.close();
  });

  return new ReadableStream({
    start(newController) {
      controller = newController;
    },
    async pull() {
      try {
        await once(readable, 'readable');
        const chunk = readable.read();
        if (chunk != null) {
          controller.enqueue(chunk);
        }
      } catch (error) {
        cleanup();
        controller.error(error);
      }
    },
    cancel(reason) {
      // If we got canceled - don't call controller.close/.error since it will
      // throw.
      cleanup();

      readable.destroy(reason ? new Error(reason) : undefined);
    },
  });
}
