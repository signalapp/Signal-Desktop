// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { ActionCreatorsMapObject, bindActionCreators } from 'redux';
import { useDispatch } from 'react-redux';

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
