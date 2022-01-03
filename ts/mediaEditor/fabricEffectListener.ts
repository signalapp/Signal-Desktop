// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { fabric } from 'fabric';

/**
 * A helper for setting Fabric events inside of React `useEffect`s.
 */
export function fabricEffectListener(
  target: fabric.IObservable<unknown>,
  eventNames: ReadonlyArray<string>,
  handler: (event: fabric.IEvent) => unknown
): () => void {
  for (const eventName of eventNames) {
    target.on(eventName, handler);
  }

  return () => {
    for (const eventName of eventNames) {
      target.off(eventName, handler);
    }
  };
}
