// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect } from 'react';

const eventsHandledByHook = new WeakSet<KeyboardEvent>();

/** Calls `handleEscape` on Escape, unless a Radix layer already handled it */
export function useEscapeHandling(handleEscape?: () => unknown): void {
  useEffect(() => {
    if (!handleEscape) {
      return;
    }

    const handler = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }
      if (event.defaultPrevented && !eventsHandledByHook.has(event)) {
        return;
      }

      handleEscape();

      eventsHandledByHook.add(event);
      event.preventDefault();
      event.stopPropagation();
    };
    document.addEventListener('keydown', handler);

    return () => {
      document.removeEventListener('keydown', handler);
    };
  }, [handleEscape]);
}
