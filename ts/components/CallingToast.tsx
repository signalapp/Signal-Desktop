// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import { useFocusWithin, useHover, mergeProps } from 'react-aria';
import { createPortal } from 'react-dom';
import { useTransition, animated } from '@react-spring/web';
import classNames from 'classnames';
import { v4 as uuid } from 'uuid';
import { useIsMounted } from '../hooks/useIsMounted';
import type { LocalizerType } from '../types/I18N';
import { usePrevious } from '../hooks/usePrevious';

const DEFAULT_LIFETIME = 5000;

export type CallingToastType = {
  // If key is provided, calls to showToast will be idempotent; otherwise an
  // auto-generated key will be returned
  key?: string;
  content: JSX.Element | string;
  autoClose: boolean;
  dismissable?: boolean;
} & (
  | {
      // key must be provided if the toast is 'only-show-once'
      key: string;
      onlyShowOnce: true;
    }
  | {
      onlyShowOnce?: never;
    }
);

type CallingToastStateType = CallingToastType & {
  key: string;
};

type CallingToastContextType = {
  showToast: (toast: CallingToastType) => string;
  hideToast: (id: string) => void;
};

type TimeoutType =
  | { status: 'active'; timeout: NodeJS.Timeout; endAt: number }
  | { status: 'paused'; remaining: number };

const CallingToastContext = createContext<CallingToastContextType | null>(null);

export function CallingToastProvider({
  i18n,
  children,
  maxToasts = 5,
}: {
  i18n: LocalizerType;
  children: React.ReactNode;
  maxToasts?: number;
}): JSX.Element {
  const [toasts, setToasts] = React.useState<Array<CallingToastStateType>>([]);
  const previousToasts = usePrevious([], toasts);
  const timeouts = React.useRef<Map<string, TimeoutType>>(new Map());
  // All toasts are paused on hover or focus so that toasts don't disappear while a user
  // is attempting to interact with them
  const timeoutsStatus = React.useRef<'active' | 'paused'>('active');
  const shownToasts = React.useRef<Set<string>>(new Set());
  const isMounted = useIsMounted();

  const clearToastTimeout = useCallback((key: string) => {
    const timeout = timeouts.current.get(key);
    if (timeout?.status === 'active') {
      clearTimeout(timeout.timeout);
    }
    timeouts.current.delete(key);
  }, []);

  const hideToast = useCallback(
    (key: string) => {
      if (!isMounted()) {
        return;
      }

      clearToastTimeout(key);

      setToasts(state => {
        const existingIndex = state.findIndex(toast => toast.key === key);
        if (existingIndex === -1) {
          // Important to return the same state object here to avoid infinite recursion if
          // hideToast is in a useEffect dependency array
          return state;
        }
        return [
          ...state.slice(0, existingIndex),
          ...state.slice(existingIndex + 1),
        ];
      });
    },
    [isMounted, clearToastTimeout]
  );

  const startTimer = useCallback(
    (key: string, duration: number) => {
      if (timeoutsStatus.current === 'paused') {
        timeouts.current.set(key, { status: 'paused', remaining: duration });
      } else {
        timeouts.current.set(key, {
          timeout: setTimeout(() => hideToast(key), duration),
          status: 'active',
          endAt: Date.now() + duration,
        });
      }
    },
    [hideToast]
  );

  const showToast = useCallback(
    (toast: CallingToastType): string => {
      if (toast.onlyShowOnce && shownToasts.current.has(toast.key)) {
        return toast.key;
      }

      const key = toast.key ?? uuid();

      setToasts(state => {
        const isCurrentlyBeingShown = state.some(
          existingToast => toast.key === existingToast.key
        );

        if (isCurrentlyBeingShown) {
          return state;
        }

        if (state.length === maxToasts) {
          const toastToBePushedOut = state.at(-1);
          if (toastToBePushedOut) {
            clearToastTimeout(toastToBePushedOut.key);
          }
        }

        if (toast.autoClose) {
          startTimer(key, DEFAULT_LIFETIME);
        }
        shownToasts.current.add(key);

        return [{ ...toast, key }, ...state.slice(0, maxToasts - 1)];
      });

      return key;
    },
    [startTimer, clearToastTimeout, maxToasts]
  );

  const pauseAll = useCallback(() => {
    const now = Date.now();
    timeoutsStatus.current = 'paused';

    for (const [key, timeout] of [...timeouts.current.entries()]) {
      if (!timeout || timeout.status !== 'active') {
        return;
      }
      clearTimeout(timeout.timeout);

      timeouts.current.set(key, {
        status: 'paused',
        remaining: timeout.endAt - now,
      });
    }
  }, []);

  const resumeAll = useCallback(() => {
    timeoutsStatus.current = 'active';

    for (const [key, timeout] of [...timeouts.current.entries()]) {
      if (!timeout || timeout.status !== 'paused') {
        return;
      }

      startTimer(key, timeout.remaining);
    }
  }, [startTimer]);

  const { hoverProps } = useHover({
    onHoverStart: () => pauseAll(),
    onHoverEnd: () => resumeAll(),
  });
  const { focusWithinProps } = useFocusWithin({
    onFocusWithin: () => pauseAll(),
    onBlurWithin: () => resumeAll(),
  });

  const TOAST_HEIGHT_PX = 42;
  const TOAST_GAP_PX = 8;
  const transitions = useTransition(toasts, {
    from: item => ({
      opacity: 0,
      marginTop:
        // If this is the first toast shown, or if this is replacing the
        // first toast, we just fade-in (and don't slide down)
        previousToasts.length === 0 || item.key === previousToasts[0].key
          ? '0px'
          : `${-1 * TOAST_HEIGHT_PX}px`,
    }),
    enter: {
      opacity: 1,
      zIndex: 1,
      marginTop: '0px',
      config: (key: string) => {
        if (key === 'marginTop') {
          return {
            velocity: 0.005,
            friction: 30,
          };
        }
        return {};
      },
    },
    leave: item => {
      return {
        zIndex: 0,
        opacity: 0,
        // If the last toast in the list is leaving, we don't need to move it up.
        marginTop:
          previousToasts.findIndex(toast => toast.key === item.key) ===
          previousToasts.length - 1
            ? '0px'
            : `${-1 * (TOAST_HEIGHT_PX + TOAST_GAP_PX)}px`,
        // If this toast is being replaced by another one with the same key, immediately
        // hide it
        display: toasts.some(toast => toast.key === item.key)
          ? 'none'
          : 'block',
        config: (key: string) => {
          if (key === 'zIndex') {
            return { duration: 0 };
          }
          if (key === 'opacity') {
            return { duration: 100 };
          }
          return {
            duration: 300,
          };
        },
      };
    },
  });

  const contextValue = useMemo(() => {
    return {
      showToast,
      hideToast,
    };
  }, [showToast, hideToast]);

  return (
    <CallingToastContext.Provider value={contextValue}>
      {createPortal(
        <div className="CallingToasts">
          <div
            className="CallingToasts__inner"
            role="region"
            aria-label={i18n('icu:calling__toasts--aria-label')}
            {...mergeProps(hoverProps, focusWithinProps)}
          >
            {transitions((style, item) => (
              <animated.div style={style}>
                <CallingToast
                  {...item}
                  onClick={
                    item.dismissable ? () => hideToast(item.key) : undefined
                  }
                />
              </animated.div>
            ))}
          </div>
        </div>,
        document.body
      )}
      {children}
    </CallingToastContext.Provider>
  );
}

