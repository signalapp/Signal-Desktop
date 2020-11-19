import React, { useState } from 'react';
import classNames from 'classnames';

import { getIncrement, getTimerBucket } from '../../util/timer';
import { useInterval } from '../../hooks/useInterval';

type Props = {
  withImageNoCaption: boolean;
  expirationLength: number;
  expirationTimestamp: number;
  direction: 'incoming' | 'outgoing';
};

export const ExpireTimer = (props: Props) => {
  const [lastUpdated, setLastUpdated] = useState(Date.now());
  const update = () => {
    setLastUpdated(Date.now());
  };
  const {
    direction,
    expirationLength,
    expirationTimestamp,
    withImageNoCaption,
  } = props;

  const increment = getIncrement(expirationLength);
  const updateFrequency = Math.max(increment, 500);

  useInterval(update, updateFrequency);

  const bucket = getTimerBucket(expirationTimestamp, expirationLength);
  let timeLeft = Math.round((expirationTimestamp - Date.now()) / 1000);
  timeLeft = timeLeft >= 0 ? timeLeft : 0;
  if (timeLeft <= 60) {
    return (
      <span
        className={classNames(
          'module-expire-timer-margin',
          'module-message__metadata__date',
          `module-message__metadata__date--${direction}`
        )}
      >
        {timeLeft}
      </span>
    );
  }

  return (
    <div
      className={classNames(
        'module-expire-timer',
        'module-expire-timer-margin',
        `module-expire-timer--${bucket}`,
        `module-expire-timer--${direction}`,
        withImageNoCaption ? 'module-expire-timer--with-image-no-caption' : null
      )}
    />
  );
};
