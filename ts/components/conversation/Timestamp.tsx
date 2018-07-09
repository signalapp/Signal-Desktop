import React from 'react';
import classNames from 'classnames';
import moment from 'moment';

import { formatRelativeTime } from '../../util/formatRelativeTime';

import { Localizer } from '../../types/Util';

interface Props {
  timestamp: number;
  withImageNoCaption: boolean;
  direction: 'incoming' | 'outgoing';
  module?: string;
  i18n: Localizer;
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
    } = this.props;
    const moduleName = module || 'module-timestamp';

    return (
      <span
        className={classNames(
          moduleName,
          `${moduleName}--${direction}`,
          withImageNoCaption ? `${moduleName}--with-image-no-caption` : null
        )}
        title={moment(timestamp).format('llll')}
      >
        {formatRelativeTime(timestamp, { i18n, extended: true })}
      </span>
    );
  }
}
