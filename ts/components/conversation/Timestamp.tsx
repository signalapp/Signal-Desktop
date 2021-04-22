import React, { useState } from 'react';
import classNames from 'classnames';
import moment from 'moment';

import { formatRelativeTime } from '../../util/formatRelativeTime';
import { useInterval } from '../../hooks/useInterval';
import styled, { DefaultTheme } from 'styled-components';
import { OpacityMetadataComponent } from './message/MessageMetadata';

type Props = {
  timestamp?: number;
  extended?: boolean;
  module?: string;
  withImageNoCaption?: boolean;
  isConversationListItem?: boolean;
  theme: DefaultTheme;
};

const UPDATE_FREQUENCY = 60 * 1000;

const TimestampContainerListItem = styled(props => <OpacityMetadataComponent {...props} />)<{
  color: string;
}>`
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

const TimestampContainerNotListItem = styled(props => <OpacityMetadataComponent {...props} />)<{
  color: string;
}>`
  font-size: 11px;
  line-height: 16px;
  letter-spacing: 0.3px;
  text-transform: uppercase;
  user-select: none;
  color: ${props => props.timestampColor};
`;

export const Timestamp = (props: Props) => {
  const [lastUpdated, setLastUpdated] = useState(Date.now());
  // this is kind of a hack, but we use lastUpdated just to trigger a refresh.
  // formatRelativeTime() will print the correct moment.
  const update = () => {
    setLastUpdated(Date.now());
  };

  useInterval(update, UPDATE_FREQUENCY);

  const { module, timestamp, withImageNoCaption, extended } = props;
  const moduleName = module || 'module-timestamp';

  if (timestamp === null || timestamp === undefined) {
    return null;
  }

  // Use relative time for under 24hrs ago.
  const now = Math.floor(Date.now());
  const messageAgeInDays = (now - timestamp) / (window.CONSTANTS.SECS_IN_DAY * 1000);
  const daysBeforeRelativeTiming = 1;

  let dateString;
  if (messageAgeInDays > daysBeforeRelativeTiming) {
    dateString = formatRelativeTime(timestamp, { i18n: window.i18n, extended });
  } else {
    dateString = moment(timestamp).fromNow();
    // Prevent times reading "NOW AGO"
    if (dateString.startsWith('now') || dateString.startsWith('Now')) {
      dateString = 'now';
    }

    dateString = dateString.replace('minutes', 'mins').replace('minute', 'min');
  }

  const timestampColor = withImageNoCaption ? 'white' : props.theme.colors.textColor;
  const title = moment(timestamp).format('llll');
  if (props.isConversationListItem) {
    return (
      <TimestampContainerListItem timestampColor={timestampColor} title={title}>
        {dateString}
      </TimestampContainerListItem>
    );
  }
  return (
    <TimestampContainerNotListItem timestampColor={timestampColor} title={title}>
      {dateString}
    </TimestampContainerNotListItem>
  );
};
