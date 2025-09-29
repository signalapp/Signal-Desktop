// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useRef, useState } from 'react';
import { BeforeNavigateResponse } from '../services/BeforeNavigate.js';
import type {
  BeforeNavigateCallback,
  BeforeNavigateTransitionDetails,
} from '../services/BeforeNavigate.js';

type NavBlockerBlocked = Readonly<{
  state: 'blocked';
  respond: (response: BeforeNavigateResponse) => void;
}>;

type NavBlockerUnblocked = Readonly<{
  state: 'unblocked';
  respond?: never;
}>;

export type NavBlocker = NavBlockerBlocked | NavBlockerUnblocked;

export type NavBlockerFunction = (
  details: BeforeNavigateTransitionDetails
) => boolean;

export type ShouldBlock = boolean | NavBlockerFunction;

function checkShouldBlock(
  shouldBlock: ShouldBlock,
  details: BeforeNavigateTransitionDetails
): boolean {
  if (typeof shouldBlock === 'function') {
    return shouldBlock(details);
  }
  return shouldBlock;
}

export function useNavBlocker(
  name: string,
  shouldBlock: ShouldBlock
): NavBlocker {
  const nameRef = useRef(name);
  useEffect(() => {
    nameRef.current = name;
  }, [name]);

  const shouldBlockRef = useRef(shouldBlock);
  useEffect(() => {
    shouldBlockRef.current = shouldBlock;
  }, [shouldBlock]);

  const [blocker, setBlocker] = useState<NavBlocker>(() => {
    return { state: 'unblocked' };
  });

  useEffect(() => {
    const nameValue = nameRef.current;

    const callback: BeforeNavigateCallback = async details => {
      const shouldBlockNav = checkShouldBlock(shouldBlockRef.current, details);

      if (!shouldBlockNav) {
        return BeforeNavigateResponse.Noop;
      }

      const { promise, resolve } =
        Promise.withResolvers<BeforeNavigateResponse>();

      function respond(response: BeforeNavigateResponse) {
        setBlocker({ state: 'unblocked' });
        resolve(response);
      }

      setBlocker({
        state: 'blocked',
        respond,
      });

      return promise;
    };

    window.Signal.Services.beforeNavigate.registerCallback({
      callback,
      name: nameValue,
    });
    return () => {
      window.Signal.Services.beforeNavigate.unregisterCallback({
        callback,
        name: nameValue,
      });
    };
  }, []);

  return blocker;
}
