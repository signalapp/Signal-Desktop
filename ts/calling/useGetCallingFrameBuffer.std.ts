// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useRef, useCallback } from 'react';
import { FRAME_BUFFER_SIZE } from './constants.std.js';

/**
 * A hook that returns a function. This function returns a "singleton" `ArrayBuffer` to be
 * used in call video rendering.
 *
 * This is most useful for group calls, where we can reuse the same frame buffer instead
 * of allocating one per participant. Be careful when using this buffer elsewhere, as it
 * is not cleaned up and may hold stale data.
 */
export function useGetCallingFrameBuffer(): () => Uint8Array {
  const ref = useRef<Uint8Array | null>(null);

  return useCallback(() => {
    if (!ref.current) {
      ref.current = new Uint8Array(FRAME_BUFFER_SIZE);
    }
    return ref.current;
  }, []);
}
