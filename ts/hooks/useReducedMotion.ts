// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useState } from 'react';

function getReducedMotionQuery(): MediaQueryList {
  return window.matchMedia('(prefers-reduced-motion: reduce)');
}

// Inspired by <https://github.com/infiniteluke/react-reduce-motion>.
export function useReducedMotion(): boolean {
  const initialQuery = getReducedMotionQuery();
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(
    initialQuery.matches
  );

  useEffect(() => {
    const query = getReducedMotionQuery();

    function changePreference() {
      setPrefersReducedMotion(query.matches);
    }

    changePreference();

    query.addEventListener('change', changePreference);

    return () => {
      query.removeEventListener('change', changePreference);
    };
  });

  return prefersReducedMotion;
}
