// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useEffect, useReducer } from 'react';
import classNames from 'classnames';

import { getIncrement, getTimerBucket } from '../../util/timer';

export type Props = {
  direction?: 'incoming' | 'outgoing';
  expirationLength: number;
  expirationTimestamp?: number;
  isOutlineOnlyBubble?: boolean;
  withImageNoCaption?: boolean;
  withSticker?: boolean;
  withTapToViewExpired?: boolean;
};

export function ExpireTimer({
  direction,
  expirationLength,
  expirationTimestamp,
  isOutlineOnlyBubble,
  withImageNoCaption,
  withSticker,
  withTapToViewExpired,
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
        `module-expire-timer--${bucket}`,
        direction ? `module-expire-timer--${direction}` : null,
        isOutlineOnlyBubble ? 'module-expire-timer--outline-only-bubble' : null,
        withTapToViewExpired
          ? `module-expire-timer--${direction}-with-tap-to-view-expired`
          : null,
        direction && withImageNoCaption
          ? 'module-expire-timer--with-image-no-caption'
          : null,
        withSticker ? 'module-expire-timer--with-sticker' : null
      )}
    />
  );
}
