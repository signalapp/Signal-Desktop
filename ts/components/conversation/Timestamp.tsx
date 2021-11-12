// Copyright 2018-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import classNames from 'classnames';
import moment from 'moment';

import { formatRelativeTime } from '../../util/formatRelativeTime';

import type { LocalizerType } from '../../types/Util';

export type Props = {
  timestamp?: number;
  extended?: boolean;
  module?: string;
  withImageNoCaption?: boolean;
  withSticker?: boolean;
  withTapToViewExpired?: boolean;
  direction?: 'incoming' | 'outgoing';
  i18n: LocalizerType;
};

const UPDATE_FREQUENCY = 60 * 1000;

export class Timestamp extends React.Component<Props> {
  private interval: NodeJS.Timeout | null;

  constructor(props: Props) {
    super(props);

    this.interval = null;
  }

  public override componentDidMount(): void {
    const update = () => {
      this.setState({
        // Used to trigger renders
        // eslint-disable-next-line react/no-unused-state
        lastUpdated: Date.now(),
      });
    };
    this.interval = setInterval(update, UPDATE_FREQUENCY);
  }

  public override componentWillUnmount(): void {
    if (this.interval) {
      clearInterval(this.interval);
    }
  }

  public override render(): JSX.Element | null {
    const {
      direction,
      i18n,
      module,
      timestamp,
      withImageNoCaption,
      withSticker,
      withTapToViewExpired,
      extended,
    } = this.props;
    const moduleName = module || 'module-timestamp';

    if (timestamp === null || timestamp === undefined) {
      return null;
    }

    return (
      <span
        className={classNames(
          moduleName,
          direction ? `${moduleName}--${direction}` : null,
          withTapToViewExpired && direction
            ? `${moduleName}--${direction}-with-tap-to-view-expired`
            : null,
          withImageNoCaption ? `${moduleName}--with-image-no-caption` : null,
          withSticker ? `${moduleName}--with-sticker` : null
        )}
        title={moment(timestamp).format('llll')}
      >
        {formatRelativeTime(timestamp, { i18n, extended })}
      </span>
    );
  }
}
