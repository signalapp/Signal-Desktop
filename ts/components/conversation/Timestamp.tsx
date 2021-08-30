import React, { useCallback, useState } from 'react';
import moment from 'moment';

import { formatRelativeTime } from '../../util/formatRelativeTime';
import { useInterval } from '../../hooks/useInterval';
import styled from 'styled-components';

type Props = {
  timestamp?: number;
  extended?: boolean;
  module?: string;
  withImageNoCaption?: boolean;
  isConversationListItem?: boolean;
};

const UPDATE_FREQUENCY = 60 * 1000;

const TimestampContainerListItem = styled.div`
  flex-shrink: 0;
  margin-inline-start: 6px;
  font-size: 11px;
  line-height: 16px;
  letter-spacing: 0.3px;
  overflow-x: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  text-transform: uppercase;
  color: ${props => props.theme.colors.textColor};
`;

const TimestampContainerNotListItem = styled.div`
  font-size: 11px;
  line-height: 16px;
  letter-spacing: 0.3px;
  text-transform: uppercase;
  user-select: none;
  color: ${props => props.theme.colors.textColor};
`;

export const Timestamp = (props: Props) => {
  const [_lastUpdated, setLastUpdated] = useState(Date.now());
  // this is kind of a hack, but we use lastUpdated just to trigger a refresh.
  // formatRelativeTime() will print the correct moment.
  const update = useCallback(() => {
    setLastUpdated(Date.now());
  }, []);

  useInterval(update, UPDATE_FREQUENCY);

  const { timestamp, extended } = props;

  if (timestamp === null || timestamp === undefined) {
    return null;
  }

  // Use relative time for under 24hrs ago.
  const now = Math.floor(Date.now());
  const messageAgeInDays = (now - timestamp) / (window.CONSTANTS.SECS_IN_DAY * 1000);
  const daysBeforeRelativeTiming = 1;

  let dateString;
  if (messageAgeInDays > daysBeforeRelativeTiming) {
    dateString = formatRelativeTime(timestamp, { extended });
  } else {
    dateString = moment(timestamp).fromNow();
    // Prevent times reading "NOW AGO"
    if (dateString.startsWith('now') || dateString.startsWith('Now')) {
      dateString = 'now';
    }

    dateString = dateString.replace('minutes', 'mins').replace('minute', 'min');
  }

  const title = moment(timestamp).format('llll');
  if (props.isConversationListItem) {
    return <TimestampContainerListItem title={title}>{dateString}</TimestampContainerListItem>;
  }
  return <TimestampContainerNotListItem title={title}>{dateString}</TimestampContainerNotListItem>;
};
