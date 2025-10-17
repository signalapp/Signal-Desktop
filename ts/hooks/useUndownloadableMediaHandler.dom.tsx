// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useCallback } from 'react';

export function useUndownloadableMediaHandler(
  showMediaNoLongerAvailableToast: (() => void) | undefined
): (event: React.MouseEvent) => void {
  return useCallback(
    (event: React.MouseEvent) => {
      if (showMediaNoLongerAvailableToast) {
        event.preventDefault();
        event.stopPropagation();
        showMediaNoLongerAvailableToast();
      }
    },
    [showMediaNoLongerAvailableToast]
  );
}
