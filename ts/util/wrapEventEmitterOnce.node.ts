// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { EventEmitter } from 'node:events';
import { once } from 'node:events';

export async function wrapEventEmitterOnce(
  emitter: EventEmitter,
  eventName: string
): Promise<ReturnType<typeof once>> {
  const abortController = new AbortController();
  const maybeRejection = (async (): Promise<ReturnType<typeof once>> => {
    const [error] = await once(emitter, 'error', {
      signal: abortController.signal,
    });

    throw error;
  })();

  try {
    return await Promise.race([maybeRejection, once(emitter, eventName)]);
  } finally {
    abortController.abort();
  }
}
