// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

type CallbackType = (toFocus: HTMLElement | null | undefined) => void;

// Restore focus on teardown
export const useRestoreFocus = (): Array<CallbackType> => {
  const toFocusRef = React.useRef<HTMLElement | null>(null);
  const lastFocusedRef = React.useRef<HTMLElement | null>(null);

  // We need to use a callback here because refs aren't necessarily populated on first
  //   render. For example, ModalHost makes a top-level parent div first, and then renders
  //   into it. And the children you pass it don't have access to that root div.
  const setFocusRef = React.useCallback(
    (toFocus: HTMLElement | null | undefined) => {
      if (!toFocus) {
        return;
      }

      // We only want to do this once.
      if (toFocusRef.current) {
        return;
      }
      toFocusRef.current = toFocus;

      // Remember last-focused element, focus this new target element.
      lastFocusedRef.current = document.activeElement as HTMLElement;
      toFocus.focus();
    },
    []
  );

  React.useEffect(() => {
    return () => {
      // On unmount, returned focus to element focused before we set the focus
      setTimeout(() => {
        if (lastFocusedRef.current && lastFocusedRef.current.focus) {
          lastFocusedRef.current.focus();
        }
      });
    };
  }, []);

  return [setFocusRef];
};

// Panels are initially rendered outside the DOM, and then added to it. We need to
//   delay our attempts to set focus.
// Just like the above hook, but with a debounce.
export const useDelayedRestoreFocus = (): Array<CallbackType> => {
  const toFocusRef = React.useRef<HTMLElement | null>(null);
  const lastFocusedRef = React.useRef<HTMLElement | null>(null);

  const setFocusRef = React.useCallback(
    (toFocus: HTMLElement | null | undefined) => {
      function setFocus() {
        if (!toFocus) {
          return;
        }

        // We only want to do this once.
        if (toFocusRef.current) {
          return;
        }
        toFocusRef.current = toFocus;

        // Remember last-focused element, focus this new target element.
        lastFocusedRef.current = document.activeElement as HTMLElement;
        toFocus.focus();
      }

      const timeout = setTimeout(setFocus, 250);

      return () => {
        clearTimeout(timeout);
      };
    },
    []
  );

  React.useEffect(() => {
    return () => {
      // On unmount, returned focus to element focused before we set the focus
      setTimeout(() => {
        if (lastFocusedRef.current && lastFocusedRef.current.focus) {
          lastFocusedRef.current.focus();
        }
      });
    };
  }, []);

  return [setFocusRef];
};
