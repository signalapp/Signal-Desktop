// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useCallback, type MouseEvent } from 'react';

export function useUndownloadableMediaHandler(
  showMediaNoLongerAvailableToast: (() => void) | undefined
): (event: MouseEvent) => void {
  return useCallback(
    (event: MouseEvent) => {
      if (showMediaNoLongerAvailableToast) {
        event.preventDefault();
        event.stopPropagation();
        showMediaNoLongerAvailableToast();
      }
    },
    [showMediaNoLongerAvailableToast]
  );
}
