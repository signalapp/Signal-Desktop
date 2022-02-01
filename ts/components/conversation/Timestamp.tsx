import React, { useCallback, useState } from 'react';
import moment from 'moment';

// tslint:disable-next-line: no-submodule-imports
import useInterval from 'react-use/lib/useInterval';
import styled from 'styled-components';

type Props = {
  timestamp?: number;
  isConversationListItem?: boolean;
  momentFromNow: boolean;
};

const UPDATE_FREQUENCY = 60 * 1000;

const TimestampContainerNotListItem = styled.div`
  font-size: 11px;
  line-height: 16px;
  letter-spacing: 0.3px;
  text-transform: uppercase;
  user-select: none;
  color: var(--color-text-subtle);
`;

const TimestampContainerListItem = styled(TimestampContainerNotListItem)`
  flex-shrink: 0;
  margin-inline-start: 6px;
  overflow-x: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
`;

export const Timestamp = (props: Props) => {
  const [_lastUpdated, setLastUpdated] = useState(Date.now());
  // this is kind of a hack, but we use lastUpdated just to trigger a refresh.
  // formatRelativeTime() will print the correct moment.
  const update = useCallback(() => {
    setLastUpdated(Date.now());
  }, [setLastUpdated]);

  useInterval(update, UPDATE_FREQUENCY);

  const { timestamp, momentFromNow } = props;

  if (timestamp === null || timestamp === undefined) {
    return null;
  }

  const momentValue = moment(timestamp);
  let dateString: string = '';
  if (momentFromNow) {
    dateString = momentValue.fromNow();
  } else {
    dateString = momentValue.format('lll');
  }

  dateString = dateString.replace('minutes', 'mins').replace('minute', 'min');

  const title = moment(timestamp).format('llll');
  if (props.isConversationListItem) {
    return <TimestampContainerListItem title={title}>{dateString}</TimestampContainerListItem>;
  }
  return <TimestampContainerNotListItem title={title}>{dateString}</TimestampContainerNotListItem>;
};
