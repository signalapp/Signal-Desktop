// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useCallback, useEffect, useRef } from 'react';

/**
 * If you get a warning like:
 *
 * Warning: Can't perform a React state update on an unmounted component.
 *
 * your component is probably trying to set state after it has unmounted, e.g. after a
 * timeout or async call. If you can, clear the timeout when the component unmounts (e.g.
 * on useEffect cleanup). Otherwise, use this hook to check if the component is mounted
 * before updating state.
 */

export function useIsMounted(): () => boolean {
  const isMounted = useRef(false);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  return useCallback(() => isMounted.current === true, []);
}
