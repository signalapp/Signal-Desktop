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
import { difference } from '../util/setUtil';
import { useReducedMotion } from '../hooks/useReducedMotion';

const DEFAULT_LIFETIME = 5000;
const DEFAULT_TRANSITION_FROM = {
  opacity: 0,
  scale: 0.85,
};

export type CallingToastType = {
  // If key is provided, calls to showToast will be idempotent; otherwise an
  // auto-generated key will be returned
  key?: string;
  content: JSX.Element | string;
  autoClose: boolean;
  dismissable?: boolean;
  lifetime?: number;
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
  region,
  maxNonPersistentToasts = 5,
  lifetime = DEFAULT_LIFETIME,
  transitionFrom = DEFAULT_TRANSITION_FROM,
}: {
  i18n: LocalizerType;
  children: React.ReactNode;
  region?: React.RefObject<HTMLElement>;
  maxNonPersistentToasts?: number;
  lifetime?: number;
  transitionFrom?: object;
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

        const persistentToasts = state.filter(({ autoClose }) => !autoClose);
        const nonPersistentToasts = state.filter(({ autoClose }) => autoClose);

        if (
          nonPersistentToasts.length === maxNonPersistentToasts &&
          maxNonPersistentToasts > 0
        ) {
          const toastToBePushedOut = nonPersistentToasts.pop();

          if (toastToBePushedOut) {
            clearToastTimeout(toastToBePushedOut.key);
          }
        }

        if (toast.autoClose) {
          startTimer(key, toast.lifetime ?? lifetime);
          nonPersistentToasts.unshift({ ...toast, key });
        } else {
          persistentToasts.unshift({ ...toast, key });
        }
        shownToasts.current.add(key);

        // Show persistent toasts at top of list always
        return [...persistentToasts, ...nonPersistentToasts];
      });

      return key;
    },
    [startTimer, clearToastTimeout, maxNonPersistentToasts, lifetime]
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

  const curToasts = new Set(toasts);
  const prevToasts = new Set(previousToasts);

  const toastsRemoved = difference(prevToasts, curToasts);
  const toastsAdded = difference(curToasts, prevToasts);

  const reducedMotion = useReducedMotion();

  const transitions = useTransition(toasts, {
    immediate: reducedMotion,
    from: item => {
      const enteringItemIndex = toasts.findIndex(
        toast => toast.key === item.key
      );
      const isToastReplacingAnExistingOneAtThisPosition = toastsRemoved.has(
        previousToasts[enteringItemIndex]
      );
      return {
        ...transitionFrom,
        zIndex: item.autoClose ? 1 : 2,
        marginTop:
          // If this toast is replacing an existing one, don't slide-down, just fade-in
          // Note: this just refers to toasts added / removed within one render cycle;
          // this will almost always be when replacing toasts that are related
          // Note: this
          // Example:
          //    previous                       current
          //     "Muted"                      "Unmuted"
          //
          // The previous toast should disappear and the new one should fade-in in its
          // place, so it looks like a replacement.
          isToastReplacingAnExistingOneAtThisPosition
            ? '0px'
            : `${-1 * TOAST_HEIGHT_PX}px`,
      };
    },
    enter: {
      opacity: 1,
      scale: 1,
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
      const leavingItemIndex = previousToasts.findIndex(
        toast => toast.key === item.key
      );
      const isToastBeingReplacedByANewOneAtThisPosition = toastsAdded.has(
        toasts[leavingItemIndex]
      );
      return {
        zIndex: 0,
        opacity: 0,
        // If the last toast in the list is leaving, we don't need to move it up.
        marginTop:
          leavingItemIndex === previousToasts.length - 1
            ? '0px'
            : `${-1 * (TOAST_HEIGHT_PX + TOAST_GAP_PX)}px`,
        // If this toast is being replaced by a new toast at this position, disappear
        // immediately (don't interfere with new one coming in)
        display: isToastBeingReplacedByANewOneAtThisPosition ? 'none' : 'block',
        config: (key: string) => {
          if (key === 'zIndex') {
            return { duration: 0 };
          }
          if (key === 'display') {
            return { duration: 0 };
          }
          if (key === 'opacity') {
            return { duration: 100 };
          }
          return { clamp: true, duration: 200 };
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
        region?.current ?? document.body
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
    !props.autoClose && 'CallingToast--persistent',
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

export function PersistentCallingToast({
  children,
}: {
  children: string | JSX.Element;
}): null {
  const { showToast } = useCallingToasts();
  const toastId = useRef<string>(uuid());
  useEffect(() => {
    showToast({
      key: toastId.current,
      content: children,
      autoClose: false,
    });
  }, [children, showToast]);

  return null;
}
