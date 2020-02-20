import * as React from 'react';

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
