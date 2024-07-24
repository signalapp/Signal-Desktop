// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useCallback, useRef, useState } from 'react';
import * as log from '../logging/log';

/**
 * A light hook wrapper around `IntersectionObserver`.
 *
 * Example usage:
 *
 *     function MyComponent() {
 *       const [intersectionRef, intersectionEntry] = useIntersectionObserver();
 *       const isVisible = intersectionEntry
 *         ? intersectionEntry.isIntersecting
 *         : true;
 *
 *       return (
 *         <div ref={intersectionRef}>
 *           I am {isVisible ? 'on the screen' : 'invisible'}
 *         </div>
 *       );
 *    }
 */
export function useIntersectionObserver(): [
  (el?: Element | null) => void,
  IntersectionObserverEntry | null,
] {
  const [intersectionObserverEntry, setIntersectionObserverEntry] =
    useState<IntersectionObserverEntry | null>(null);

  const unobserveRef = useRef<(() => unknown) | null>(null);

  const setRef = useCallback((el?: Element | null) => {
    if (unobserveRef.current) {
      unobserveRef.current();
      unobserveRef.current = null;
    }

    if (!el) {
      return;
    }

    const observer = new IntersectionObserver(entries => {
      if (entries.length !== 1) {
        log.error(
          'IntersectionObserverWrapper was observing the wrong number of elements'
        );
        return;
      }
      entries.forEach(entry => {
        setIntersectionObserverEntry(entry);
      });
    });

    unobserveRef.current = observer.unobserve.bind(observer, el);

    observer.observe(el);
  }, []);

  return [setRef, intersectionObserverEntry];
}
