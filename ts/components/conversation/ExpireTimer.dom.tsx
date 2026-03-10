// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useEffect, useReducer } from 'react';
import classNames from 'classnames';

import { getIncrement, getTimerBucket } from '../../util/timer.std.js';

export type Props = Readonly<{
  expirationLength: number;
  expirationTimestamp?: number;
}>;

export function ExpireTimer({
  expirationLength,
  expirationTimestamp,
}: Props): React.JSX.Element {
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
        `module-expire-timer--${bucket}`
      )}
    />
  );
}
