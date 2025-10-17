// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useState } from 'react';

import { MINUTE } from '../util/durations/index.std.js';

const listeners = new Set<() => void>();

let timer: ReturnType<typeof setInterval> | undefined;

export function useNowThatUpdatesEveryMinute(): number {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const updateNow = () => setNow(Date.now());
    updateNow();

    if (listeners.size === 0 && timer == null) {
      timer = setInterval(() => {
        for (const fn of listeners) {
          fn();
        }
      }, MINUTE);
    }
    listeners.add(updateNow);

    return () => {
      listeners.delete(updateNow);
      if (listeners.size === 0 && timer != null) {
        clearInterval(timer);
        timer = undefined;
      }
    };
  }, []);

  return now;
}
