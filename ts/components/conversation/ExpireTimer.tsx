import React from 'react';
import classNames from 'classnames';

import { getIncrement, getTimerBucket } from '../../util/timer';

export interface Props {
  withImageNoCaption?: boolean;
  withSticker?: boolean;
  withTapToViewExpired?: boolean;
  expirationLength: number;
  expirationTimestamp: number;
  direction?: 'incoming' | 'outgoing';
}

export class ExpireTimer extends React.Component<Props> {
  private interval: NodeJS.Timeout | null;

  constructor(props: Props) {
    super(props);

    this.interval = null;
  }

  public componentDidMount(): void {
    const { expirationLength } = this.props;
    const increment = getIncrement(expirationLength);
    const updateFrequency = Math.max(increment, 500);

    const update = () => {
      this.setState({
        // Used to trigger renders
        // eslint-disable-next-line react/no-unused-state
        lastUpdated: Date.now(),
      });
    };
    this.interval = setInterval(update, updateFrequency);
  }

  public componentWillUnmount(): void {
    if (this.interval) {
      clearInterval(this.interval);
    }
  }

  public render(): JSX.Element {
    const {
      direction,
      expirationLength,
      expirationTimestamp,
      withImageNoCaption,
      withSticker,
      withTapToViewExpired,
    } = this.props;

    const bucket = getTimerBucket(expirationTimestamp, expirationLength);

    return (
      <div
        className={classNames(
          'module-expire-timer',
          `module-expire-timer--${bucket}`,
          direction ? `module-expire-timer--${direction}` : null,
          withTapToViewExpired
            ? `module-expire-timer--${direction}-with-tap-to-view-expired`
            : null,
          direction && withImageNoCaption
            ? 'module-expire-timer--with-image-no-caption'
            : null,
          withSticker ? 'module-expire-timer--with-sticker' : null
        )}
      />
    );
  }
}
