// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { EventEmitter } from 'events';
import { useEffect, useState } from 'react';

import { MINUTE } from '../util/durations';

const ev = new EventEmitter();
ev.setMaxListeners(Infinity);
setInterval(() => ev.emit('tick'), MINUTE);

export function useNowThatUpdatesEveryMinute(): number {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const updateNow = () => setNow(Date.now());
    updateNow();

    ev.on('tick', updateNow);

    return () => {
      ev.off('tick', updateNow);
    };
  }, []);

  return now;
}
