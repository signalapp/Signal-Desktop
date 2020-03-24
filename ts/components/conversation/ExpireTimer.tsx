import React from 'react';
import classNames from 'classnames';

import { getIncrement, getTimerBucket } from '../../util/timer';

interface Props {
  withImageNoCaption: boolean;
  expirationLength: number;
  expirationTimestamp: number;
  direction: 'incoming' | 'outgoing';
}

export class ExpireTimer extends React.Component<Props> {
  private interval: any;

  constructor(props: Props) {
    super(props);

    this.interval = null;
  }

  public componentDidMount() {
    const { expirationLength } = this.props;
    const increment = getIncrement(expirationLength);
    const updateFrequency = Math.max(increment, 500);

    const update = () => {
      this.setState({
        lastUpdated: Date.now(),
      });
    };
    this.interval = setInterval(update, updateFrequency);
  }

  public componentWillUnmount() {
    if (this.interval) {
      clearInterval(this.interval);
    }
  }

  public render() {
    const {
      direction,
      expirationLength,
      expirationTimestamp,
      withImageNoCaption,
    } = this.props;

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
          withImageNoCaption
            ? 'module-expire-timer--with-image-no-caption'
            : null
        )}
      />
    );
  }
}
