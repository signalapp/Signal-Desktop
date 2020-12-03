import React, { useState } from 'react';
import classNames from 'classnames';
import moment from 'moment';

import { formatRelativeTime } from '../../util/formatRelativeTime';
import { useInterval } from '../../hooks/useInterval';

type Props = {
  timestamp?: number;
  extended?: boolean;
  module?: string;
  withImageNoCaption?: boolean;
  direction?: 'incoming' | 'outgoing';
};

const UPDATE_FREQUENCY = 60 * 1000;

export const Timestamp = (props: Props) => {
  const [lastUpdated, setLastUpdated] = useState(Date.now());
  // this is kind of a hack, but we use lastUpdated just to trigger a refresh
  // formatRelativeTime() will print the correct moment.
  const update = () => {
    setLastUpdated(Date.now());
  };

  useInterval(update, UPDATE_FREQUENCY);

  const { direction, module, timestamp, withImageNoCaption, extended } = props;
  const moduleName = module || 'module-timestamp';

  if (timestamp === null || timestamp === undefined) {
    return null;
  }

  // Use relative time for under 24hrs ago.
  const now = Math.floor(Date.now());
  const messageAgeInDays =
    (now - timestamp) / (window.CONSTANTS.SECS_IN_DAY * 1000);
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

  return (
    <span
      className={classNames(
        moduleName,
        direction ? `${moduleName}--${direction}` : null,
        withImageNoCaption ? `${moduleName}--with-image-no-caption` : null
      )}
      title={moment(timestamp).format('llll')}
    >
      {dateString}
    </span>
  );
};
