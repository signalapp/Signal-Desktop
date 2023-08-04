// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useState } from 'react';

// Allows this to work in Node process
let reducedMotionQuery: MediaQueryList;
function getReducedMotionQuery() {
  if (reducedMotionQuery == null) {
    reducedMotionQuery = window.matchMedia('(prefers-reduced-motion)');
  }
  return reducedMotionQuery;
}

export function useReducedMotion(): boolean {
  const [matches, setMatches] = useState(getReducedMotionQuery().matches);
  useEffect(() => {
    function onChange(event: MediaQueryListEvent) {
      setMatches(event.matches);
    }
    getReducedMotionQuery().addEventListener('change', onChange);
    return () => {
      getReducedMotionQuery().removeEventListener('change', onChange);
    };
  }, []);
  return matches;
}
