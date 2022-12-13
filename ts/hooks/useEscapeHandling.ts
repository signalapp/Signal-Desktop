// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect } from 'react';

export function useEscapeHandling(
  handleEscape?: () => unknown,
  useCapture?: boolean
): void {
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
    document.addEventListener('keydown', handler, useCapture);

    return () => {
      document.removeEventListener('keydown', handler, useCapture);
    };
  }, [handleEscape, useCapture]);
}
