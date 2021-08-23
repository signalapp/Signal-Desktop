import React, { useCallback, useState } from 'react';

import { getTimerBucketIcon } from '../../util/timer';
import { useInterval } from '../../hooks/useInterval';
import styled, { useTheme } from 'styled-components';
import { SessionIcon, SessionIconSize } from '../session/icon';

type Props = {
  expirationLength: number;
  expirationTimestamp: number;
};

const ExpireTimerCount = styled.div<{
  color: string;
}>`
  margin-inline-start: 6px;
  font-size: 11px;
  line-height: 16px;
  letter-spacing: 0.3px;
  text-transform: uppercase;
  user-select: none;
  color: ${props => props.color};
`;

const ExpireTimerBucket = styled.div`
  margin-inline-start: 6px;
  font-size: 11px;
  line-height: 16px;
  letter-spacing: 0.3px;
  text-transform: uppercase;
  user-select: none;
  color: ${props => props.theme.colors.textColor};
`;

export const ExpireTimer = (props: Props) => {
  const { expirationLength, expirationTimestamp } = props;

  const initialTimeLeft = Math.max(Math.round((expirationTimestamp - Date.now()) / 1000), 0);
  const [timeLeft, setTimeLeft] = useState(initialTimeLeft);
  const theme = useTheme();

  const update = useCallback(() => {
    const newTimeLeft = Math.max(Math.round((expirationTimestamp - Date.now()) / 1000), 0);
    if (newTimeLeft !== timeLeft) {
      setTimeLeft(newTimeLeft);
    }
  }, [expirationTimestamp, timeLeft, setTimeLeft]);

  const updateFrequency = 500;

  useInterval(update, updateFrequency);

  const expireTimerColor = theme.colors.textColor;

  if (timeLeft <= 60) {
    return <ExpireTimerCount color={expireTimerColor}>{timeLeft}</ExpireTimerCount>;
  }
  const bucket = getTimerBucketIcon(expirationTimestamp, expirationLength);

  return (
    <ExpireTimerBucket>
      <SessionIcon
        iconType={bucket}
        iconSize={SessionIconSize.Tiny}
        iconColor={expireTimerColor}
        theme={theme}
      />
    </ExpireTimerBucket>
  );
};
