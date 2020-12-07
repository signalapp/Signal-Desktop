import React, { useState } from 'react';

import { getTimerBucketIcon } from '../../util/timer';
import { useInterval } from '../../hooks/useInterval';
import styled, { DefaultTheme } from 'styled-components';
import { OpacityMetadataComponent } from './message/MessageMetadata';
import { SessionIcon, SessionIconSize } from '../session/icon';

type Props = {
  withImageNoCaption: boolean;
  expirationLength: number;
  expirationTimestamp: number;
  direction: 'incoming' | 'outgoing';
  theme: DefaultTheme;
};

const ExpireTimerCount = styled(props => (
  <OpacityMetadataComponent {...props} />
))<{ color: string }>`
  margin-inline-start: 6px;
  font-size: 11px;
  line-height: 16px;
  letter-spacing: 0.3px;
  text-transform: uppercase;
  user-select: none;
  color: ${props => props.color};
`;

const ExpireTimerBucket = styled(props => (
  <OpacityMetadataComponent {...props} />
))<{ color: string }>`
  margin-inline-start: 6px;
  font-size: 11px;
  line-height: 16px;
  letter-spacing: 0.3px;
  text-transform: uppercase;
  user-select: none;
  color: ${props => props.color};
`;

export const ExpireTimer = (props: Props) => {
  const { expirationLength, expirationTimestamp, withImageNoCaption } = props;

  const initialTimeLeft = Math.max(
    Math.round((expirationTimestamp - Date.now()) / 1000),
    0
  );
  const [timeLeft, setTimeLeft] = useState(initialTimeLeft);

  const update = () => {
    const newTimeLeft = Math.max(
      Math.round((expirationTimestamp - Date.now()) / 1000),
      0
    );
    if (newTimeLeft !== timeLeft) {
      setTimeLeft(newTimeLeft);
    }
  };

  const updateFrequency = 500;

  useInterval(update, updateFrequency);

  const expireTimerColor = withImageNoCaption
    ? 'white'
    : props.theme.colors.textColor;

  if (timeLeft <= 60) {
    return (
      <ExpireTimerCount color={expireTimerColor}>{timeLeft}</ExpireTimerCount>
    );
  }
  const bucket = getTimerBucketIcon(expirationTimestamp, expirationLength);

  return (
    <ExpireTimerBucket>
      <SessionIcon
        iconType={bucket}
        iconSize={SessionIconSize.Tiny}
        iconColor={expireTimerColor}
        theme={props.theme}
      />
    </ExpireTimerBucket>
  );
};
