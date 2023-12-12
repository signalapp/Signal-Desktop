// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useContext, createContext, useEffect, useRef } from 'react';
import * as log from '../logging/log';

export type ScrollerLock = Readonly<{
  isLocked(): boolean;
  lock(reason: string, onUserInterrupt: () => void): () => void;
  onUserInterrupt(reason: string): void;
}>;

export function createScrollerLock(
  title: string,
  onUpdate: () => void
): ScrollerLock {
  const locks = new Set<() => void>();

  let lastUpdate: boolean | null = null;
  function update() {
    const isLocked = locks.size > 0;
    if (isLocked !== lastUpdate) {
      lastUpdate = isLocked;
      onUpdate();
    }
  }

  return {
    isLocked() {
      return locks.size > 0;
    },
    lock(reason, onUserInterrupt) {
      log.info('ScrollerLock: Locking', title, reason);
      locks.add(onUserInterrupt);
      update();
      function release() {
        log.info('ScrollerLock: Releasing', title, reason);
        locks.delete(onUserInterrupt);
        update();
      }
      return release;
    },
    onUserInterrupt(reason) {
      // Ignore interuptions if we're not locked
      if (locks.size > 0) {
        log.info('ScrollerLock: User Interrupt', title, reason);
        locks.forEach(listener => listener());
        locks.clear();
        update();
      }
    },
  };
}

export const ScrollerLockContext = createContext<ScrollerLock | null>(null);

export type ScrollLockProps = Readonly<{
  reason: string;
  lockScrollWhen: boolean;
  onUserInterrupt(): void;
}>;

export function useScrollerLock({
  reason,
  lockScrollWhen,
  onUserInterrupt,
}: ScrollLockProps): void {
  const scrollerLock = useContext(ScrollerLockContext);

  if (scrollerLock == null) {
    throw new Error('Missing <ScrollLockProvider/>');
  }

  const onUserInterruptRef = useRef(onUserInterrupt);
  useEffect(() => {
    onUserInterruptRef.current = onUserInterrupt;
  }, [onUserInterrupt]);

  useEffect(() => {
    if (lockScrollWhen) {
      return scrollerLock.lock(reason, () => {
        onUserInterruptRef.current();
      });
    }
    return undefined;
  }, [reason, scrollerLock, lockScrollWhen, onUserInterrupt]);
}
