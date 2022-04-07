// Copyright 2018-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import classNames from 'classnames';

import { getIncrement, getTimerBucket } from '../../util/timer';
import { clearTimeoutIfNecessary } from '../../util/clearTimeoutIfNecessary';

export type Props = {
  deletedForEveryone?: boolean;
  direction?: 'incoming' | 'outgoing';
  expirationLength: number;
  expirationTimestamp?: number;
  withImageNoCaption?: boolean;
  withSticker?: boolean;
  withTapToViewExpired?: boolean;
};

export class ExpireTimer extends React.Component<Props> {
  private interval: NodeJS.Timeout | null;

  constructor(props: Props) {
    super(props);

    this.interval = null;
  }

  public override componentDidMount(): void {
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

  public override componentWillUnmount(): void {
    clearTimeoutIfNecessary(this.interval);
  }

  public override render(): JSX.Element {
    const {
      deletedForEveryone,
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
          deletedForEveryone
            ? 'module-expire-timer--deleted-for-everyone'
            : null,
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
