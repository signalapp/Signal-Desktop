import { useCallback, useState } from 'react';

import useInterval from 'react-use/lib/useInterval';
import styled, { CSSProperties } from 'styled-components';
import { getTimerBucketIcon } from '../../util/timer';

import { SessionIcon } from '../icon/SessionIcon';

const ExpireTimerBucket = styled.div`
  font-size: var(--font-size-xs);
  letter-spacing: 0.3px;
  text-transform: uppercase;
  user-select: none;
  color: var(--text-secondary-color);
  align-self: center;
`;

type Props = {
  expirationDurationMs?: number;
  expirationTimestamp?: number | null;
  style?: CSSProperties;
};

export const ExpireTimer = (props: Props) => {
  const { expirationDurationMs, expirationTimestamp, style } = props;

  const initialTimeLeft = Math.max(Math.round(((expirationTimestamp || 0) - Date.now()) / 1000), 0);
  const [timeLeft, setTimeLeft] = useState(initialTimeLeft);

  const update = useCallback(() => {
    if (expirationTimestamp) {
      const newTimeLeft = Math.max(Math.round((expirationTimestamp - Date.now()) / 1000), 0);
      if (newTimeLeft !== timeLeft) {
        setTimeLeft(newTimeLeft);
      }
    }
  }, [expirationTimestamp, timeLeft, setTimeLeft]);

  const updateFrequency = 500;
  useInterval(update, updateFrequency);

  if (!(expirationDurationMs && expirationTimestamp)) {
    return null;
  }

  const bucket = getTimerBucketIcon(expirationTimestamp, expirationDurationMs);

  return (
    <ExpireTimerBucket style={style}>
      <SessionIcon iconType={bucket} iconSize="tiny" iconColor={'var(--secondary-text-color)'} />
    </ExpireTimerBucket>
  );
};
