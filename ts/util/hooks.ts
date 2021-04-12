// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { ActionCreatorsMapObject, bindActionCreators } from 'redux';
import { useDispatch } from 'react-redux';

export function usePrevious<T>(initialValue: T, currentValue: T): T {
  const previousValueRef = React.useRef<T>(initialValue);
  const result = previousValueRef.current;
  previousValueRef.current = currentValue;
  return result;
}

// Restore focus on teardown
export const useRestoreFocus = (
  // The ref for the element to receive initial focus
  focusRef: React.RefObject<HTMLElement>,
  // Allow for an optional root element that must exist
  root: boolean | HTMLElement | null = true
): void => {
  React.useEffect(() => {
    if (!root) {
      return undefined;
    }

    const lastFocused = document.activeElement as HTMLElement;

    if (focusRef.current) {
      focusRef.current.focus();
    }

    return () => {
      // This ensures that the focus is returned to
      // previous element
      setTimeout(() => {
        if (lastFocused && lastFocused.focus) {
          lastFocused.focus();
        }
      });
    };
  }, [focusRef, root]);
};

export const useBoundActions = <T extends ActionCreatorsMapObject>(
  actions: T
): T => {
  const dispatch = useDispatch();

  return React.useMemo(() => {
    return bindActionCreators(actions, dispatch);
  }, [actions, dispatch]);
};

export const usePageVisibility = (): boolean => {
  const [result, setResult] = React.useState(!document.hidden);

  React.useEffect(() => {
    const onVisibilityChange = () => {
      setResult(!document.hidden);
    };

    document.addEventListener('visibilitychange', onVisibilityChange, false);

    return () => {
      document.removeEventListener(
        'visibilitychange',
        onVisibilityChange,
        false
      );
    };
  }, []);

  return result;
};

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
  IntersectionObserverEntry | null
] {
  const [
    intersectionObserverEntry,
    setIntersectionObserverEntry,
  ] = React.useState<IntersectionObserverEntry | null>(null);

  const unobserveRef = React.useRef<(() => unknown) | null>(null);

  const setRef = React.useCallback((el?: Element | null) => {
    if (unobserveRef.current) {
      unobserveRef.current();
      unobserveRef.current = null;
    }

    if (!el) {
      return;
    }

    const observer = new IntersectionObserver(entries => {
      if (entries.length !== 1) {
        window.log.error(
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
