// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { v4 as uuid } from 'uuid';
import { useIsMounted } from '../hooks/useIsMounted';
import { CallReactionBurstEmoji } from './CallReactionBurstEmoji';

const LIFETIME = 3000;

export type CallReactionBurstType = {
  values: Array<string>;
};

type CallReactionBurstStateType = CallReactionBurstType & {
  key: string;
};

type CallReactionBurstContextType = {
  showBurst: (burst: CallReactionBurstType) => string;
  hideBurst: (key: string) => void;
};

const CallReactionBurstContext =
  createContext<CallReactionBurstContextType | null>(null);

export function CallReactionBurstProvider({
  children,
  region,
}: {
  children: React.ReactNode;
  region?: React.RefObject<HTMLElement>;
}): JSX.Element {
  const [bursts, setBursts] = useState<Array<CallReactionBurstStateType>>([]);
  const timeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const shownBursts = useRef<Set<string>>(new Set());
  const isMounted = useIsMounted();

  const clearBurstTimeout = useCallback((key: string) => {
    const timeout = timeouts.current.get(key);
    if (timeout) {
      clearTimeout(timeout);
    }
    timeouts.current.delete(key);
  }, []);

  const hideBurst = useCallback(
    (key: string) => {
      if (!isMounted()) {
        return;
      }

      clearBurstTimeout(key);

      setBursts(state => {
        const existingIndex = state.findIndex(burst => burst.key === key);
        if (existingIndex === -1) {
          // Important to return the same state object here to avoid infinite recursion if
          // hideBurst is in a useEffect dependency array
          return state;
        }
        return [
          ...state.slice(0, existingIndex),
          ...state.slice(existingIndex + 1),
        ];
      });
    },
    [isMounted, clearBurstTimeout]
  );

  const startTimer = useCallback(
    (key: string, duration: number) => {
      timeouts.current.set(
        key,
        setTimeout(() => hideBurst(key), duration)
      );
    },
    [hideBurst]
  );

  const showBurst = useCallback(
    (burst: CallReactionBurstType): string => {
      const key = uuid();

      setBursts(state => {
        startTimer(key, LIFETIME);
        state.unshift({ ...burst, key });
        shownBursts.current.add(key);

        return state;
      });

      return key;
    },
    [startTimer]
  );

  const contextValue = useMemo(() => {
    return {
      showBurst,
      hideBurst,
    };
  }, [showBurst, hideBurst]);

  // Immediately trigger a state update before the portal gets shown to prevent
  // DOM jumping on initial render
  const [container, setContainer] = useState(document.body);
  React.useLayoutEffect(() => {
    if (region?.current) {
      setContainer(region.current);
    }
  }, [region]);

  return (
    <CallReactionBurstContext.Provider value={contextValue}>
      {createPortal(
        <div className="CallReactionBursts">
          {bursts.map(({ values, key }) => (
            <CallReactionBurstEmoji
              key={key}
              values={values}
              onAnimationEnd={() => hideBurst(key)}
            />
          ))}
        </div>,
        container
      )}
      {children}
    </CallReactionBurstContext.Provider>
  );
}

// Use this to access showBurst and hideBurst and ensure bursts are hidden on unmount
export function useCallReactionBursts(): CallReactionBurstContextType {
  const context = useContext(CallReactionBurstContext);

  if (!context) {
    throw new Error(
      'Call Reaction Bursts must be wrapped in CallReactionBurstProvider'
    );
  }
  const burstsShown = useRef<Set<string>>(new Set());

  const wrappedShowBurst = useCallback(
    (burst: CallReactionBurstType) => {
      const key = context.showBurst(burst);
      burstsShown.current.add(key);
      return key;
    },
    [context]
  );

  const hideAllShownBursts = useCallback(() => {
    [...burstsShown.current].forEach(context.hideBurst);
  }, [context]);

  useEffect(() => {
    return hideAllShownBursts;
  }, [hideAllShownBursts]);

  return useMemo(
    () => ({
      ...context,
      showBurst: wrappedShowBurst,
    }),
    [wrappedShowBurst, context]
  );
}
