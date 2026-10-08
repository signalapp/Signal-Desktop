// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useReducer, type JSX } from 'react';
import classNames from 'classnames';

import {
  getIncrement,
  getTimerBucket,
  type TimerBucket,
} from '../../util/timer.std.ts';

const TimerBucketClassNames: Record<TimerBucket, string> = {
  '60': 'module-expire-timer--60',
  '55': 'module-expire-timer--55',
  '50': 'module-expire-timer--50',
  '45': 'module-expire-timer--45',
  '40': 'module-expire-timer--40',
  '35': 'module-expire-timer--35',
  '30': 'module-expire-timer--30',
  '25': 'module-expire-timer--25',
  '20': 'module-expire-timer--20',
  '15': 'module-expire-timer--15',
  '10': 'module-expire-timer--10',
  '05': 'module-expire-timer--05',
  '00': 'module-expire-timer--00',
};

export type Props = Readonly<{
  expirationLength: number;
  expirationTimestamp?: number;
}>;

export function ExpireTimer({
  expirationLength,
  expirationTimestamp,
}: Props): JSX.Element {
  const [, forceUpdate] = useReducer(() => ({}), {});

  useEffect(() => {
    const increment = getIncrement(expirationLength);
    const updateFrequency = Math.max(increment, 500);
    const interval = setInterval(forceUpdate, updateFrequency);
    return () => {
      clearInterval(interval);
    };
  }, [expirationLength]);

  const bucket = getTimerBucket(expirationTimestamp, expirationLength);

  return (
    <div
      className={classNames(
        'module-expire-timer',
        TimerBucketClassNames[bucket]
      )}
    />
  );
}
