// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useState } from 'react';

export function useIsWindowActive(): boolean {
  const { activeWindowService } = window.SignalContext;
  const [isActive, setIsActive] = useState(activeWindowService.isActive());

  useEffect(() => {
    const update = (newIsActive: boolean): void => {
      setIsActive(newIsActive);
    };

    activeWindowService.registerForChange(update);

    return () => {
      activeWindowService.unregisterForChange(update);
    };
  }, [activeWindowService]);

  return isActive;
}
