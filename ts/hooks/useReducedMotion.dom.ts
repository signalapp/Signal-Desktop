// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useMemo, useSyncExternalStore } from 'react';

export function useMediaQuery(query: string): boolean {
  const api = useMemo(() => {
    const mediaQuery = window.matchMedia(query);

    function subscribe(onChange: () => void) {
      mediaQuery.addEventListener('change', onChange);
      return () => {
        mediaQuery.removeEventListener('change', onChange);
      };
    }

    function getSnapshot() {
      return mediaQuery.matches;
    }

    return { subscribe, getSnapshot };
  }, [query]);
  return useSyncExternalStore(api.subscribe, api.getSnapshot);
}

export function useReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion)');
}