function CallingToast(
  props: CallingToastType & {
    onClick?: VoidFunction;
  }
): JSX.Element {
  const className = classNames(
    'CallingToast',
    props.dismissable && 'CallingToast--dismissable'
  );

  const elementHtmlProps: React.HTMLAttributes<HTMLDivElement> = {
    role: 'alert',
    'aria-live': props.autoClose ? 'assertive' : 'polite',
  };

  if (props.dismissable) {
    return (
      <div {...elementHtmlProps}>
        <button className={className} type="button" onClick={props.onClick}>
          {props.content}
        </button>
      </div>
    );
  }
  return (
    <div {...elementHtmlProps} className={className}>
      {props.content}
    </div>
  );
}

// Preferred way of showing/hiding toasts: useCallingToasts is a helper function which
// will hide all toasts shown when the component from which you are using it unmounts
export function useCallingToasts(): CallingToastContextType {
  const callingToastContext = useContext(CallingToastContext);

  if (!callingToastContext) {
    throw new Error('Calling Toasts must be wrapped in CallingToastProvider');
  }
  const toastsShown = useRef<Set<string>>(new Set());

  const wrappedShowToast = useCallback(
    (toast: CallingToastType) => {
      const key = callingToastContext.showToast(toast);
      toastsShown.current.add(key);
      return key;
    },
    [callingToastContext]
  );

  const hideAllShownToasts = useCallback(() => {
    [...toastsShown.current].forEach(callingToastContext.hideToast);
  }, [callingToastContext]);

  useEffect(() => {
    return hideAllShownToasts;
  }, [hideAllShownToasts]);

  return useMemo(
    () => ({
      ...callingToastContext,
      showToast: wrappedShowToast,
    }),
    [wrappedShowToast, callingToastContext]
  );
}
