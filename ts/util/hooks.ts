import * as React from 'react';
import { ActionCreatorsMapObject, bindActionCreators } from 'redux';
import { useDispatch } from 'react-redux';

// Restore focus on teardown
export const useRestoreFocus = (
  // The ref for the element to receive initial focus
  focusRef: React.RefObject<any>,
  // Allow for an optional root element that must exist
  root: boolean | HTMLElement | null = true
) => {
  React.useEffect(() => {
    if (!root) {
      return;
    }

    const lastFocused = document.activeElement as any;
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
) => {
  const dispatch = useDispatch();

  return React.useMemo(() => {
    return bindActionCreators(actions, dispatch);
  }, [dispatch]);
};
