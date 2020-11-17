import React from 'react';
import classNames from 'classnames';
import moment from 'moment';

import { formatRelativeTime } from '../../util/formatRelativeTime';

import { LocalizerType } from '../../types/Util';

interface Props {
  timestamp?: number;
  extended?: boolean;
  module?: string;
  withImageNoCaption?: boolean;
  direction?: 'incoming' | 'outgoing';
  i18n: LocalizerType;
}

const UPDATE_FREQUENCY = 60 * 1000;

export class Timestamp extends React.Component<Props> {
  private interval: any;

  constructor(props: Props) {
    super(props);

    this.interval = null;
  }

  public componentDidMount() {
    const update = () => {
      this.setState({
        lastUpdated: Date.now(),
      });
    };
    this.interval = setInterval(update, UPDATE_FREQUENCY);
  }

  public componentWillUnmount() {
    if (this.interval) {
      clearInterval(this.interval);
    }
  }

  public render() {
    const {
      direction,
      i18n,
      module,
      timestamp,
      withImageNoCaption,
      extended,
    } = this.props;
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
      dateString = formatRelativeTime(timestamp, { i18n, extended });
    } else {
      dateString = moment(timestamp).fromNow();
      // Prevent times reading "NOW AGO"
      if (dateString.startsWith('now') || dateString.startsWith('Now')) {
        dateString = 'now';
      }

      dateString = dateString
        .replace('minutes', 'mins')
        .replace('minute', 'min');
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
  }
}
