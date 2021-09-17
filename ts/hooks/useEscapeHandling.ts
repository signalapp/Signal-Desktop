// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect } from 'react';

export function useEscapeHandling(handleEscape?: () => unknown): void {
  useEffect(() => {
    if (!handleEscape) {
      return;
    }

    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleEscape();

        event.preventDefault();
        event.stopPropagation();
      }
    };
    document.addEventListener('keydown', handler);

    return () => {
      document.removeEventListener('keydown', handler);
    };
  }, [handleEscape]);
}
